// 결과 화면 최상단 한 줄 결론. "그래서 지금 계약해도 되나 / 뭘 해야 하나"에 먼저 답한다.
// 판정을 새로 만들지 않고 summarizeOutcome() 이 고른 상태와 F10 액션 수만 보여준다.
import type { ActionPlan, OutcomeTone, PathResult } from '@/types';
import { ACTION_CATEGORY_KO, groupActionItems, summarizeOutcome } from '../action-plan';

const TONE: Record<OutcomeTone, { card: string; chip: string; dot: string }> = {
  critical: { card: 'border-red-200 bg-red-50', chip: 'bg-red-600 text-white', dot: 'bg-red-500' },
  warning: { card: 'border-amber-200 bg-amber-50', chip: 'bg-amber-500 text-white', dot: 'bg-amber-400' },
  caution: { card: 'border-orange-200 bg-orange-50', chip: 'bg-orange-500 text-white', dot: 'bg-orange-400' },
  info: { card: 'border-slate-200 bg-slate-50', chip: 'bg-slate-600 text-white', dot: 'bg-slate-400' },
  clear: { card: 'border-emerald-200 bg-emerald-50', chip: 'bg-emerald-600 text-white', dot: 'bg-emerald-500' },
};

export function ResultSummary({
  results,
  plan,
}: {
  results: PathResult[];
  plan: ActionPlan;
}) {
  const outcome = summarizeOutcome(results, plan);
  const tone = TONE[outcome.tone];
  const groups = groupActionItems(plan);
  const path = results[0];

  return (
    <section className={`rounded-2xl border p-5 sm:p-6 ${tone.card}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {path ? `${path.pathLabel} 기준 사전점검` : '사전점검 결과'}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${tone.chip}`}>
          {outcome.label}
        </span>
        {plan.items.length > 0 && (
          <span className="text-sm font-semibold text-slate-700">
            다음 행동 {plan.items.length}개
          </span>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-700">{outcome.detail}</p>

      {groups.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-black/5 pt-3.5">
          {groups.map((g) => (
            <li key={g.category} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden />
              {ACTION_CATEGORY_KO[g.category]}
              <b className="font-bold text-slate-800">{g.items.length}</b>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        공개된 요건과 입력값을 대조한 결과입니다. 대출 승인이나 보증서 발급을 의미하지 않습니다.
      </p>
    </section>
  );
}
