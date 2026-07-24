// 판정 결과 카드 (후속 에이전트 담당 — F09 근거 표시)
import type { CheckResult } from '@/types';
import { VERDICT_KO, VERDICT_BADGE } from '../formatter';

export function ResultCard({ r }: { r: CheckResult }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{r.label}</p>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${VERDICT_BADGE[r.verdict]}`}>
          {VERDICT_KO[r.verdict]}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">{r.reason}</p>
      {r.usedValues.length > 0 && (
        <p className="mt-1 text-xs text-slate-400">근거: {r.usedValues.join(' · ')}</p>
      )}
      {r.nextAction && <p className="mt-1 text-xs text-yellow-700">→ {r.nextAction}</p>}
      <p className="mt-1 text-[10px] text-slate-400">
        출처 <a className="underline" href={r.sourceUrl} target="_blank" rel="noreferrer">{r.sourceUrl}</a> · 기준일 {r.effectiveFrom}
      </p>
    </div>
  );
}
