// src/features/result/formatter.ts — 판정 결과 표시·리포트 템플릿 (후속 에이전트 담당)
import type { PathResult, Verdict } from '@/types';

export const VERDICT_KO: Record<Verdict, string> = {
  PUBLIC_REQUIREMENT_UNMET: '공개요건 미충족',
  NO_PUBLIC_CONFLICT_FOUND: '확인된 충돌 없음',
  MISSING_INFORMATION: '자료 부족',
  POST_CONTRACT_REQUIREMENT: '계약 후 충족 요건',
  OFFICIAL_REVIEW_REQUIRED: '공식 심사 필요',
};

export const VERDICT_BADGE: Record<Verdict, string> = {
  PUBLIC_REQUIREMENT_UNMET: 'bg-red-100 text-red-800 border-red-300',
  NO_PUBLIC_CONFLICT_FOUND: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  MISSING_INFORMATION: 'bg-amber-100 text-amber-800 border-amber-300',
  POST_CONTRACT_REQUIREMENT: 'bg-sky-100 text-sky-800 border-sky-300',
  OFFICIAL_REVIEW_REQUIRED: 'bg-slate-200 text-slate-800 border-slate-400',
};

/** LLM 없이도 항상 생성되는 결정론적 리포트 (Gemini 폴백 겸 입력) */
export function buildReportTemplate(r: PathResult): string {
  const lines: string[] = [
    `# KB 상담용 사전점검 요약`,
    `경로: ${r.pathLabel}`,
    `막힌 단계: ${r.blockedAt === 'NONE' ? '없음' : r.blockedAt === 'PRODUCT' ? '상품요건(1층)' : '보증요건(2층)'}`,
    `공식 심사 필요 항목: ${r.officialReviewCount}건`,
    ``,
    `## 판정 상세`,
  ];
  for (const c of r.results) {
    lines.push(`- [${VERDICT_KO[c.verdict]}] ${c.label}: ${c.reason}`);
    if (c.nextAction) lines.push(`  → 다음 행동: ${c.nextAction}`);
  }
  lines.push(``, `※ '확인된 충돌 없음'은 승인·보증 가능을 의미하지 않습니다.`);
  return lines.join('\n');
}
