// src/app/diagnosis/result/page.tsx — 로그인 사용자의 저장된 진단 이력 목록
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import type { PathResult } from '@/types';
import { aggregateBlockedAt, normalizeStoredResults } from '@/features/result/normalize';

const BLOCKED_KO: Record<PathResult['blockedAt'], string> = {
  NONE: '막힌 단계 없음',
  PRODUCT: '1층 · KB 상품요건에서 막힘',
  GUARANTEE: '2층 · HUG 보증요건에서 막힘',
  ACTION_REQUIRED: 'HUG 보증 실행 전 선행조치 필요',
  INSUFFICIENT: '자료 부족으로 판정 보류',
};

const BLOCKED_TONE: Record<PathResult['blockedAt'], string> = {
  NONE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PRODUCT: 'bg-red-50 text-red-700 border-red-200',
  GUARANTEE: 'bg-red-50 text-red-700 border-red-200',
  ACTION_REQUIRED: 'bg-orange-50 text-orange-700 border-orange-200',
  INSUFFICIENT: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default async function ResultListPage() {
  const supabase = getServerSupabase();
  if (!supabase) redirect('/login');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase
    .from('diagnosis_cases')
    .select('id, created_at, result, rule_version')
    .order('created_at', { ascending: false });

  const cases = (data ?? []).map((row) => {
    const results = normalizeStoredResults(row.result);
    return { ...row, results, blockedAt: aggregateBlockedAt(results) };
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <p className="eyebrow">내 이력</p>
        <h1 className="mt-2 text-xl font-bold tracking-tight">저장된 진단 결과</h1>
        <p className="mt-2 text-sm text-slate-500">로그인 후 실행한 사전점검만 저장됩니다.</p>
      </header>

      {error && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          이력을 불러오지 못했습니다: {error.message}
        </p>
      )}

      {!error && cases.length === 0 && (
        <div className="card card-body text-center">
          <p className="text-sm text-slate-500">아직 저장된 진단 결과가 없습니다.</p>
          <Link href="/diagnosis" className="btn-main mt-4 inline-flex">
            사전점검 시작
          </Link>
        </div>
      )}

      <ul className="space-y-2.5">
        {cases.map((c) => (
          <li key={c.id}>
            <Link
              href={`/diagnosis/result/${c.id}`}
              className="card card-body block transition hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {c.results.length > 1
                      ? `${c.results.length}개 KB 상품 비교`
                      : (c.results[0]?.pathLabel ?? '진단 결과')}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(c.created_at).toLocaleString('ko-KR')} · 규칙팩 {c.rule_version}
                  </p>
                </div>
                <span className={`badge ${BLOCKED_TONE[c.blockedAt]}`}>
                  {BLOCKED_KO[c.blockedAt]}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
