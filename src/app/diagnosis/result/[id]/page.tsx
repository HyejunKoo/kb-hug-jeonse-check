// src/app/diagnosis/result/[id]/page.tsx — 저장된 진단 1건 상세
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { ResultCard } from '@/features/result/components/ResultCard';
import { VERDICT_KO } from '@/features/result/formatter';
import type { PathResult, Verdict } from '@/types';
import { DeleteCaseButton } from './DeleteCaseButton';

const BLOCKED_KO: Record<PathResult['blockedAt'], string> = {
  NONE: '막힌 단계 없음',
  PRODUCT: '1층 · KB 상품요건에서 막힘',
  GUARANTEE: '2층 · HUG 보증요건에서 막힘',
  INSUFFICIENT: '자료 부족으로 판정 보류',
};

export default async function ResultDetailPage({ params }: { params: { id: string } }) {
  const supabase = getServerSupabase();
  if (!supabase) redirect('/login');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase
    .from('diagnosis_cases')
    .select('id, created_at, result, rule_version')
    .eq('id', params.id)
    .maybeSingle();

  if (error || !data) notFound();

  const result = data.result as PathResult;
  const verdictCounts = result.results.reduce<Partial<Record<Verdict, number>>>((acc, r) => {
    acc[r.verdict] = (acc[r.verdict] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/diagnosis/result" className="btn-ghost -ml-3 mb-4 inline-flex">← 목록으로</Link>

      <div className="card card-body mb-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {new Date(data.created_at).toLocaleString('ko-KR')} · 규칙팩 {data.rule_version}
        </p>
        <h1 className="mt-1.5 text-xl font-bold tracking-tight">{result.pathLabel}</h1>
        <p className="mt-2 text-sm font-bold text-slate-700">{BLOCKED_KO[result.blockedAt]}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(verdictCounts) as Verdict[]).map((v) => (
            <span key={v} className="badge border-slate-200 bg-slate-50 text-slate-600">
              {VERDICT_KO[v]} {verdictCounts[v]}
            </span>
          ))}
        </div>
      </div>

      {(['PRODUCT', 'GUARANTEE'] as const).map((layer) => {
        const rows = result.results.filter((r) => r.layer === layer);
        if (rows.length === 0) return null;
        return (
          <div key={layer} className="mb-6">
            <div className="mb-3 flex items-baseline gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                {layer === 'PRODUCT' ? '1층 · KB 상품요건' : '2층 · HUG 보증요건'}
              </h2>
              <span className="text-xs text-slate-400">{rows.length}개 항목</span>
            </div>
            <div className="space-y-2.5">
              {rows.map((r) => <ResultCard key={r.ruleId} r={r} />)}
            </div>
          </div>
        );
      })}

      <DeleteCaseButton id={data.id} />
    </main>
  );
}
