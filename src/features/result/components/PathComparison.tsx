import type { PathResult, Verdict } from '@/types';
import { ResultCard } from './ResultCard';
import { LAYER_KO, LAYER_ORDER, VERDICT_BADGE, VERDICT_DESC, VERDICT_KO } from '../formatter';

const STATUS = {
  NONE: {
    label: '확인된 공개요건 충돌 없음',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  PRODUCT: { label: 'KB 상품요건 충돌', tone: 'border-red-200 bg-red-50 text-red-700' },
  GUARANTEE: { label: '보증기관 요건 충돌', tone: 'border-red-200 bg-red-50 text-red-700' },
  ACTION_REQUIRED: {
    label: '보증 실행 전 선행조치 필요',
    tone: 'border-orange-200 bg-orange-50 text-orange-700',
  },
  INSUFFICIENT: {
    label: '자료 부족으로 판정 보류',
    tone: 'border-amber-200 bg-amber-50 text-amber-700',
  },
} as const;

function countsOf(result: PathResult): Partial<Record<Verdict, number>> {
  return result.results.reduce<Partial<Record<Verdict, number>>>((counts, row) => {
    counts[row.verdict] = (counts[row.verdict] ?? 0) + 1;
    return counts;
  }, {});
}

export function PathComparison({ results }: { results: PathResult[] }) {
  // MVP 는 HUG 한 경로만 판정한다. 경로가 하나뿐인데 "대조 경로 1개"·"경로 간 순위 아님" 같은
  // 다중 경로 문구를 남겨두면 사용자에게는 뜻 없는 말이 된다 — 여러 개일 때만 개요를 띄운다.
  const multiPath = results.length > 1;

  return (
    <div className="space-y-6">
      {multiPath && (
        <section className="card card-body">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            상품·보증 2층 대조
          </p>
          <h2 className="mt-1.5 text-xl font-bold tracking-tight">대조 경로 {results.length}개</h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            경로 간 순위·추천이 아니라 각 공개요건과 입력값의 독립 대조 결과입니다.
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {results.map((result) => {
              const status = STATUS[result.blockedAt];
              return (
                <a
                  key={result.path}
                  href={`#${result.path}`}
                  className="rounded-xl border border-slate-200 p-3 transition hover:border-slate-300"
                >
                  <p className="text-sm font-bold text-slate-900">{result.pathLabel}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    보증기관 · {result.guaranteeProvider}
                  </p>
                  <span className={`badge mt-2 ${status.tone}`}>{status.label}</span>
                </a>
              );
            })}
          </div>
        </section>
      )}

      {results.map((result) => {
        const counts = countsOf(result);
        const status = STATUS[result.blockedAt];
        return (
          <details
            key={result.path}
            id={result.path}
            className="card scroll-mt-20"
            open
          >
            <summary className="cursor-pointer list-none px-5 py-5 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{result.pathLabel}</h3>
                  <p className="mt-1 text-xs text-slate-500">2층 보증 · {result.guaranteeLabel}</p>
                </div>
                <span className={`badge ${status.tone}`}>{status.label}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(Object.keys(counts) as Verdict[]).map((verdict) => (
                  <span key={verdict} className={`badge ${VERDICT_BADGE[verdict]}`}>
                    {VERDICT_KO[verdict]} {counts[verdict]}
                  </span>
                ))}
              </div>
            </summary>

            <div className="space-y-6 border-t border-slate-100 px-4 py-5 sm:px-6">
              {LAYER_ORDER.map((layer) => {
                const rows = result.results.filter((row) => row.layer === layer);
                if (rows.length === 0) return null;
                // 걸리는 항목이 먼저다. '확인된 충돌 없음'은 대개 다수라 그대로 두면 정작 봐야 할
                // 항목이 묻힌다 — 개수를 밝힌 채 접어두고 필요할 때 펼치게 한다.
                const attention = rows.filter((row) => row.verdict !== 'NO_PUBLIC_CONFLICT_FOUND');
                const clear = rows.filter((row) => row.verdict === 'NO_PUBLIC_CONFLICT_FOUND');
                return (
                  <section key={layer}>
                    <div className="mb-3 flex items-baseline gap-2">
                      <h4 className="text-sm font-bold text-slate-900">
                        {layer === 'GUARANTEE'
                          ? `2층 · ${result.guaranteeProvider} 보증요건`
                          : LAYER_KO[layer]}
                      </h4>
                      <span className="text-xs text-slate-400">{rows.length}개 항목</span>
                    </div>

                    {attention.length > 0 && (
                      <div className="space-y-2.5">
                        {attention.map((row) => (
                          <ResultCard key={row.ruleId} r={row} />
                        ))}
                      </div>
                    )}

                    {clear.length > 0 && (
                      <details className={attention.length > 0 ? 'mt-2.5' : ''}>
                        <summary className="cursor-pointer rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">
                          확인된 충돌 없음 {clear.length}개 항목 보기
                        </summary>
                        <div className="mt-2.5 space-y-2.5">
                          {clear.map((row) => (
                            <ResultCard key={row.ruleId} r={row} />
                          ))}
                        </div>
                      </details>
                    )}
                  </section>
                );
              })}
            </div>
          </details>
        );
      })}

      <details className="card card-body">
        <summary className="cursor-pointer text-sm font-bold">판정 언어 설명</summary>
        <dl className="mt-4 space-y-2.5">
          {(Object.keys(VERDICT_KO) as Verdict[]).map((verdict) => (
            <div key={verdict} className="flex flex-wrap items-baseline gap-2">
              <dt className={`badge ${VERDICT_BADGE[verdict]}`}>{VERDICT_KO[verdict]}</dt>
              <dd className="flex-1 text-xs leading-relaxed text-slate-500">
                {VERDICT_DESC[verdict]}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
