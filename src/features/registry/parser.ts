// src/features/registry/parser.ts — CLOVA OCR 원문 → 등기부 추출 후보(RegistryOcrDraft)
// 절대 규칙: 여기서 만드는 값은 전부 "후보"다. 고객 확인·수정 후에만 판정에 사용한다.
// 읽지 못했으면 반드시 MISSING. 근저당 합계를 0으로, 권리침해를 false로 임의로 채우지 않는다.
import type { OcrFieldDraft, OcrFieldStatus, RegistryOcrDraft } from '@/types';

/** 이 신뢰도 미만이면 EXTRACTED가 아니라 LOW_CONFIDENCE로 표시해 고객 확인을 강하게 요구한다 */
export const OCR_CONFIDENCE_THRESHOLD = 0.85;

// ---------- 업로드 파일 포맷 판별 (매직바이트 기준 — MIME은 클라이언트가 조작 가능) ----------

export type SupportedOcrFormat = 'pdf' | 'jpg' | 'png';

const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(buf: Buffer, magic: number[]): boolean {
  if (buf.length < magic.length) return false;
  return magic.every((b, i) => buf[i] === b);
}

/** 파일 내용의 실제 매직바이트로 포맷을 판별한다. 지원 포맷이 아니면 null. */
export function detectOcrFormat(buf: Buffer): SupportedOcrFormat | null {
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (startsWith(buf, JPEG_MAGIC)) return 'jpg';
  if (startsWith(buf, PNG_MAGIC)) return 'png';
  return null;
}

// ---------- CLOVA 원본 응답 → 평면 필드 ----------

interface ClovaVertex { x: number; y: number }
interface ClovaField {
  inferText: string;
  inferConfidence: number;
  boundingPoly?: { vertices?: ClovaVertex[] };
  convertedImageInfo?: { pageIndex?: number };
}
interface ClovaImage {
  fields?: ClovaField[];
  convertedImageInfo?: { pageIndex?: number };
}
interface ClovaOcrResponse { images?: ClovaImage[] }

export interface OcrTextField {
  text: string;
  confidence: number;
  page: number;
  y: number;
  x: number;
}

/** CLOVA General OCR 원본 JSON을 page/y/x가 있는 평면 필드 배열로 변환한다 */
export function extractOcrFields(raw: unknown): OcrTextField[] {
  const data = (raw ?? {}) as ClovaOcrResponse;
  const out: OcrTextField[] = [];
  (data.images ?? []).forEach((img, imgIdx) => {
    const imagePage = img.convertedImageInfo?.pageIndex ?? imgIdx;
    (img.fields ?? []).forEach((f) => {
      if (!f.inferText) return;
      const page = f.convertedImageInfo?.pageIndex ?? imagePage;
      const vertices = f.boundingPoly?.vertices ?? [];
      const y = vertices.length ? Math.min(...vertices.map((v) => v.y)) : 0;
      const x = vertices.length ? Math.min(...vertices.map((v) => v.x)) : 0;
      out.push({ text: f.inferText, confidence: f.inferConfidence ?? 0, page, y, x });
    });
  });
  return out;
}

// ---------- 필드 → 줄 단위 재구성 ----------

interface Line { page: number; y: number; text: string; minConfidence: number }

const Y_LINE_THRESHOLD = 12; // px — 이 이내 y 오차는 같은 줄로 취급

function toLines(fields: OcrTextField[]): Line[] {
  const sorted = [...fields].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
  const lines: Line[] = [];
  for (const f of sorted) {
    const last = lines[lines.length - 1];
    if (last && last.page === f.page && Math.abs(last.y - f.y) <= Y_LINE_THRESHOLD) {
      last.text += ` ${f.text}`;
      last.minConfidence = Math.min(last.minConfidence, f.confidence);
    } else {
      lines.push({ page: f.page, y: f.y, text: f.text, minConfidence: f.confidence });
    }
  }
  return lines;
}

/** 문자 사이에 OCR이 공백을 끼워 넣어도 매칭되도록 느슨한 정규식을 만든다 */
function looseRe(keyword: string): RegExp {
  return new RegExp(keyword.split('').map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*'));
}

const TITLE_RE = looseRe('등기사항전부증명서');
const UNIQUE_NO_RE = looseRe('고유번호');
const GAPGU_RE = looseRe('갑구');
const EULGU_RE = looseRe('을구');

/** 업로드된 문서가 등기사항전부증명서인지 최소 확인 (제목·갑구/을구·고유번호 키워드) */
export function isRegistryDocument(fields: OcrTextField[]): boolean {
  const fullText = fields.map((f) => f.text).join(' ');
  return TITLE_RE.test(fullText) && GAPGU_RE.test(fullText) && EULGU_RE.test(fullText) && UNIQUE_NO_RE.test(fullText);
}

function statusOf(confidence: number): OcrFieldStatus {
  return confidence >= OCR_CONFIDENCE_THRESHOLD ? 'EXTRACTED' : 'LOW_CONFIDENCE';
}

function missingField<T>(): OcrFieldDraft<T> {
  return { confidence: 0, status: 'MISSING' };
}

/** start 키워드가 나오는 줄부터, end 키워드가 나오는 줄 전까지 잘라낸다. end가 없으면 문서 끝까지. */
function sliceSection(lines: Line[], start: RegExp, end?: RegExp): Line[] {
  const startIdx = lines.findIndex((l) => start.test(l.text));
  if (startIdx === -1) return [];
  const endIdx = end ? lines.findIndex((l, i) => i > startIdx && end.test(l.text)) : -1;
  return lines.slice(startIdx, endIdx === -1 ? lines.length : endIdx);
}

// ---------- 갑구: 소유자 ----------

const OWNER_KEYWORD_RE = looseRe('소유자');
const CORP_MARKER_RE = /(주식회사|㈜|유한회사|재단법인|사단법인|조합|공사|공단)/;
const KOREAN_NAME_RE = /[가-힣]{2,4}(?=[\s(]|$)/;
const CANCELLED_RE = looseRe('말소');

function extractOwner(gapgu: Line[]): {
  ownerType?: OcrFieldDraft<'INDIVIDUAL' | 'CORPORATION'>;
  ownerNameCandidate?: OcrFieldDraft<string>;
} {
  // 갑구는 접수 순서(순위번호)대로 나열되므로, 소유권 이전 이력이 있으면 소유자 표기가
  // 여러 번 등장한다. 가장 마지막(=가장 최근) 항목이 현재 소유자일 가능성이 높다.
  let idx = -1;
  for (let i = gapgu.length - 1; i >= 0; i -= 1) {
    if (OWNER_KEYWORD_RE.test(gapgu[i].text)) { idx = i; break; }
  }
  if (idx === -1) return {};

  const windowLines = gapgu.slice(idx, idx + 3);
  const windowText = windowLines.map((l) => l.text).join(' ');
  const confidence = Math.min(...windowLines.map((l) => l.minConfidence));
  const status = statusOf(confidence);

  if (CORP_MARKER_RE.test(windowText)) {
    const m = windowText.match(new RegExp(`[가-힣A-Za-z()㈜]{0,20}${CORP_MARKER_RE.source}[가-힣A-Za-z()㈜]{0,10}`));
    return {
      ownerType: { value: 'CORPORATION', confidence, status },
      ownerNameCandidate: m ? { value: m[0].trim(), confidence, status, evidence: m[0].trim() } : missingField(),
    };
  }

  const afterKeyword = windowText.replace(new RegExp(`^[\\s\\S]*?${OWNER_KEYWORD_RE.source}`), '');
  const nameMatch = afterKeyword.match(KOREAN_NAME_RE);
  if (nameMatch) {
    return {
      ownerType: { value: 'INDIVIDUAL', confidence, status },
      ownerNameCandidate: { value: nameMatch[0], confidence, status, evidence: nameMatch[0] },
    };
  }
  return { ownerType: missingField() };
}

// ---------- 갑구: 권리침해 ----------

const RIGHTS_VIOLATION_KEYWORDS = ['압류', '가압류', '경매개시', '임의경매', '강제경매', '가처분', '가등기'];

function extractRightsViolation(gapgu: Line[]): OcrFieldDraft<boolean> {
  if (gapgu.length === 0) return missingField();

  const hits = gapgu.filter(
    (l) => RIGHTS_VIOLATION_KEYWORDS.some((k) => looseRe(k).test(l.text)) && !CANCELLED_RE.test(l.text),
  );
  if (hits.length > 0) {
    const confidence = Math.min(...hits.map((l) => l.minConfidence));
    const matchedKeywords = hits
      .map((l) => RIGHTS_VIOLATION_KEYWORDS.find((k) => looseRe(k).test(l.text)))
      .filter((k): k is string => !!k);
    return {
      value: true,
      confidence,
      status: statusOf(confidence),
      evidence: Array.from(new Set(matchedKeywords)).join(', '),
    };
  }

  // 갑구를 읽긴 했으나 위 키워드가 전혀 없는 경우에만 "없음" 후보로 표시한다.
  // 섹션 자체의 인식 신뢰도가 낮으면 놓친 것일 수 있으므로 MISSING으로 둔다 (false로 단정 금지).
  const sectionConfidence = gapgu.reduce((min, l) => Math.min(min, l.minConfidence), 1);
  if (sectionConfidence < OCR_CONFIDENCE_THRESHOLD) return missingField();
  return { value: false, confidence: sectionConfidence, status: 'EXTRACTED' };
}

// ---------- 을구: 선순위채권(근저당) 합계 ----------

const LIEN_KEYWORD_RE = looseRe('채권최고액');
const AMOUNT_RE = /금?\s*([0-9][0-9,]*)\s*원/;

const LIEN_AMOUNT_WINDOW = 3; // 채권최고액 키워드 줄부터 최대 이만큼(포함) 안에서 금액을 찾는다

function extractSeniorLienTotal(eulgu: Line[]): OcrFieldDraft<number> {
  const keywordIdxs = eulgu
    .map((l, i) => i)
    .filter((i) => LIEN_KEYWORD_RE.test(eulgu[i].text) && !CANCELLED_RE.test(eulgu[i].text));
  if (keywordIdxs.length === 0) return missingField();

  let sum = 0;
  let minConfidence = 1;
  const evidenceParts: string[] = [];
  const usedLines = new Set<number>();

  for (const startIdx of keywordIdxs) {
    // "채권최고액"과 실제 금액이 OCR상 같은 줄이 아니라 바로 다음 줄(칸이 나뉜 표 등)로 갈 수 있어
    // 키워드 줄부터 몇 줄을 더 살펴본다. 그 사이에 말소 표기가 나오면 이 항목은 건너뛴다.
    const windowEnd = Math.min(eulgu.length, startIdx + LIEN_AMOUNT_WINDOW);
    for (let i = startIdx; i < windowEnd; i += 1) {
      if (usedLines.has(i)) break; // 이미 다른 채권최고액 항목이 사용한 금액과 겹치면 중단
      if (i > startIdx && CANCELLED_RE.test(eulgu[i].text)) break;
      const m = eulgu[i].text.match(AMOUNT_RE);
      if (!m) continue;
      const amount = Number(m[1].replace(/,/g, ''));
      if (!Number.isFinite(amount)) continue;
      sum += amount;
      minConfidence = Math.min(minConfidence, eulgu[i].minConfidence);
      evidenceParts.push(m[0]);
      usedLines.add(i);
      break; // 이 채권최고액 항목의 금액은 찾았으니 다음 키워드로 넘어간다
    }
  }
  if (evidenceParts.length === 0) return missingField();
  return { value: sum, confidence: minConfidence, status: statusOf(minConfidence), evidence: evidenceParts.join(', ') };
}

// ---------- 발급일 ----------

const ISSUED_DATE_RE = /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/;

function extractIssuedDate(lines: Line[]): string | undefined {
  for (const l of lines) {
    const m = l.text.match(ISSUED_DATE_RE);
    if (m) {
      const [, y, mo, d] = m;
      return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  return undefined;
}

// ---------- 진입점 ----------

export function parseRegistryOcr(fields: OcrTextField[]): RegistryOcrDraft {
  const lines = toLines(fields);
  const gapgu = sliceSection(lines, GAPGU_RE, EULGU_RE);
  const eulgu = sliceSection(lines, EULGU_RE); // 을구가 마지막 섹션이므로 끝까지

  const owner = extractOwner(gapgu);

  return {
    ownerNameCandidate: owner.ownerNameCandidate ?? missingField(),
    ownerType: owner.ownerType ?? missingField(),
    seniorLienTotal: extractSeniorLienTotal(eulgu),
    hasRightsViolation: extractRightsViolation(gapgu),
    issuedDate: extractIssuedDate(lines),
  };
}
