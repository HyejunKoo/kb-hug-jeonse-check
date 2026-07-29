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
  const productCandidates = results.filter(
    (result) =>
      result.blockedAt !== 'INSUFFICIENT' &&
      !result.results.some(
        (row) => row.layer === 'PRODUCT' && row.verdict === 'PUBLIC_REQUIREMENT_UNMET',
      ),
  );

  return (
    <div className="space-y-6">
      <section className="card card-body">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          KB HUG 상품·보증 2층 대조
        </p>
        <h2 className="mt-1.5 text-xl font-bold tracking-tight">
          상품 공개요건 충돌 없음 {productCandidates.length}개
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          상품 자격과 보증기관 요건은 별도 층으로 판정합니다. 아래 결과는 승인·보증서 발급을 뜻하지
          않습니다.
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
                    <div className="space-y-2.5">
                      {rows.map((row) => (
                        <ResultCard key={row.ruleId} r={row} />
                      ))}
                    </div>
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
