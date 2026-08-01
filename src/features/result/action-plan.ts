// ============================================================
// src/features/result/action-plan.ts — F10 다음 행동 묶음 (순수 함수만)
//
// 새 판정을 만들지 않는다. 규칙엔진·F04가 이미 만든 CheckResult.nextAction 문구를
// "누구에게 무엇을 확인해야 하는가"로 재분류해 묶을 뿐이다.
// 같은 pathResults → 항상 같은 ActionPlan (결정론). 그래서 저장하지 않고 매번 다시 계산한다.
//
// MVP 범위: KB_STAR_HUG 단일 경로. "4개 경로 모두 미충족이면 계약 보류"는 다중 경로
// 비교가 도입되는 후속 작업의 몫이고, 여기서는 HUG 한 경로의 확정 충돌만 본다.
// ============================================================
import type {
  ActionCategory,
  ActionItem,
  ActionPlan,
  ActionSeverity,
  CheckResult,
  PathResult,
  Verdict,
} from '@/types';

/** 화면·리포트에 카테고리를 노출하는 순서 — 계약 보류가 가장 먼저다 */
export const ACTION_CATEGORY_ORDER: readonly ActionCategory[] = [
  'CONTRACT_HOLD',
  'SUPPLEMENTAL_DOCUMENT',
  'LANDLORD_CONFIRMATION',
  'BROKER_CONFIRMATION',
  'KB_QUESTION',
];

export const ACTION_CATEGORY_KO: Record<ActionCategory, string> = {
  CONTRACT_HOLD: '계약 보류 권고',
  SUPPLEMENTAL_DOCUMENT: '추가 제출·보완 자료',
  LANDLORD_CONFIRMATION: '임대인 확인사항',
  BROKER_CONFIRMATION: '중개사 확인사항',
  KB_QUESTION: 'KB 상담 질문',
};

export const ACTION_CATEGORY_DESC: Record<ActionCategory, string> = {
  CONTRACT_HOLD: '공개요건과 충돌이 확인된 항목입니다. 계약금을 지급하기 전에 멈추고 확인하세요.',
  SUPPLEMENTAL_DOCUMENT: '판정을 마치거나 심사에 제출하기 위해 더 확보해야 하는 자료입니다.',
  LANDLORD_CONFIRMATION: '계약 전에 임대인에게 직접 확인하거나 요청해야 하는 항목입니다.',
  BROKER_CONFIRMATION: '중개사·계약 방식과 관련해 확인해야 하는 항목입니다.',
  KB_QUESTION: '공개정보만으로는 판단할 수 없어 KB 상담에서 물어봐야 하는 항목입니다.',
};

/**
 * 이 항목이 미충족이면 계약 보류를 권고한다 — 계약 조건을 바꿔 해결할 수 있는 성격이 아니라
 * 목적물·권리관계 자체가 HUG 보증 대상에서 벗어나는 항목들이다.
 *
 * 규칙 id로 판별한다. 크롤러(lib/crawlers/hug.ts)와 폴백 JSON(src/rules/*.json)이 같은 id를
 * 쓰기 때문에 규칙팩 출처가 바뀌어도 결과가 달라지지 않는다. **규칙팩에 새 id를 추가하면
 * 여기도 함께 확인해야 한다** — 모르는 id는 보류가 아니라 일반 확인 액션으로 떨어진다.
 */
export const CONTRACT_HOLD_RULE_IDS: readonly string[] = [
  'HUG-PROPERTY-TYPE', // HUG 대상 외 주택유형
  'HUG-NOT-ILLEGAL-BUILDING', // 위반건축물
  'HUG-OWNER-MATCH', // 등기부 소유자 불일치
  'HUG-NO-RIGHTS-VIOLATION', // 권리침해 있음
  'HUG-COLLATERAL-RATIO', // HUG 담보인정비율 초과
  // 공통 보증 규칙팩(src/rules/guarantee-common.json)의 동일 의미 규칙
  'GUARANTEE-COMMON-TYPE',
  'GUARANTEE-COMMON-ILLEGAL',
  'GUARANTEE-COMMON-RIGHTS',
  'GUARANTEE-COMMON-OWNER',
];

/**
 * (규칙, 판정, 문구)를 카테고리로 보내는 표. 위에서부터 먼저 맞는 것 하나가 이긴다.
 * nextActionIncludes는 evaluator.ts가 정한 고정 문구를 그대로 가리킨다 —
 * 한 체크 함수가 판정은 같은데 상황별로 다른 행동을 안내하는 경우를 구분하기 위한 것이다.
 */
interface ActionRoute {
  ruleIds?: readonly string[];
  verdicts?: readonly Verdict[];
  layers?: readonly CheckResult['layer'][];
  nextActionIncludes?: string;
  category: ActionCategory;
  severity: ActionSeverity;
}

const ROUTES: readonly ActionRoute[] = [
  // 1) 확정 충돌 중 목적물·권리관계에서 막힌 것 → 계약 보류
  {
    ruleIds: CONTRACT_HOLD_RULE_IDS,
    verdicts: ['PUBLIC_REQUIREMENT_UNMET'],
    category: 'CONTRACT_HOLD',
    severity: 'critical',
  },

  // 2) F04 자료 부족·상충은 전부 "무엇을 더 확보해야 하는가"다
  {
    layers: ['SUFFICIENCY'],
    category: 'SUPPLEMENTAL_DOCUMENT',
    severity: 'warning',
  },

  // 3) 문구로만 구분되는 사례 — 같은 규칙·같은 판정인데 상대가 다르다
  {
    // 단독·다가구 담보인정비율: 계산에 필요한 값을 임대인에게 받아야 한다
    nextActionIncludes: '임대인에게',
    category: 'LANDLORD_CONFIRMATION',
    severity: 'warning',
  },
  {
    // 직거래 — 취급 가능 여부 확인 또는 중개 계약 검토
    nextActionIncludes: '중개 계약을 검토',
    category: 'BROKER_CONFIRMATION',
    severity: 'warning',
  },
  {
    nextActionIncludes: '임대인과 협의',
    category: 'LANDLORD_CONFIRMATION',
    severity: 'warning',
  },

  // 4) 판정 언어별 기본 분류
  {
    verdicts: ['MISSING_INFORMATION'],
    category: 'SUPPLEMENTAL_DOCUMENT',
    severity: 'warning',
  },
  {
    // 계약 후 충족 요건 — 지금 할 일은 증빙을 준비·보관하는 것이다
    verdicts: ['POST_CONTRACT_REQUIREMENT'],
    category: 'SUPPLEMENTAL_DOCUMENT',
    severity: 'info',
  },
  {
    verdicts: ['PRE_GUARANTEE_ACTION_REQUIRED'],
    category: 'KB_QUESTION',
    severity: 'warning',
  },
  {
    // 계약 보류 대상은 아니지만 이 경로로는 막힌 항목 (연령·보증금 한도 등)
    verdicts: ['PUBLIC_REQUIREMENT_UNMET'],
    category: 'KB_QUESTION',
    severity: 'warning',
  },
  {
    verdicts: ['OFFICIAL_REVIEW_REQUIRED'],
    category: 'KB_QUESTION',
    severity: 'info',
  },
];

const DEFAULT_ROUTE = { category: 'KB_QUESTION' as const, severity: 'info' as const };

function routeOf(r: CheckResult): { category: ActionCategory; severity: ActionSeverity } {
  const hit = ROUTES.find(
    (route) =>
      (!route.ruleIds || route.ruleIds.includes(r.ruleId)) &&
      (!route.verdicts || route.verdicts.includes(r.verdict)) &&
      (!route.layers || route.layers.includes(r.layer)) &&
      (!route.nextActionIncludes || r.nextAction.includes(route.nextActionIncludes)),
  );
  return hit ? { category: hit.category, severity: hit.severity } : DEFAULT_ROUTE;
}

/**
 * 규칙엔진이 안내하지 않는 "임대인에게 무엇을 요청해야 하는가"를 보완하는 파생 액션.
 * 새 요건·수치를 만들지 않고, 이미 나온 판정에 대해 상대만 바꿔 적는다.
 */
const DERIVED_LANDLORD_ACTIONS: Record<
  string,
  { verdict: Verdict; title: string; detail: string } | undefined
> = {
  'HUG-LEASEHOLD-TRANSFER': {
    verdict: 'PRE_GUARANTEE_ACTION_REQUIRED',
    title: '기존 전세권 말소·이전 협의',
    detail:
      '등기부에 남아 있는 기존 전세권을 계약 전에 말소하거나 HUG로 이전할 수 있는지, 가능한 시점이 언제인지 임대인에게 확인하세요.',
  },
};

/** 같은 문구의 행동은 하나로 합치고 규칙 id만 모은다 (KB 상품·HUG 보증에 같은 체크가 겹친다) */
function mergeItems(rows: Omit<ActionItem, 'id'>[]): ActionItem[] {
  const merged: Omit<ActionItem, 'id'>[] = [];
  for (const row of rows) {
    const same = merged.find(
      (m) => m.category === row.category && m.detail === row.detail,
    );
    if (same) {
      for (const ruleId of row.sourceRuleIds) {
        if (!same.sourceRuleIds.includes(ruleId)) same.sourceRuleIds.push(ruleId);
      }
      continue;
    }
    merged.push({ ...row, sourceRuleIds: [...row.sourceRuleIds] });
  }
  return merged.map((m) => ({ ...m, id: `${m.category}:${m.sourceRuleIds.join('+')}` }));
}

function buildHeadline(items: ActionItem[], results: CheckResult[], hold: boolean): string {
  if (hold) {
    return '계약금을 지급하기 전에 멈추세요 — 공개요건과 충돌이 확인된 항목이 있습니다.';
  }
  if (results.some((r) => r.layer === 'SUFFICIENCY' && r.verdict === 'MISSING_INFORMATION')) {
    return '판정에 필요한 자료가 아직 부족합니다 — 아래 항목을 채운 뒤 다시 진단하세요.';
  }
  if (results.some((r) => r.verdict === 'PUBLIC_REQUIREMENT_UNMET')) {
    return '이 경로의 공개요건과 충돌하는 항목이 있습니다 — 아래 항목을 KB 상담에서 확인하세요.';
  }
  if (results.some((r) => r.verdict === 'PRE_GUARANTEE_ACTION_REQUIRED')) {
    return 'HUG 보증을 실행하려면 먼저 해결해야 하는 선행조치가 있습니다.';
  }
  if (items.length > 0) {
    return '확인된 공개요건 충돌은 없습니다(승인 의미 아님) — 아래 항목을 준비해 KB 상담에서 확인하세요.';
  }
  return '추가로 확인할 항목이 없습니다 — 판정 상세를 그대로 KB 상담에 가져가세요.';
}

/**
 * F10. pathResults의 nextAction을 카테고리별로 묶어 "다음에 무엇을 하면 되는가"만 남긴다.
 * 판정 자체는 건드리지 않으며 pathResults에 없는 내용을 만들어내지 않는다.
 */
export function buildActionPlan(pathResults: PathResult[]): ActionPlan {
  const results = pathResults.flatMap((p) => p.results);

  const rows: Omit<ActionItem, 'id'>[] = [];
  for (const r of results) {
    if (r.nextAction.trim()) {
      const { category, severity } = routeOf(r);
      rows.push({
        category,
        severity,
        title: r.label,
        detail: r.nextAction,
        sourceRuleIds: [r.ruleId],
      });
    }

    const derived = DERIVED_LANDLORD_ACTIONS[r.ruleId];
    if (derived && r.verdict === derived.verdict) {
      rows.push({
        category: 'LANDLORD_CONFIRMATION',
        severity: 'warning',
        title: derived.title,
        detail: derived.detail,
        sourceRuleIds: [r.ruleId],
      });
    }
  }

  const merged = mergeItems(rows);
  const items = ACTION_CATEGORY_ORDER.flatMap((category) =>
    merged.filter((m) => m.category === category),
  );
  const contractHoldRecommended = items.some((i) => i.category === 'CONTRACT_HOLD');

  return {
    headline: buildHeadline(items, results, contractHoldRecommended),
    contractHoldRecommended,
    items,
  };
}

/** 카테고리별로 갈라 화면·리포트에서 섹션으로 쓴다 (비어 있는 카테고리는 빠진다) */
export function groupActionItems(plan: ActionPlan): { category: ActionCategory; items: ActionItem[] }[] {
  return ACTION_CATEGORY_ORDER.map((category) => ({
    category,
    items: plan.items.filter((i) => i.category === category),
  })).filter((g) => g.items.length > 0);
}
