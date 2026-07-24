// POST /api/ocr — 등기부 추출 (F03, 2번 담당)
// MVP: 샘플 데이터 우선. 추출 결과는 반드시 고객 확인 후에만 판정에 사용.
import { NextResponse } from 'next/server';
import type { RegistryInfo } from '@/lib/types';

export const maxDuration = 60; // OCR/파싱은 오래 걸릴 수 있음

export async function POST(req: Request) {
  // TODO(2번): FormData로 PDF 받아 파싱/OCR 구현
  // const form = await req.formData(); const file = form.get('file') as File;
  void req;

  // 데모용 샘플 추출 결과 — 화면에서 고객이 확인·수정한 뒤에만 /api/check로 전달
  const sample: RegistryInfo = {
    ownerName: { value: '홍길동', source: 'USER_CONFIRMED_DOCUMENT' },
    ownerType: { value: 'INDIVIDUAL', source: 'USER_CONFIRMED_DOCUMENT' },
    seniorLienTotal: { value: 120000000, source: 'USER_CONFIRMED_DOCUMENT' },
    hasRightsViolation: { value: false, source: 'USER_CONFIRMED_DOCUMENT' },
    issuedDate: '2026-07-20',
  };

  return NextResponse.json({
    registry: sample,
    demo: true,
    note: '샘플 추출 결과입니다. 고객 확인 화면에서 수정 후 판정에 사용하세요.',
  });
}
