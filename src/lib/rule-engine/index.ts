// src/lib/rule-engine/index.ts — 엔진 본체
// 절대 규칙: 판정은 여기서만. 동일 입력 + 동일 규칙팩 버전 → 항상 동일 결과
import type {
  DiagnosisCase,
  RulePack,
  CheckResult,
  PathResult,
  PathId,
  GuaranteeProvider,
} from '@/types';
import { CHECKERS } from './evaluator';

// ---------- 엔진 본체 ----------

export interface PathDefinition {
  path: PathId;
  pathLabel: string;
  guaranteeProvider: GuaranteeProvider;
  guaranteeLabel: string;
}

export const PATH_DEFINITIONS: readonly PathDefinition[] = [
  {
    path: 'KB_STAR_HUG',
    pathLabel: 'KB스타 전세자금대출 (HUG)',
    guaranteeProvider: 'HUG',
    guaranteeLabel: '주택도시보증공사(HUG)',
  },
  {
    path: 'KB_STAR_HF',
    pathLabel: 'KB스타 전세자금대출 (HF)',
    guaranteeProvider: 'HF',
    guaranteeLabel: '한국주택금융공사(HF)',
  },
  {
    path: 'KB_STAR_SGI',
    pathLabel: 'KB스타 전세자금대출 (SGI)',
    guaranteeProvider: 'SGI',
    guaranteeLabel: '서울보증보험(SGI)',
  },
  {
    path: 'KB_YOUTH_HF',
    pathLabel: 'KB 청년 맞춤형 전세자금대출',
    guaranteeProvider: 'HF',
    guaranteeLabel: '한국주택금융공사(HF)',
  },
] as const;

export function runRulePack(
  diag: DiagnosisCase,
  pack: RulePack,
  path: PathId = 'KB_STAR_HUG',
): PathResult {
  const definition = PATH_DEFINITIONS.find((item) => item.path === path);
  if (!definition) throw new Error(`정의되지 않은 상품 경로: ${path}`);

  const results: CheckResult[] = pack.rules
    .filter((rule) => rule.paths.includes(path))
    .map((rule) => {
      const checker = CHECKERS[rule.checkId];
      if (!checker) {
        return {
          ruleId: rule.ruleId,
          layer: rule.layer,
          label: rule.label,
          verdict: 'MISSING_INFORMATION',
          reason: `checkId '${rule.checkId}' 미구현 — 규칙팩과 엔진 버전 불일치`,
          usedValues: [],
          sourceUrl: rule.sourceUrl,
          effectiveFrom: rule.effectiveFrom,
          nextAction: '',
        };
      }
      const out = checker(diag, rule.params);
      return {
        ruleId: rule.ruleId,
        layer: rule.layer,
        label: rule.label,
        verdict: out.verdict,
        reason: out.reason,
        usedValues: out.usedValues,
        sourceUrl: rule.sourceUrl,
        effectiveFrom: rule.effectiveFrom,
        nextAction: out.nextAction,
      };
    });

  const unmetProduct = results.some(
    (r) => r.layer === 'PRODUCT' && r.verdict === 'PUBLIC_REQUIREMENT_UNMET',
  );
  const unmetGuarantee = results.some(
    (r) => r.layer === 'GUARANTEE' && r.verdict === 'PUBLIC_REQUIREMENT_UNMET',
  );
  const hasMissingInfo = results.some((r) => r.verdict === 'MISSING_INFORMATION');
  // 요건 미충족이 확인되면 그게 우선이고, 위반은 없지만 자료가 부족하면 "판정 보류"로 요약한다.
  // (전에는 자료 부족이 있어도 항상 NONE으로 떨어져 요약 배너가 "막힌 단계 없음"으로 잘못 보였다.)
  const blockedAt = unmetProduct
    ? 'PRODUCT'
    : unmetGuarantee
      ? 'GUARANTEE'
      : hasMissingInfo
        ? 'INSUFFICIENT'
        : 'NONE';

  return {
    ...definition,
    blockedAt,
    results,
    officialReviewCount: results.filter((r) => r.verdict === 'OFFICIAL_REVIEW_REQUIRED').length,
  };
}

/** 같은 입력을 4개 상품×보증기관 경로에 독립적으로 대조한다. */
export function runAllRulePacks(diag: DiagnosisCase, pack: RulePack): PathResult[] {
  return PATH_DEFINITIONS.map(({ path }) => runRulePack(diag, pack, path));
}

/** 주소 문자열에서 수도권/비수도권 파싱 (F02) */
export function parseRegion(address: string): 'CAPITAL' | 'NON_CAPITAL' | undefined {
  if (!address.trim()) return undefined;
  const capital = ['서울', '경기', '인천'];
  return capital.some((k) => address.includes(k)) ? 'CAPITAL' : 'NON_CAPITAL';
}
