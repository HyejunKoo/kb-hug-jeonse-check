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

// 단독소유는 "소유자", 공동소유(지분권)는 "공유자"로 표기된다 — 둘 다 잡아야 한다.
const OWNER_KEYWORD_RE = new RegExp(`(${looseRe('소유자').source}|${looseRe('공유자').source})`);
const CORP_MARKER_RE = /(주식회사|㈜|유한회사|재단법인|사단법인|조합|공사|공단)/;
const KOREAN_NAME_RE = /[가-힣]{2,4}(?=[\s(]|$)/;
// 이름 뒤에는 주민등록번호(뒷자리 마스킹 포함)가 바로 붙는다 — "지분", "10분의 3" 같은
// 공유 지분 표기보다 훨씬 정확하게 실제 이름 위치를 짚어준다.
const NAME_WITH_REGNUM_RE = /([가-힣]{2,4})\s*\d{6}-[\d*]{6,7}/g;
const CANCELLED_RE = looseRe('말소');

// 공유자 목록(지분·이름·주민번호·주소가 여러 줄 반복)을 다 담기 위해 넉넉한 창을 쓴다.
// 그다음 항목(등기명의인표시 변경 등)까지 넘어가도 주민번호가 바로 붙은 토큰만 뽑으므로 오탐 위험은 낮다.
const OWNER_LIST_WINDOW = 10;
// 공동소유는 문서 형식에 따라 키워드가 한 번만("공유자" 뒤에 여러 명 나열)이거나, 사람마다
// 반복("공유자 A" ... "공유자 B")될 수 있다. 이 간격 이내로 붙어있는 키워드들은 같은 등록
// 건(공동소유)으로 보고 전부 묶는다 — 단, 그 사이에 새 등록 건 표시(소유권이전 등)가 있으면
// 묶지 않는다 (과거 소유자를 현재 소유자와 합치는 것을 막기 위함).
const OWNER_GROUP_GAP = 6;
const OWNERSHIP_EVENT_RE = /소유권\s*(일부\s*)?이전|소유권\s*보존/;

function extractOwner(gapgu: Line[]): {
  ownerType?: OcrFieldDraft<'INDIVIDUAL' | 'CORPORATION'>;
  ownerNameCandidates?: OcrFieldDraft<string[]>;
} {
  // 갑구는 접수 순서(순위번호)대로 나열되므로, 소유권 이전 이력이 있으면 소유자 표기가
  // 여러 번 등장한다. 가장 마지막(=가장 최근) 항목이 현재 소유자일 가능성이 높다.
  const keywordIdxs: number[] = [];
  gapgu.forEach((l, i) => { if (OWNER_KEYWORD_RE.test(l.text)) keywordIdxs.push(i); });
  if (keywordIdxs.length === 0) return {};

  const lastIdx = keywordIdxs[keywordIdxs.length - 1];
  let clusterStart = lastIdx;
  for (let k = keywordIdxs.length - 2; k >= 0; k -= 1) {
    const candidateIdx = keywordIdxs[k];
    if (clusterStart - candidateIdx > OWNER_GROUP_GAP) break;
    const between = gapgu.slice(candidateIdx + 1, clusterStart);
    if (between.some((l) => OWNERSHIP_EVENT_RE.test(l.text))) break; // 그 사이에 새 등록 건이 시작됨
    clusterStart = candidateIdx;
  }

  const windowEnd = Math.min(gapgu.length, lastIdx + OWNER_LIST_WINDOW);
  const windowLines = gapgu.slice(clusterStart, windowEnd);
  const windowText = windowLines.map((l) => l.text).join(' ');
  const confidence = Math.min(...windowLines.map((l) => l.minConfidence));
  const status = statusOf(confidence);

  if (CORP_MARKER_RE.test(windowText)) {
    const m = windowText.match(new RegExp(`[가-힣A-Za-z()㈜]{0,20}${CORP_MARKER_RE.source}[가-힣A-Za-z()㈜]{0,10}`));
    return {
      ownerType: { value: 'CORPORATION', confidence, status },
      ownerNameCandidates: m ? { value: [m[0].trim()], confidence, status, evidence: m[0].trim() } : missingField(),
    };
  }

  // 공유자는 이름이 여러 번(지분별로 또는 사람마다) 나오므로 클러스터 전체에서
  // "이름+주민번호" 패턴을 전부 모은다.
  const names: string[] = [];
  const re = new RegExp(NAME_WITH_REGNUM_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(windowText)) !== null) {
    if (!names.includes(m[1])) names.push(m[1]);
  }

  if (names.length > 0) {
    return {
      ownerType: { value: 'INDIVIDUAL', confidence, status },
      ownerNameCandidates: { value: names, confidence, status, evidence: names.join(', ') },
    };
  }

  // 주민번호가 인식되지 않은 경우의 대비책 — 클러스터 안 키워드 각각의 바로 뒤 한글 이름
  // 후보를 모은다 (키워드가 사람마다 반복되는 형식이면 이 경로로 여러 명이 모두 잡힌다).
  const fallbackNames: string[] = [];
  for (const kIdx of keywordIdxs) {
    if (kIdx < clusterStart) continue;
    const seg = gapgu.slice(kIdx, Math.min(gapgu.length, kIdx + 3)).map((l) => l.text).join(' ');
    const after = seg.replace(new RegExp(`^[\\s\\S]*?${OWNER_KEYWORD_RE.source}`), '');
    const name = after.match(KOREAN_NAME_RE)?.[0];
    if (name && !fallbackNames.includes(name)) fallbackNames.push(name);
  }
  if (fallbackNames.length > 0) {
    return {
      ownerType: { value: 'INDIVIDUAL', confidence, status },
      ownerNameCandidates: { value: fallbackNames, confidence, status, evidence: fallbackNames.join(', ') },
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
  // 단, 첫 줄(섹션 헤더 "【 갑구 】")은 특수문자 때문에 구조적으로 신뢰도가 낮게 나오는 경우가
  // 많아 헤더 자체는 신뢰도 판단에서 제외하고 실제 내용 줄만 본다.
  const contentLines = gapgu.slice(1);
  if (contentLines.length === 0) return missingField();
  const sectionConfidence = contentLines.reduce((min, l) => Math.min(min, l.minConfidence), 1);
  if (sectionConfidence < OCR_CONFIDENCE_THRESHOLD) return missingField();
  return { value: false, confidence: sectionConfidence, status: 'EXTRACTED' };
}

// ---------- 을구: 선순위채권(근저당) 합계 ----------

const LIEN_KEYWORD_RE = looseRe('채권최고액');
const AMOUNT_RE = /금?\s*([0-9][0-9,]*)\s*원/;

const LIEN_AMOUNT_WINDOW = 3; // 채권최고액 키워드 줄부터 최대 이만큼(포함) 안에서 금액을 찾는다

// 등기부의 말소는 원래 항목 줄에 표시되지 않고, "2번근저당권설정, 3번근저당권설정 등기말소"처럼
// 뒤에 별도 순위번호로 오는 새 항목으로 기록된다. 그래서 같은 줄 안의 "말소"만 봐서는 걸러지지 않는다.
const CANCEL_REF_RE = /(\d+)\s*번/g;
const ENTRY_TRAILING_NUM_RE = /(?:^|\s)(\d{1,3})\s*$/;

/** "말소" 항목이 참조하는 순위번호를 모은다 (예: "2번근저당권설정, 3번근저당권설정 등기말소" → {2, 3}) */
function findCancelledEntryNumbers(eulgu: Line[]): Set<number> {
  const cancelled = new Set<number>();
  eulgu.forEach((l, i) => {
    if (!CANCELLED_RE.test(l.text)) return;
    const windowText = eulgu.slice(Math.max(0, i - 2), i + 1).map((x) => x.text).join(' ');
    const re = new RegExp(CANCEL_REF_RE.source, 'g');
    let m: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((m = re.exec(windowText))) cancelled.add(Number(m[1]));
  });
  return cancelled;
}

function extractSeniorLienTotal(eulgu: Line[]): OcrFieldDraft<number> {
  const keywordIdxs = eulgu
    .map((l, i) => i)
    .filter((i) => LIEN_KEYWORD_RE.test(eulgu[i].text) && !CANCELLED_RE.test(eulgu[i].text));
  if (keywordIdxs.length === 0) return missingField();

  const cancelledEntryNumbers = findCancelledEntryNumbers(eulgu);

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

      // 이 채권최고액 항목 자신의 순위번호가 뒤에서 말소 참조된 번호와 같으면 합계에서 뺀다.
      const entryNumMatch = eulgu[startIdx].text.match(ENTRY_TRAILING_NUM_RE) ?? eulgu[i].text.match(ENTRY_TRAILING_NUM_RE);
      const entryNum = entryNumMatch ? Number(entryNumMatch[1]) : undefined;
      if (entryNum !== undefined && cancelledEntryNumbers.has(entryNum)) {
        usedLines.add(i);
        break;
      }

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

// ---------- 을구: 기존 전세권·임차권 등 등록된 권리 (참고용) ----------
// 근저당과 달리 금액을 정확히 합산하지 않는다 — 변경(예: "1번전세권변경")과 말소를 문자만으로
// 구분하기 어려워 금액을 잘못 이중 계산할 위험이 크다. 대신 "남아있는지 여부"만 후보화하고
// evidence로 원문을 보여줘 고객이 직접 금액을 확인하게 한다.
const LEASEHOLD_KEYWORD_RE = new RegExp(`(${looseRe('전세권설정').source}|${looseRe('임차권설정').source})`);

function extractExistingLeaseholdRights(eulgu: Line[]): OcrFieldDraft<boolean> {
  if (eulgu.length === 0) return missingField();

  const cancelledEntryNumbers = findCancelledEntryNumbers(eulgu);
  const hits = eulgu.filter((l) => {
    if (!LEASEHOLD_KEYWORD_RE.test(l.text) || CANCELLED_RE.test(l.text)) return false;
    const entryNumMatch = l.text.match(ENTRY_TRAILING_NUM_RE);
    const entryNum = entryNumMatch ? Number(entryNumMatch[1]) : undefined;
    return !(entryNum !== undefined && cancelledEntryNumbers.has(entryNum));
  });

  if (hits.length > 0) {
    const confidence = Math.min(...hits.map((l) => l.minConfidence));
    return { value: true, confidence, status: statusOf(confidence), evidence: hits.map((l) => l.text).join(' / ') };
  }

  // 헤더 줄("【 을구 】")은 신뢰도 판단에서 제외 (갑구와 동일한 이유)
  const contentLines = eulgu.slice(1);
  if (contentLines.length === 0) return missingField();
  const sectionConfidence = contentLines.reduce((min, l) => Math.min(min, l.minConfidence), 1);
  if (sectionConfidence < OCR_CONFIDENCE_THRESHOLD) return missingField();
  return { value: false, confidence: sectionConfidence, status: 'EXTRACTED' };
}

// ---------- 표제부: 소재지 (F04 주소 대조용) ----------

// 등기부 첫 줄은 "[집합건물] 서울특별시 마포구 ... 제3층 제301호" 형태로 소재지를 담고 있다.
// 표의 '소재지번' 칸보다 이 줄이 한 줄에 온전히 들어와 있어 OCR 재구성에 유리하다.
const DOC_TYPE_RE = /\[\s*(집합건물|건물|토지)\s*\]/;
const LOCATION_KEYWORD_RE = looseRe('소재지번');
const MIN_ADDRESS_LEN = 4;

function extractDocumentAddress(lines: Line[]): OcrFieldDraft<string> {
  for (const l of lines) {
    const m = l.text.match(DOC_TYPE_RE);
    if (!m) continue;
    const after = l.text.slice((m.index ?? 0) + m[0].length).trim();
    if (after.length < MIN_ADDRESS_LEN) continue;
    return { value: after, confidence: l.minConfidence, status: statusOf(l.minConfidence), evidence: l.text.trim() };
  }

  // 첫 줄을 못 읽었을 때의 대비책 — 표제부 '소재지번' 칸 뒤 문자열
  for (const l of lines) {
    if (!LOCATION_KEYWORD_RE.test(l.text)) continue;
    const after = l.text.replace(new RegExp(`^[\\s\\S]*?${LOCATION_KEYWORD_RE.source}`), '').trim();
    if (after.length < MIN_ADDRESS_LEN) continue;
    return { value: after, confidence: l.minConfidence, status: statusOf(l.minConfidence), evidence: l.text.trim() };
  }

  return missingField();
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
    ownerNameCandidates: owner.ownerNameCandidates ?? missingField(),
    ownerType: owner.ownerType ?? missingField(),
    seniorLienTotal: extractSeniorLienTotal(eulgu),
    hasRightsViolation: extractRightsViolation(gapgu),
    existingLeaseholdRights: extractExistingLeaseholdRights(eulgu),
    documentAddress: extractDocumentAddress(lines),
    issuedDate: extractIssuedDate(lines),
  };
}
