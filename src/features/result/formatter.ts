// src/features/result/formatter.ts — 판정 결과 표시·리포트 템플릿 (후속 에이전트 담당)
import type { ActionPlan, DiagnosisCase, Field, PathResult, RuleLayer, Verdict } from '@/types';
import { SOURCE_KO } from '@/lib/rule-engine/sufficiency';
import { ACTION_CATEGORY_KO, groupActionItems } from './action-plan';

/** 결과 화면·리포트에 층을 노출하는 순서 — 자료 충분성이 먼저다 */
export const LAYER_ORDER: readonly RuleLayer[] = ['SUFFICIENCY', 'PRODUCT', 'GUARANTEE'];

export const LAYER_KO: Record<RuleLayer, string> = {
  SUFFICIENCY: '진단자료 충분성 검사',
  PRODUCT: '1층 · KB 상품요건',
  GUARANTEE: '2층 · HUG 보증요건',
};

export const BLOCKED_KO: Record<PathResult['blockedAt'], string> = {
  NONE: '막힌 단계 없음',
  PRODUCT: '1층 · KB 상품요건에서 막힘',
  GUARANTEE: '2층 · HUG 보증요건에서 막힘',
  INSUFFICIENT: '자료 부족으로 판정 보류',
  ACTION_REQUIRED: 'HUG 보증 실행 전 선행조치 필요',
};

export const VERDICT_KO: Record<Verdict, string> = {
  PUBLIC_REQUIREMENT_UNMET: '공개요건 미충족',
  NO_PUBLIC_CONFLICT_FOUND: '확인된 충돌 없음',
  MISSING_INFORMATION: '자료 부족',
  POST_CONTRACT_REQUIREMENT: '계약 후 충족 요건',
  PRE_GUARANTEE_ACTION_REQUIRED: '보증 전 선행조치 필요',
  OFFICIAL_REVIEW_REQUIRED: '공식 심사 필요',
};

export const VERDICT_BADGE: Record<Verdict, string> = {
  PUBLIC_REQUIREMENT_UNMET: 'bg-red-50 text-red-700 border-red-200',
  NO_PUBLIC_CONFLICT_FOUND: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  MISSING_INFORMATION: 'bg-amber-50 text-amber-700 border-amber-200',
  POST_CONTRACT_REQUIREMENT: 'bg-sky-50 text-sky-700 border-sky-200',
  PRE_GUARANTEE_ACTION_REQUIRED: 'bg-orange-50 text-orange-700 border-orange-200',
  OFFICIAL_REVIEW_REQUIRED: 'bg-slate-100 text-slate-600 border-slate-300',
};

/** 카드 좌측 액센트 바 색 */
export const VERDICT_ACCENT: Record<Verdict, string> = {
  PUBLIC_REQUIREMENT_UNMET: 'bg-red-500',
  NO_PUBLIC_CONFLICT_FOUND: 'bg-emerald-500',
  MISSING_INFORMATION: 'bg-amber-400',
  POST_CONTRACT_REQUIREMENT: 'bg-sky-400',
  PRE_GUARANTEE_ACTION_REQUIRED: 'bg-orange-500',
  OFFICIAL_REVIEW_REQUIRED: 'bg-slate-400',
};

/** 판정 언어 한 줄 설명 (결과 화면 범례) */
export const VERDICT_DESC: Record<Verdict, string> = {
  PUBLIC_REQUIREMENT_UNMET: '공개된 요건과 입력값이 충돌합니다.',
  NO_PUBLIC_CONFLICT_FOUND:
    '공개 요건과 대조했을 때 걸리는 항목이 발견되지 않았습니다. 승인 의미가 아닙니다.',
  MISSING_INFORMATION: '판정에 필요한 값이 확보되지 않았습니다.',
  POST_CONTRACT_REQUIREMENT: '계약 이후 절차에서 충족해야 하는 요건입니다.',
  PRE_GUARANTEE_ACTION_REQUIRED:
    '현재 상태로는 보증을 실행할 수 없어 이전·말소 등 선행조치가 필요합니다.',
  OFFICIAL_REVIEW_REQUIRED: '계약 전 확인이 불가해 기관의 공식 심사가 필요합니다.',
};

// ---------- 입력값·출처 요약 (F11 리포트용) ----------

const KO = {
  householdHead: { YES: '세대주', NO: '세대원', PLANNED: '세대주 예정' },
  homeCount: { 0: '무주택', 1: '1채', 2: '2채 이상' },
  maritalStatus: { SINGLE: '미혼', MARRIED: '기혼', PLANNED: '결혼 예정' },
  incomeBand: {
    UNDER_50M: '5천만원 이하', B50_60M: '5천~6천만원', B60_70M: '6천~7천만원',
    OVER_70M: '7천만원 초과', UNKNOWN: '모름',
  },
  incomeType: { EMPLOYED: '근로소득', SELF_EMPLOYED: '사업소득', NO_INCOME: '무소득' },
  existingJeonseLoan: { NONE: '없음', HAS_ONE: '1건', HAS_MULTIPLE: '2건 이상' },
  region: { CAPITAL: '수도권', NON_CAPITAL: '비수도권' },
  ownerMatch: {
    MATCHED: '일치', MATCHED_PARTIAL_CO_OWNERS: '공동소유자 중 일부만 임대인', NOT_MATCHED: '불일치',
  },
  addressMatch: { MATCHED: '일치', NOT_MATCHED: '불일치' },
  ownerType: { INDIVIDUAL: '개인', CORPORATION: '법인' },
} as const;

const eok = (n: number) => (Number.isFinite(n) ? `${(n / 100000000).toFixed(2)}억원` : '');

/**
 * `- 라벨: 값 (출처)` 한 줄. 값이 없으면 줄 자체를 만들지 않는다 (없는 값을 지어내지 않기 위해).
 *
 * diagnosis는 /api/report 요청 본문으로도 들어오는 선택 필드라 모양을 보장할 수 없다.
 * 값·출처·표기 중 하나라도 못 읽으면 'undefined'가 박힌 줄을 내보내는 대신 줄을 뺀다 —
 * 상담 창구에서 읽는 문서라 빈 줄이 잘못된 값보다 낫다.
 */
function line<T>(label: string, field: Field<T> | undefined, render: (v: T) => string): string | null {
  if (!field || typeof field !== 'object') return null;
  const { value, source } = field;
  if (value === undefined || value === null) return null;
  if (!Object.prototype.hasOwnProperty.call(SOURCE_KO, source)) return null;
  const rendered = render(value);
  if (typeof rendered !== 'string' || rendered.trim() === '') return null;
  return `- ${label}: ${rendered} (${SOURCE_KO[source]})`;
}

/**
 * 판정에 실제로 쓰인 입력값과 그 출처를 그대로 나열한다.
 * 실명·주민번호 같은 개인정보는 애초에 DiagnosisCase에 담기지 않는다 (등기부도 대조 결과만 저장).
 */
export function buildInputSummary(diag: DiagnosisCase): string[] {
  const { applicant: a, contract: k, property: p, registry: g } = diag;
  const rows: (string | null)[] = [
    `### 신청인 (본인 신고값)`,
    line('연령', a?.age, (v) => `만 ${v}세`),
    line('세대주 상태', a?.householdHead, (v) => KO.householdHead[v]),
    line('주택 보유', a?.homeCount, (v) => KO.homeCount[v]),
    line('혼인 상태', a?.maritalStatus, (v) => KO.maritalStatus[v]),
    line('연소득 구간', a?.incomeBand, (v) => KO.incomeBand[v]),
    line('소득 유형', a?.incomeType, (v) => KO.incomeType[v]),
    line('기존 전세자금대출', a?.existingJeonseLoan, (v) => KO.existingJeonseLoan[v]),

    ``,
    `### 예정 계약`,
    line('예정 보증금', k?.deposit, eok),
    line('계약기간', k?.termMonths, (v) => `${v}개월`),
    line('입주 예정일', k?.moveInDate, (v) => v),
    line('공인중개사 중개', k?.brokered, (v) => (v ? '중개' : '직거래')),

    ``,
    `### 매물`,
    line('도로명 주소', p?.address, (v) => v),
    line('지번 주소', p?.jibunAddress, (v) => v),
    line('지역 구분', p?.region, (v) => KO.region[v]),
    line('주택 유형', p?.propertyType, (v) => p.propertyTypeLabel ?? v),
    line('건축물대장 주용도', p?.buildingUse, (v) => v),
    line('전용면적', p?.exclusiveArea, (v) => `${v}㎡`),
    line('다가구 여부', p?.isMultiFamily, (v) => (v ? '다가구' : '다가구 아님')),
    line('위반건축물 표시', p?.isIllegalBuilding, (v) => (v ? '표시 있음' : '표시 없음')),
    line('공식 주택가격', p?.housingPrice, eok),
  ];

  if (g) {
    rows.push(
      ``,
      `### 등기사항전부증명서 확인 결과`,
      line('발급일', g.issuedDate, (v) => v),
      line('등기부 소재지', g.documentAddress, (v) => v),
      line('소재지·매물 주소 대조', g.addressMatch, (v) => KO.addressMatch[v]),
      line('소유자·임대인 대조', g.ownerMatch, (v) => KO.ownerMatch[v]),
      line('소유자 유형', g.ownerType, (v) => KO.ownerType[v]),
      line('선순위채권(근저당) 합계', g.seniorLienTotal, eok),
      line('선순위 임차보증금 합계', g.seniorLeaseDepositTotal, eok),
      line('권리침해 기재', g.hasRightsViolation, (v) => (v ? '있음' : '없음')),
      line('기존 전세권 설정', g.existingLeaseholdRights, (v) => (v ? '있음' : '없음')),
    );
  } else {
    rows.push(``, `### 등기사항전부증명서 확인 결과`, `- 확인된 등기부가 없습니다.`);
  }

  return rows.filter((r): r is string => r !== null);
}

/** F10 다음 행동을 카테고리별로 나열한다 */
export function buildActionPlanLines(plan: ActionPlan): string[] {
  const lines: string[] = [`## 다음 행동 (F10)`, plan.headline];
  if (plan.contractHoldRecommended) {
    lines.push(`※ 계약 보류 권고 — 아래 '계약 보류 권고' 항목이 해소되기 전에는 계약금을 지급하지 마세요.`);
  }
  if (plan.items.length === 0) {
    lines.push(``, `- 추가로 확인할 항목이 없습니다.`);
    return lines;
  }
  for (const group of groupActionItems(plan)) {
    lines.push(``, `### ${ACTION_CATEGORY_KO[group.category]}`);
    for (const item of group.items) {
      lines.push(`- ${item.title}: ${item.detail} (근거 ${item.sourceRuleIds.join(', ')})`);
    }
  }
  return lines;
}

export interface ReportTemplateContext {
  /** 판정에 쓰인 입력값·출처. 없으면 입력 요약 절을 넣지 않는다 */
  diagnosis?: DiagnosisCase;
  /** F10 다음 행동. 없으면 다음 행동 절을 넣지 않는다 */
  actionPlan?: ActionPlan;
}

/** LLM 없이도 항상 생성되는 결정론적 리포트 (Gemini 폴백 겸 입력) */
export function buildReportTemplate(
  results: PathResult[],
  ctx: ReportTemplateContext = {},
): string {
  const lines: string[] = [
    `# KB 상담용 사전점검 요약`,
    `대조 경로: ${results.length}개`,
    ``,
    `※ 경로 간 순위·추천이 아니라 각 공개요건과 입력값의 독립 대조 결과입니다.`,
  ];

  if (ctx.diagnosis) {
    lines.push(``, `## 판정에 사용한 입력값과 출처`, ...buildInputSummary(ctx.diagnosis));
  }
  for (const r of results) {
    lines.push(
      ``,
      `## ${r.pathLabel}`,
      `보증기관: ${r.guaranteeLabel}`,
      `막힌 단계: ${BLOCKED_KO[r.blockedAt]}`,
      `공식 심사 필요: ${r.officialReviewCount}건`,
    );
    if (r.blockedAt === 'INSUFFICIENT') {
      lines.push(
        ``,
        `※ 진단에 필요한 자료가 부족하거나 서로 맞지 않아 KB 상품요건·HUG 보증요건 대조는 실행하지 않았습니다.`,
        `   아래 보완 항목을 채운 뒤 다시 진단해야 층별 판정을 볼 수 있습니다.`,
      );
    }

    lines.push(``, `### 판정 상세`);
    for (const layer of LAYER_ORDER) {
      const rows = r.results.filter((c) => c.layer === layer);
      if (rows.length === 0) continue;
      lines.push(``, `#### ${LAYER_KO[layer]}`);
      for (const c of rows) {
        lines.push(`- [${VERDICT_KO[c.verdict]}] ${c.label}: ${c.reason}`);
        if (c.nextAction) lines.push(`  → 다음 행동: ${c.nextAction}`);
      }
    }
  }

  if (ctx.actionPlan) lines.push(``, ...buildActionPlanLines(ctx.actionPlan));

  lines.push(``, `※ '확인된 충돌 없음'은 승인·보증 가능을 의미하지 않습니다.`);
  return lines.join('\n');
}
