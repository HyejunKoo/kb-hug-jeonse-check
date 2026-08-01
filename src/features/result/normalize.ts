import type { CheckResult, GuaranteeProvider, PathId, PathResult, RuleLayer, Verdict } from '@/types';

function providerFromPath(path: string): GuaranteeProvider {
  if (path.includes('SGI')) return 'SGI';
  if (path.includes('HF') || path.includes('YOUTH')) return 'HF';
  return 'HUG';
}

/** 신규 배열 저장 형식과 기존 HUG 단일 객체 형식을 모두 읽는다. */
export function normalizeStoredResults(value: unknown): PathResult[] {
  const candidates = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? [value]
      : [];
  return candidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const result = candidate as PathResult;
    if (!result.path || !Array.isArray(result.results)) return [];
    const provider = result.guaranteeProvider ?? providerFromPath(result.path);
    return [
      {
        ...result,
        guaranteeProvider: provider,
        guaranteeLabel: result.guaranteeLabel ?? provider,
      },
    ];
  });
}

// ---------- 요청 본문 검증 (API 경계) ----------
//
// normalizeStoredResults 와 같은 정책이다 — 읽을 수 있는 행만 살리고 나머지는 버린다.
// 한 행이 깨졌다고 요청 전체를 거절하지 않는다.
//
// 아래 Record<T, true> 들은 값 목록을 타입과 묶어둔 것이다 — 판정 언어·층·경로가 늘어나면
// 여기서 컴파일이 깨지므로 검증기를 갱신하는 것을 잊을 수 없다.

const VALID_PATH: Record<PathId, true> = {
  KB_STAR_HUG: true, KB_STAR_HF: true, KB_STAR_SGI: true, KB_YOUTH_HF: true,
};
const VALID_PROVIDER: Record<GuaranteeProvider, true> = { HUG: true, HF: true, SGI: true };
const VALID_BLOCKED_AT: Record<PathResult['blockedAt'], true> = {
  NONE: true, PRODUCT: true, GUARANTEE: true, INSUFFICIENT: true, ACTION_REQUIRED: true,
};
const VALID_LAYER: Record<RuleLayer, true> = {
  SUFFICIENCY: true, PRODUCT: true, GUARANTEE: true,
};
const VALID_VERDICT: Record<Verdict, true> = {
  PUBLIC_REQUIREMENT_UNMET: true,
  NO_PUBLIC_CONFLICT_FOUND: true,
  MISSING_INFORMATION: true,
  POST_CONTRACT_REQUIREMENT: true,
  PRE_GUARANTEE_ACTION_REQUIRED: true,
  OFFICIAL_REVIEW_REQUIRED: true,
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isText = (v: unknown): v is string => typeof v === 'string';

const isOneOf = <T extends string>(v: unknown, allowed: Record<T, true>): v is T =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(allowed, v);

/** 선택 필드는 없거나(undefined) 문자열이어야 한다 — null·숫자로 들어오면 거절한다 */
const isOptionalText = (v: unknown): boolean => v === undefined || isText(v);

function isCheckResult(value: unknown): value is CheckResult {
  if (!isRecord(value)) return false;
  return (
    isText(value.ruleId) &&
    isText(value.label) &&
    isText(value.reason) &&
    isText(value.nextAction) &&
    isOneOf(value.layer, VALID_LAYER) &&
    isOneOf(value.verdict, VALID_VERDICT) &&
    Array.isArray(value.usedValues) &&
    value.usedValues.every(isText) &&
    isOptionalText(value.sourceUrl) &&
    isOptionalText(value.effectiveFrom) &&
    (value.sourceEvidence === undefined ||
      (Array.isArray(value.sourceEvidence) && value.sourceEvidence.every(isText)))
  );
}

function isPathResult(value: unknown): value is PathResult {
  if (!isRecord(value)) return false;
  return (
    isOneOf(value.path, VALID_PATH) &&
    isText(value.pathLabel) &&
    isText(value.guaranteeLabel) &&
    isOneOf(value.guaranteeProvider, VALID_PROVIDER) &&
    isOneOf(value.blockedAt, VALID_BLOCKED_AT) &&
    typeof value.officialReviewCount === 'number' &&
    Number.isFinite(value.officialReviewCount) &&
    Array.isArray(value.results) &&
    value.results.every(isCheckResult)
  );
}

/**
 * 요청 본문의 판정 결과에서 형식이 맞는 행만 골라낸다.
 * 배열이 아니거나 살아남은 행이 하나도 없으면 빈 배열 — 호출부(API 라우트)가 400으로 돌려준다.
 */
export function filterValidPathResults(value: unknown): PathResult[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isPathResult);
}

export function aggregateBlockedAt(results: PathResult[]): PathResult['blockedAt'] {
  if (results.some((result) => result.blockedAt === 'NONE')) return 'NONE';
  if (results.some((result) => result.blockedAt === 'ACTION_REQUIRED')) return 'ACTION_REQUIRED';
  if (results.some((result) => result.blockedAt === 'INSUFFICIENT')) return 'INSUFFICIENT';
  if (results.some((result) => result.blockedAt === 'GUARANTEE')) return 'GUARANTEE';
  return 'PRODUCT';
}
