// POST /api/ocr — 등기부 OCR 추출 (F03, 2번 담당)
// multipart/form-data { file: PDF|JPG|PNG } → NAVER CLOVA General OCR → RegistryOcrDraft
// 절대 규칙: 여기서 반환하는 값은 "추출 후보"일 뿐이다. 판정(/api/check)에는 고객이
// 확인·수정한 값만 전달한다. 원본 파일·OCR 원문·소유자 실명은 로그에 남기거나 저장하지 않는다.
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { detectOcrFormat, extractOcrFields, isRegistryDocument, parseRegistryOcr } from '@/features/registry/parser';
import type { OcrErrorCode, OcrResponse } from '@/types';

export const maxDuration = 60; // OCR은 오래 걸릴 수 있음

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB — MVP 기본값

// CLOVA는 유료 API다. 무료 제공량 안에서만 쓰도록 보수적으로 제한한다.
// 실제 네이버클라우드 콘솔의 무료 크레딧/사용량에 맞춰 .env로 조정할 것.
const PER_IP_LIMIT = Number(process.env.OCR_RATE_LIMIT_PER_IP_PER_HOUR ?? 5);
const DAILY_LIMIT = Number(process.env.OCR_RATE_LIMIT_DAILY_TOTAL ?? 30);
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const MIME_BY_FORMAT: Record<'pdf' | 'jpg' | 'png', string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  png: 'image/png',
};

function errorResponse(code: OcrErrorCode, message: string, status: number, retryAfterSec?: number) {
  const headers = retryAfterSec ? { 'Retry-After': String(retryAfterSec) } : undefined;
  return NextResponse.json({ error: message, code }, { status, headers });
}

/** CLOVA는 HTTP 200이어도 images[].inferResult === 'ERROR'로 개별 이미지 실패를 알려준다 */
function clovaImageErrorMessage(raw: unknown): string | null {
  const images = (raw as { images?: { inferResult?: string; message?: string }[] } | null)?.images;
  const failed = images?.find((img) => img.inferResult === 'ERROR');
  return failed?.message ?? null;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(req: Request) {
  const invokeUrl = process.env.NAVER_CLOVA_OCR_INVOKE_URL;
  const secret = process.env.NAVER_CLOVA_OCR_SECRET;
  if (!invokeUrl || !secret) {
    return errorResponse('OCR_NOT_CONFIGURED', 'OCR 연동이 설정되지 않았습니다. 잠시 후 다시 시도해 주세요.', 503);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errorResponse('INVALID_FILE', '요청 형식이 올바르지 않습니다.', 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return errorResponse('INVALID_FILE', '등기사항전부증명서 파일(PDF·JPG·PNG)을 첨부해 주세요.', 400);
  }
  if (file.size === 0 || file.size > MAX_FILE_BYTES) {
    return errorResponse('INVALID_FILE', '파일 크기는 10MB 이하여야 합니다.', 400);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const format = detectOcrFormat(buf);
  if (!format) {
    return errorResponse('INVALID_FILE', 'PDF, JPG, PNG 파일만 업로드할 수 있습니다.', 400);
  }

  // 실제 CLOVA 호출(과금 대상) 직전에만 제한을 건다 — 검증 실패 요청은 소진하지 않는다.
  const ip = clientIp(req);
  const dailyCheck = checkRateLimit('ocr:daily', DAILY_LIMIT, DAY_MS);
  if (!dailyCheck.ok) {
    return errorResponse(
      'RATE_LIMITED',
      '오늘 등기부 OCR 요청 한도를 모두 사용했습니다. 내일 다시 시도해 주세요.',
      429,
      dailyCheck.retryAfterSec,
    );
  }
  const ipCheck = checkRateLimit(`ocr:ip:${ip}`, PER_IP_LIMIT, HOUR_MS);
  if (!ipCheck.ok) {
    return errorResponse(
      'RATE_LIMITED',
      'OCR 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
      429,
      ipCheck.retryAfterSec,
    );
  }

  let clovaJson: unknown;
  try {
    const message = {
      version: 'V2',
      requestId: randomUUID(),
      timestamp: Date.now(),
      lang: 'ko',
      images: [{ format, name: 'registry' }],
    };
    const clovaForm = new FormData();
    clovaForm.append('message', JSON.stringify(message));
    clovaForm.append('file', new Blob([buf], { type: MIME_BY_FORMAT[format] }), `registry.${format}`);

    const res = await fetch(invokeUrl, {
      method: 'POST',
      headers: { 'X-OCR-SECRET': secret },
      body: clovaForm,
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('[ocr] CLOVA 호출 실패, status:', res.status);
      return errorResponse('OCR_PROVIDER_FAILED', 'OCR 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', 502);
    }
    clovaJson = await res.json();
  } catch (e) {
    console.error('[ocr] CLOVA 호출 예외:', e instanceof Error ? e.message : 'unknown');
    return errorResponse('OCR_PROVIDER_FAILED', 'OCR 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', 502);
  }

  // HTTP는 200이어도 이미지 자체 처리에 실패하는 경우가 있다 (손상된 파일, 지원 안 되는 페이지 크기 등)
  const imageError = clovaImageErrorMessage(clovaJson);
  if (imageError) {
    console.error('[ocr] CLOVA 이미지 처리 실패:', imageError);
    return errorResponse(
      'INVALID_FILE',
      '업로드한 파일을 처리하지 못했습니다. 파일이 손상되지 않았는지 확인하고 다시 시도해 주세요.',
      422,
    );
  }

  const fields = extractOcrFields(clovaJson);
  if (!isRegistryDocument(fields)) {
    return errorResponse(
      'INVALID_REGISTRY_DOCUMENT',
      '등기사항전부증명서로 확인되지 않는 문서입니다. 등기소 발급 문서인지 확인해 주세요.',
      422,
    );
  }

  const draft = parseRegistryOcr(fields);
  const body: OcrResponse = { draft };
  return NextResponse.json(body);
}
