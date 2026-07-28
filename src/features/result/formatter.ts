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
  PUBLIC_REQUIREMENT_UNMET: 'bg-red-50 text-red-700 border-red-200',
  NO_PUBLIC_CONFLICT_FOUND: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  MISSING_INFORMATION: 'bg-amber-50 text-amber-700 border-amber-200',
  POST_CONTRACT_REQUIREMENT: 'bg-sky-50 text-sky-700 border-sky-200',
  OFFICIAL_REVIEW_REQUIRED: 'bg-slate-100 text-slate-600 border-slate-300',
};

/** 카드 좌측 액센트 바 색 */
export const VERDICT_ACCENT: Record<Verdict, string> = {
  PUBLIC_REQUIREMENT_UNMET: 'bg-red-500',
  NO_PUBLIC_CONFLICT_FOUND: 'bg-emerald-500',
  MISSING_INFORMATION: 'bg-amber-400',
  POST_CONTRACT_REQUIREMENT: 'bg-sky-400',
  OFFICIAL_REVIEW_REQUIRED: 'bg-slate-400',
};

/** 판정 언어 한 줄 설명 (결과 화면 범례) */
export const VERDICT_DESC: Record<Verdict, string> = {
  PUBLIC_REQUIREMENT_UNMET: '공개된 요건과 입력값이 충돌합니다.',
  NO_PUBLIC_CONFLICT_FOUND:
    '공개 요건과 대조했을 때 걸리는 항목이 발견되지 않았습니다. 승인 의미가 아닙니다.',
  MISSING_INFORMATION: '판정에 필요한 값이 확보되지 않았습니다.',
  POST_CONTRACT_REQUIREMENT: '계약 이후 절차에서 충족해야 하는 요건입니다.',
  OFFICIAL_REVIEW_REQUIRED: '계약 전 확인이 불가해 기관의 공식 심사가 필요합니다.',
};

/** LLM 없이도 항상 생성되는 결정론적 리포트 (Gemini 폴백 겸 입력) */
export function buildReportTemplate(results: PathResult[]): string {
  const lines: string[] = [
    `# KB 상담용 사전점검 요약`,
    `대조 경로: ${results.length}개`,
    ``,
    `※ 경로 간 순위·추천이 아니라 각 공개요건과 입력값의 독립 대조 결과입니다.`,
  ];
  for (const result of results) {
    const blocked =
      result.blockedAt === 'NONE'
        ? '확인된 공개요건 충돌 없음'
        : result.blockedAt === 'PRODUCT'
          ? '상품요건(1층) 충돌'
          : result.blockedAt === 'GUARANTEE'
            ? '보증요건(2층) 충돌'
            : '자료 부족으로 판정 보류';
    lines.push(
      ``,
      `## ${result.pathLabel}`,
      `보증기관: ${result.guaranteeLabel}`,
      `요약: ${blocked}`,
      `공식 심사 필요: ${result.officialReviewCount}건`,
    );
    for (const check of result.results) {
      lines.push(`- [${VERDICT_KO[check.verdict]}] ${check.label}: ${check.reason}`);
      if (check.nextAction) lines.push(`  → 다음 행동: ${check.nextAction}`);
    }
  }
  lines.push(``, `※ '확인된 충돌 없음'은 승인·보증 가능을 의미하지 않습니다.`);
  return lines.join('\n');
}
