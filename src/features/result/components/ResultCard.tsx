// 판정 결과 카드 (후속 에이전트 담당 — F09 근거 표시)
import type { CheckResult } from '@/types';
import { VERDICT_KO, VERDICT_BADGE, VERDICT_ACCENT } from '../formatter';

export function ResultCard({ r }: { r: CheckResult }) {
  return (
    <article className="card relative overflow-hidden pl-1">
      <span className={`absolute inset-y-0 left-0 w-1 ${VERDICT_ACCENT[r.verdict]}`} aria-hidden />

      <div className="px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-sm font-bold leading-snug text-slate-900">{r.label}</h4>
          <span className={`badge ${VERDICT_BADGE[r.verdict]}`}>{VERDICT_KO[r.verdict]}</span>
        </div>

        <p className="mt-2 text-sm leading-relaxed text-slate-600">{r.reason}</p>

        {r.usedValues.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {r.usedValues.map((v) => (
              <span key={v} className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600">
                {v}
              </span>
            ))}
          </div>
        )}

        {r.nextAction && (
          <p className="mt-3 rounded-lg border border-kb-200 bg-kb-50 px-3 py-2 text-xs font-medium leading-relaxed text-kb-800">
            다음 행동 · {r.nextAction}
          </p>
        )}

        <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] text-slate-400">
          <a className="underline decoration-slate-300 underline-offset-2 hover:text-slate-600" href={r.sourceUrl} target="_blank" rel="noreferrer">
            출처 확인
          </a>
          <span className="divide-dot">·</span>
          기준일 {r.effectiveFrom}
          <span className="divide-dot">·</span>
          {r.ruleId}
        </p>
      </div>
    </article>
  );
}
