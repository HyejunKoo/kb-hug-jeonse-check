// src/app/diagnosis/result/[id]/page.tsx — 저장된 진단 1건 상세
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { PathComparison } from '@/features/result/components/PathComparison';
import { ActionPlanPanel } from '@/features/result/components/ActionPlanPanel';
import { buildActionPlan } from '@/features/result/action-plan';
import { normalizeStoredResults } from '@/features/result/normalize';
import { DeleteCaseButton } from '@/features/result/components/DeleteCaseButton';

export default async function ResultDetailPage({ params }: { params: { id: string } }) {
  const supabase = getServerSupabase();
  if (!supabase) redirect('/login');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase
    .from('diagnosis_cases')
    .select('id, created_at, result, rule_version')
    .eq('id', params.id)
    .maybeSingle();

  if (error || !data) notFound();

  const results = normalizeStoredResults(data.result);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/diagnosis/result" className="btn-ghost -ml-3 mb-4 inline-flex">
        ← 목록으로
      </Link>

      <div className="card card-body mb-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {new Date(data.created_at).toLocaleString('ko-KR')} · 규칙팩 {data.rule_version}
        </p>
        <h1 className="mt-1.5 text-xl font-bold tracking-tight">KB 상품·보증기관 사전점검</h1>
        <p className="mt-2 text-sm text-slate-500">
          저장된 {results.length}개 경로의 독립 판정 결과입니다.
        </p>
      </div>

      <PathComparison results={results} />

      {/* F10은 저장하지 않는다 — 저장된 pathResults로 같은 순수 함수를 다시 돌려 만든다 */}
      {results.length > 0 && (
        <div className="mt-6">
          <ActionPlanPanel plan={buildActionPlan(results)} />
        </div>
      )}

      <div className="mt-6">
        <DeleteCaseButton id={data.id} />
      </div>
    </main>
  );
}
