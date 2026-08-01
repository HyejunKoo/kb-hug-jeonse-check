// src/app/diagnosis/result/[id]/page.tsx — 저장된 진단 1건 상세
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { PathComparison } from '@/features/result/components/PathComparison';
import { ActionPlanPanel } from '@/features/result/components/ActionPlanPanel';
import { ResultSummary } from '@/features/result/components/ResultSummary';
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

      {/* 결론은 바로 아래 ResultSummary 가 말한다. 여기서는 언제·무슨 규칙으로 판정했는지만. */}
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">저장된 사전점검</h1>
        <p className="mt-1.5 text-xs text-slate-400">
          {new Date(data.created_at).toLocaleString('ko-KR')}
          <span className="divide-dot">·</span>규칙팩 {data.rule_version}
        </p>
      </div>

      {/* 결과 화면과 같은 순서: 종합 결론 → 다음 행동 → 판정 상세.
          F10은 저장하지 않는다 — 저장된 pathResults로 같은 순수 함수를 다시 돌려 만든다 */}
      {results.length > 0 && (
        <div className="mb-6 space-y-6">
          <ResultSummary results={results} plan={buildActionPlan(results)} />
          <ActionPlanPanel plan={buildActionPlan(results)} />
        </div>
      )}

      <PathComparison results={results} />

      <div className="mt-6">
        <DeleteCaseButton id={data.id} />
      </div>
    </main>
  );
}
