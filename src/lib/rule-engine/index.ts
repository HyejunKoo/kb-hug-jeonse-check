// src/lib/rule-engine/index.ts — 엔진 본체
// 절대 규칙: 판정은 여기서만. 동일 입력 + 동일 규칙팩 버전 → 항상 동일 결과
import type { DiagnosisCase, RulePack, CheckResult, PathResult } from '@/types';
import { CHECKERS } from './evaluator';

// ---------- 엔진 본체 ----------

export function runRulePack(diag: DiagnosisCase, pack: RulePack): PathResult {
  const results: CheckResult[] = pack.rules.map((rule) => {
    const checker = CHECKERS[rule.checkId];
    if (!checker) {
      return {
        ruleId: rule.ruleId, layer: rule.layer, label: rule.label,
        verdict: 'MISSING_INFORMATION',
        reason: `checkId '${rule.checkId}' 미구현 — 규칙팩과 엔진 버전 불일치`,
        usedValues: [], sourceUrl: rule.sourceUrl,
        effectiveFrom: rule.effectiveFrom, nextAction: '',
      };
    }
    const out = checker(diag, rule.params);
    return {
      ruleId: rule.ruleId, layer: rule.layer, label: rule.label,
      verdict: out.verdict, reason: out.reason, usedValues: out.usedValues,
      sourceUrl: rule.sourceUrl, effectiveFrom: rule.effectiveFrom,
      nextAction: out.nextAction,
    };
  });

  const unmetProduct = results.some(r => r.layer === 'PRODUCT' && r.verdict === 'PUBLIC_REQUIREMENT_UNMET');
  const unmetGuarantee = results.some(r => r.layer === 'GUARANTEE' && r.verdict === 'PUBLIC_REQUIREMENT_UNMET');
  const blockedAt = unmetProduct ? 'PRODUCT' : unmetGuarantee ? 'GUARANTEE' : 'NONE';

  return {
    path: 'KB_STAR_HUG',
    pathLabel: 'KB스타 전세자금대출 (HUG)',
    blockedAt,
    results,
    officialReviewCount: results.filter(r => r.verdict === 'OFFICIAL_REVIEW_REQUIRED').length,
  };
}

/** 주소 문자열에서 수도권/비수도권 파싱 (F02) */
export function parseRegion(address: string): 'CAPITAL' | 'NON_CAPITAL' | undefined {
  if (!address.trim()) return undefined;
  const capital = ['서울', '경기', '인천'];
  return capital.some(k => address.includes(k)) ? 'CAPITAL' : 'NON_CAPITAL';
}
