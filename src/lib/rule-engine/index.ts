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

/** 현재 MVP에서 실제 판정·노출하는 단일 경로. 과거 저장 결과 호환을 위해 전체 정의는 유지한다. */
export const MVP_PATHS: readonly PathId[] = ['KB_STAR_HUG'] as const;

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
        ruleOrigin: rule.origin,
        verifiedAt: rule.verifiedAt,
        sourceContentSha256: rule.sourceContentSha256,
        sourceEvidence: rule.sourceEvidence,
        nextAction: out.nextAction,
      };
    });

  const unmetProduct = results.some(
    (r) => r.layer === 'PRODUCT' && r.verdict === 'PUBLIC_REQUIREMENT_UNMET',
  );
  const unmetGuarantee = results.some(
    (r) => r.layer === 'GUARANTEE' && r.verdict === 'PUBLIC_REQUIREMENT_UNMET',
  );
  const hasPreGuaranteeAction = results.some(
    (r) => r.verdict === 'PRE_GUARANTEE_ACTION_REQUIRED',
  );
  const hasMissingInfo = results.some((r) => r.verdict === 'MISSING_INFORMATION');
  // 확정 충돌이 최우선이고, 해결 가능한 보증 전 선행조치는 자료 부족보다 먼저 노출한다.
  // (전에는 자료 부족이 있어도 항상 NONE으로 떨어져 요약 배너가 "막힌 단계 없음"으로 잘못 보였다.)
  const blockedAt = unmetProduct
    ? 'PRODUCT'
    : unmetGuarantee
      ? 'GUARANTEE'
      : hasPreGuaranteeAction
        ? 'ACTION_REQUIRED'
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

/** HUG-only MVP 경로를 판정한다. */
export function runAllRulePacks(diag: DiagnosisCase, pack: RulePack): PathResult[] {
  return MVP_PATHS.map((path) => runRulePack(diag, pack, path));
}

/** 주소 문자열에서 수도권/비수도권 파싱 (F02) */
export function parseRegion(address: string): 'CAPITAL' | 'NON_CAPITAL' | undefined {
  if (!address.trim()) return undefined;
  const capital = ['서울', '경기', '인천'];
  return capital.some((k) => address.includes(k)) ? 'CAPITAL' : 'NON_CAPITAL';
}
