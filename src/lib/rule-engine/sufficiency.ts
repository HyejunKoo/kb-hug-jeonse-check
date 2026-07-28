// ============================================================
// src/lib/rule-engine/sufficiency.ts — F04 진단자료 충분성 검사 (순수 함수만)
//
// 규칙팩보다 먼저 돌면서 "판정을 시작할 자료가 갖춰졌는가"만 본다.
// 여기서 이슈가 하나라도 나오면 /api/check 는 runRulePack()을 호출하지 않고
// blockedAt: 'INSUFFICIENT' 결과만 돌려준다 — 자료가 빈 상태로 만든 요건 판정을
// 사용자에게 보여주지 않기 위함이다.
//
// 이 파일이 보는 것 / 보지 않는 것:
//   O  값이 있는가, 기대한 출처(source)에서 온 값인가, enum·숫자·날짜 형식이 맞는가
//   O  등기부가 이 매물의 것이 맞는가, 발급일이 최신인가
//   X  나이 초과·직거래·보증금 한도 초과 같은 요건 충돌 → 이건 evaluator.ts의 몫
//
// ownerType·existingLeaseholdRights는 현재 활성 규칙이 소비하지 않으므로 필수에서 뺀다.
// 규칙이 추가되면 여기 필수 목록에도 함께 넣어야 한다.
// ============================================================
import type { CheckResult, DiagnosisCase, Field, RegistryInfo, SourceCode } from '@/types';

/** 등기사항전부증명서 최신성 기준 — 발급일로부터 이 일수 이내여야 판정에 쓴다 */
export const DEFAULT_ISSUED_WITHIN_DAYS = 30;

const ALL_SOURCES: readonly SourceCode[] = [
  'USER_DECLARED', 'USER_CONFIRMED_DOCUMENT', 'PUBLIC_API', 'INTERNAL_REQUIRED',
];

// 항목마다 "어디서 온 값이어야 하는가"가 다르다. 출처 코드가 붙어 있기만 하면 통과시키면
// 등기부 값이 자기신고로 들어와도 판정에 쓰이게 되어 Field<T>의 의미가 사라진다.
// INTERNAL_REQUIRED는 "기관 내부정보가 필요하다"는 표시일 뿐 확보된 값이 아니라 어디에도 넣지 않는다.
const DECLARED: readonly SourceCode[] = ['USER_DECLARED'];              // 1·2단계 폼 입력
const PUBLIC: readonly SourceCode[] = ['PUBLIC_API'];                   // 주소검색·건축HUB 조회값
const CONFIRMED: readonly SourceCode[] = ['USER_CONFIRMED_DOCUMENT'];   // 문서를 열람해 고객이 확인한 값

/** 출처 코드 한글 표기 (결과 화면 usedValues 표기용) */
export const SOURCE_KO: Record<SourceCode, string> = {
  USER_DECLARED: '자기신고',
  USER_CONFIRMED_DOCUMENT: '고객확인문서',
  PUBLIC_API: '공공API',
  INTERNAL_REQUIRED: '기관 내부정보',
};

/** MISSING = 값이 없거나 확인 안 됨 / CONFLICT = 값은 있는데 서로 어긋남 */
export type SufficiencyIssueKind = 'MISSING' | 'CONFLICT';

export interface SufficiencyIssue {
  id: string;                 // CheckResult.ruleId 로 그대로 나간다
  label: string;
  kind: SufficiencyIssueKind;
  reason: string;
  usedValues: string[];
  nextAction: string;
}

export interface SufficiencyOptions {
  /** 등기부 발급일 허용 일수 (기본 30일) */
  issuedWithinDays?: number;
  /** 발급일 기준이 되는 '오늘' (YYYY-MM-DD). 테스트에서 고정하기 위한 주입점 */
  today?: string;
}

interface DateContext {
  issuedWithinDays: number;
  today: string;
}

// ---------- 값 검사 유틸 ----------

/** Field 모양이고 알려진 출처가 붙어 있으면 그 출처를, 아니면 undefined */
function sourceOf(f: unknown): SourceCode | undefined {
  if (!f || typeof f !== 'object') return undefined;
  const source = (f as { source?: unknown }).source;
  if (typeof source !== 'string' || !ALL_SOURCES.includes(source as SourceCode)) return undefined;
  return source as SourceCode;
}

/** 'YYYY-MM-DD' 형식이고 실제로 존재하는 날짜인가 ('2026-02-31' 같은 값을 거른다) */
function isIsoDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** 한국 기준 오늘 날짜 — 서버 타임존(Vercel=UTC)에 따라 발급일 경계가 하루씩 밀리는 것을 막는다 */
function todayInSeoul(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}

/** from → to 사이 일수 (둘 다 YYYY-MM-DD. to가 더 이르면 음수) */
function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((b - a) / 86_400_000);
}

// 값 형식 검사기 — 유효하면 null, 아니면 사람이 읽는 오류 사유를 돌려준다
const oneOf = <T>(allowed: readonly T[]) => (v: T): string | null =>
  allowed.includes(v) ? null : `허용되지 않은 값입니다 (${String(v)}).`;

const finiteNumber = (v: number): string | null =>
  (Number.isFinite(v) ? null : '숫자가 아닙니다.');

const positiveInt = (v: number): string | null =>
  (Number.isInteger(v) && v > 0 ? null : '양의 정수가 아닙니다.');

const nonEmptyText = (v: string): string | null =>
  (typeof v === 'string' && v.trim() !== '' ? null : '값이 비어 있습니다.');

const isBoolean = (v: boolean): string | null =>
  (typeof v === 'boolean' ? null : '예/아니오 값이 아닙니다.');

const isoDate = (v: string): string | null =>
  (isIsoDate(v) ? null : 'YYYY-MM-DD 형식의 날짜가 아닙니다.');

// ---------- 이슈 수집기 ----------

class IssueCollector {
  readonly issues: SufficiencyIssue[] = [];

  missing(id: string, label: string, reason: string, nextAction: string, usedValues: string[] = []) {
    this.issues.push({ id, label, kind: 'MISSING', reason, usedValues, nextAction });
  }

  conflict(id: string, label: string, reason: string, nextAction: string, usedValues: string[] = []) {
    this.issues.push({ id, label, kind: 'CONFLICT', reason, usedValues, nextAction });
  }

  /**
   * 필수 Field 하나를 검사한다. 값 없음 / 출처 없음 / 기대와 다른 출처 / 형식·범위 오류를
   * 모두 여기서 잡는다. 통과하면 true — 호출부는 이 결과로 "값이 있으니 내용까지 더 본다" 분기를 만든다.
   * @param allowed 이 항목이 나올 수 있는 출처. 다른 출처로 온 값은 판정에 쓰지 않는다.
   */
  requireField<T>(
    id: string,
    label: string,
    field: Field<T> | undefined,
    allowed: readonly SourceCode[],
    nextAction: string,
    check: (v: T) => string | null,
  ): boolean {
    if (field === undefined || field === null) {
      this.missing(id, label, `${label} 값이 없어 판정에 사용할 수 없습니다.`, nextAction);
      return false;
    }
    const source = sourceOf(field);
    if (!source) {
      this.missing(
        id, label,
        `${label} 값에 확보된 출처(source)가 붙어 있지 않아 판정에 사용할 수 없습니다.`,
        nextAction,
      );
      return false;
    }
    if (!allowed.includes(source)) {
      const expected = allowed.map((s) => SOURCE_KO[s]).join('·');
      this.missing(
        id, label,
        `${label} 값이 '${SOURCE_KO[source]}' 출처로 들어왔습니다 — 이 항목은 ${expected}(으)로 확인된 값만 판정에 쓸 수 있습니다.`,
        nextAction,
        [`받은 출처: ${SOURCE_KO[source]}`],
      );
      return false;
    }
    const problem = check(field.value);
    if (problem) {
      this.missing(id, label, `${label} — ${problem}`, nextAction, [`출처: ${SOURCE_KO[source]}`]);
      return false;
    }
    return true;
  }
}

// ---------- 영역별 검사 ----------

function checkApplicant(c: IssueCollector, diag: DiagnosisCase) {
  const a = diag.applicant;
  if (!a) {
    c.missing('F04-APPLICANT', '신청인 정보', '신청인 입력이 전달되지 않았습니다.', '1단계 신청인 조건을 입력해 주세요.');
    return;
  }
  const back = '1단계 신청인 조건으로 돌아가 값을 확인해 주세요.';

  c.requireField('F04-APPLICANT-AGE', '신청인 연령', a.age, DECLARED, back,
    (v) => (Number.isInteger(v) && v > 0 && v < 150 ? null : '나이로 볼 수 없는 값입니다.'));

  c.requireField('F04-APPLICANT-HOUSEHOLD', '세대주 상태', a.householdHead, DECLARED, back,
    oneOf(['YES', 'NO', 'PLANNED'] as const));

  c.requireField('F04-APPLICANT-HOMECOUNT', '주택 보유 수', a.homeCount, DECLARED, back,
    oneOf([0, 1, 2] as const));

  c.requireField('F04-APPLICANT-MARITAL', '혼인 상태', a.maritalStatus, DECLARED, back,
    oneOf(['SINGLE', 'MARRIED', 'PLANNED'] as const));

  c.requireField('F04-APPLICANT-INCOMETYPE', '소득 유형', a.incomeType, DECLARED, back,
    oneOf(['EMPLOYED', 'SELF_EMPLOYED', 'NO_INCOME'] as const));

  c.requireField('F04-APPLICANT-EXISTING-LOAN', '기존 전세자금대출 보유', a.existingJeonseLoan, DECLARED, back,
    oneOf(['NONE', 'HAS_ONE', 'HAS_MULTIPLE'] as const));

  // 소득구간은 '모름'이 허용된 선택지라 형식은 맞지만 판정에는 쓸 수 없다 — 별도 문구로 안내한다.
  const band = a.incomeBand;
  const bandOk = c.requireField('F04-APPLICANT-INCOME', '연소득 구간', band, DECLARED, back,
    oneOf(['UNDER_50M', 'B50_60M', 'B60_70M', 'OVER_70M', 'UNKNOWN'] as const));
  if (bandOk && band.value === 'UNKNOWN') {
    c.missing(
      'F04-APPLICANT-INCOME-UNKNOWN', '연소득 구간',
      "연소득을 '모름'으로 선택하셨습니다 — 소득 상한 요건을 판정할 수 없습니다.",
      '원천징수영수증·소득금액증명원으로 소득 구간을 확인한 뒤 다시 진단해 주세요.',
      [`소득구간: 모름 (${SOURCE_KO[band.source]})`],
    );
  }
}

function checkContract(c: IssueCollector, diag: DiagnosisCase, today: string) {
  const k = diag.contract;
  if (!k) {
    c.missing('F04-CONTRACT', '예정 계약 정보', '예정 계약 입력이 전달되지 않았습니다.', '2단계 예정 계약 내용을 입력해 주세요.');
    return;
  }
  const back = '2단계 예정 계약 내용으로 돌아가 값을 확인해 주세요.';

  c.requireField('F04-CONTRACT-DEPOSIT', '예정 보증금', k.deposit, DECLARED, back,
    (v) => finiteNumber(v) ?? (v > 0 ? null : '0원 이하입니다.'));

  c.requireField('F04-CONTRACT-TERM', '계약기간', k.termMonths, DECLARED, back, positiveInt);

  c.requireField('F04-CONTRACT-BROKERED', '공인중개사 중개 여부', k.brokered, DECLARED, back, isBoolean);

  const moveIn = k.moveInDate;
  const moveInOk = c.requireField('F04-CONTRACT-MOVEIN', '입주 예정일', moveIn, DECLARED, back, isoDate);
  if (moveInOk && daysBetween(today, moveIn.value) < 0) {
    c.conflict(
      'F04-CONTRACT-MOVEIN-PAST', '입주 예정일',
      `입주 예정일(${moveIn.value})이 이미 지났습니다 — 계약 전 사전점검 대상이 아닙니다.`,
      '앞으로의 입주 예정일로 수정해 주세요. 이미 계약을 체결하셨다면 이 서비스의 사전점검 대상이 아닙니다.',
      [`입주 예정일 ${moveIn.value} (${SOURCE_KO[moveIn.source]})`],
    );
  }
}

function checkProperty(c: IssueCollector, diag: DiagnosisCase) {
  const p = diag.property;
  if (!p) {
    c.missing('F04-PROPERTY', '매물 정보', '매물 입력이 전달되지 않았습니다.', '3단계에서 매물 주소를 검색해 선택해 주세요.');
    return;
  }
  const research = '3단계에서 매물 주소를 다시 검색해 선택하면 건축물대장을 다시 조회합니다.';

  // 주소·유형은 자기신고 경로를 만들지 않는다 (명세 F-02) — 공공 API 조회값만 받는다.
  c.requireField('F04-PROPERTY-ADDRESS', '매물 도로명 주소', p.address, PUBLIC, research, nonEmptyText);
  c.requireField('F04-PROPERTY-JIBUN', '매물 지번 주소', p.jibunAddress, PUBLIC, research, nonEmptyText);

  c.requireField('F04-PROPERTY-REGION', '수도권/비수도권 구분', p.region, PUBLIC, research,
    oneOf(['CAPITAL', 'NON_CAPITAL'] as const));

  c.requireField('F04-PROPERTY-TYPE', '주택 유형', p.propertyType, PUBLIC, research,
    oneOf(['APT', 'MULTI_UNIT', 'DETACHED', 'OFFICETEL', 'OUT_OF_SCOPE'] as const));

  c.requireField('F04-PROPERTY-MULTIFAMILY', '다가구 여부', p.isMultiFamily, PUBLIC, research, isBoolean);

  // 위반건축물 표시는 건축HUB 공개 API에 없다 → 사용자가 건축물대장을 열람해 직접 확인해야 한다.
  c.requireField(
    'F04-PROPERTY-ILLEGAL', '위반건축물 표시 여부', p.isIllegalBuilding, CONFIRMED,
    '정부24 또는 세움터에서 건축물대장을 열람해 상단의 위반건축물 표시 여부를 확인한 뒤 3단계에서 선택해 주세요.',
    isBoolean,
  );
}

function checkRegistry(c: IssueCollector, registry: RegistryInfo | undefined, ctx: DateContext) {
  if (!registry) {
    c.missing(
      'F04-REGISTRY', '등기사항전부증명서 확인',
      '등기사항전부증명서가 업로드·확인되지 않았습니다 — 소유자·근저당·권리침해를 판정할 수 없습니다.',
      "3단계에서 등기사항전부증명서를 업로드하고 추출 결과를 원본과 대조한 뒤 '확인 완료'를 눌러 주세요.",
    );
    return;
  }
  const back = "3단계 등기부 확인 항목에서 '수정하기'를 눌러 값을 채운 뒤 다시 확인 완료해 주세요.";

  // 등기부 항목은 예외 없이 "문서를 열람해 고객이 확인한 값"만 받는다.
  // 자기신고로 들어온 소유자·근저당·권리침해는 판정 근거가 될 수 없다.
  c.requireField('F04-REGISTRY-DOC-ADDRESS', '등기부 소재지', registry.documentAddress, CONFIRMED, back, nonEmptyText);

  const addressMatch = registry.addressMatch;
  const matchOk = c.requireField(
    'F04-REGISTRY-ADDRESS-MATCH', '등기부 소재지·매물 주소 일치 여부', addressMatch, CONFIRMED,
    '등기부 표제부의 소재지와 선택한 매물 주소가 같은 건물인지 대조한 뒤 선택해 주세요.',
    oneOf(['MATCHED', 'NOT_MATCHED'] as const),
  );
  if (matchOk && addressMatch && addressMatch.value === 'NOT_MATCHED') {
    c.conflict(
      'F04-REGISTRY-ADDRESS-CONFLICT', '등기부 소재지·매물 주소 불일치',
      '업로드한 등기사항전부증명서의 소재지가 선택한 매물 주소와 다릅니다 — 다른 건물의 등기부입니다.',
      '계약하려는 매물의 등기사항전부증명서를 다시 발급받아 업로드해 주세요. 주소를 잘못 선택했다면 매물 주소부터 다시 검색해 주세요.',
      [`등기부 소재지 대조 결과 (${SOURCE_KO[addressMatch.source]})`],
    );
  }

  c.requireField('F04-REGISTRY-OWNER-MATCH', '소유자·임대인 일치 여부', registry.ownerMatch, CONFIRMED, back,
    oneOf(['MATCHED', 'MATCHED_PARTIAL_CO_OWNERS', 'NOT_MATCHED'] as const));

  c.requireField('F04-REGISTRY-RIGHTS', '권리침해 기재 여부', registry.hasRightsViolation, CONFIRMED, back, isBoolean);

  // 근저당이 하나도 없어 0원인 것과, 못 읽어서 모르는 것은 다르다.
  // 고객이 '금액 확인됨 0원'으로 확인했다면 충분한 자료로 본다.
  c.requireField('F04-REGISTRY-LIEN', '선순위채권(근저당) 설정액 합계', registry.seniorLienTotal, CONFIRMED, back,
    (v) => finiteNumber(v) ?? (v >= 0 ? null : '음수입니다.'));

  const issued = registry.issuedDate;
  const issuedOk = c.requireField(
    'F04-REGISTRY-ISSUED', '등기사항전부증명서 발급일', issued, CONFIRMED,
    '등기부 문서에 인쇄된 발급일(열람일시)을 3단계에서 입력해 주세요.',
    isoDate,
  );
  if (issuedOk && issued) {
    const age = daysBetween(issued.value, ctx.today);
    const used = [`발급일 ${issued.value} (${SOURCE_KO[issued.source]})`];
    if (age < 0) {
      c.conflict(
        'F04-REGISTRY-ISSUED-FUTURE', '등기사항전부증명서 발급일',
        `발급일(${issued.value})이 오늘(${ctx.today})보다 미래입니다 — 값이 잘못 입력되었습니다.`,
        '등기부에 인쇄된 발급일을 다시 확인해 입력해 주세요.',
        used,
      );
    } else if (age > ctx.issuedWithinDays) {
      c.conflict(
        'F04-REGISTRY-ISSUED-STALE', '등기사항전부증명서 발급일',
        `발급일(${issued.value})로부터 ${age}일 지났습니다 — 기준 ${ctx.issuedWithinDays}일 이내가 아니어서 현재 권리관계를 반영한다고 볼 수 없습니다.`,
        '인터넷등기소에서 등기사항전부증명서를 새로 발급받아 다시 업로드해 주세요.',
        used,
      );
    }
  }
}

// ---------- 진입점 ----------

/**
 * F04 진단자료 충분성 검사. 이슈가 하나도 없으면 빈 배열을 돌려준다.
 * 등기부 발급일 검사 때문에 '오늘'에 의존한다 — 재현이 필요하면 opts.today로 고정하라.
 */
export function validateDiagnosticSufficiency(
  diag: DiagnosisCase,
  opts: SufficiencyOptions = {},
): SufficiencyIssue[] {
  const ctx: DateContext = {
    issuedWithinDays: opts.issuedWithinDays ?? DEFAULT_ISSUED_WITHIN_DAYS,
    today: opts.today && isIsoDate(opts.today) ? opts.today : todayInSeoul(),
  };

  const c = new IssueCollector();
  checkApplicant(c, diag);
  checkContract(c, diag, ctx.today);
  checkProperty(c, diag);
  checkRegistry(c, diag.registry, ctx);
  return c.issues;
}

const SUFFICIENCY_OK: CheckResult = {
  ruleId: 'F04-OK',
  layer: 'SUFFICIENCY',
  label: '진단자료 충분성 검사',
  verdict: 'NO_PUBLIC_CONFLICT_FOUND',
  reason: '판정에 필요한 입력값·출처·등기사항전부증명서 최신성이 모두 확인되어 요건 대조를 진행했습니다.',
  usedValues: [],
  sourceUrl: '',
  effectiveFrom: '',
  nextAction: '',
};

/**
 * F04 이슈를 결과 카드로 변환한다.
 * 부족이든 상충이든 판정 언어는 MISSING_INFORMATION(자료 부족) 하나로 통일한다 —
 * 상충은 "공개요건과 충돌"이 아니라 "이 자료로는 판정할 수 없다"는 뜻이기 때문이다.
 */
export function toSufficiencyResults(issues: SufficiencyIssue[]): CheckResult[] {
  if (issues.length === 0) return [SUFFICIENCY_OK];
  return issues.map((i) => ({
    ruleId: i.id,
    layer: 'SUFFICIENCY' as const,
    label: i.label,
    verdict: 'MISSING_INFORMATION' as const,
    reason: i.reason,
    usedValues: i.usedValues,
    sourceUrl: '',
    effectiveFrom: '',
    nextAction: i.nextAction,
  }));
}
