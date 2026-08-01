// src/app/diagnosis/result/page.tsx — 로그인 사용자의 저장된 진단 이력 목록
//
// MVP 경로가 HUG 하나뿐이라 pathLabel 은 모든 행이 같다("KB스타 전세자금대출 (HUG)").
// 그래서 제목으로 쓰면 목록이 전부 똑같아 보인다 — 무엇을 진단했는지 구분되는 값,
// 즉 payload 의 매물 주소를 제목으로 올리고 pathLabel 은 메타로 내린다.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import type { DiagnosisCase, PathResult } from '@/types';
import { aggregateBlockedAt, normalizeStoredResults } from '@/features/result/normalize';
import { DeleteCaseButton } from '@/features/result/components/DeleteCaseButton';

const PAGE_SIZE = 20;

const BLOCKED_KO: Record<PathResult['blockedAt'], string> = {
  NONE: '충돌 없음',
  PRODUCT: '상품요건 충돌',
  GUARANTEE: '보증요건 충돌',
  ACTION_REQUIRED: '선행조치 필요',
  INSUFFICIENT: '자료 부족',
};

const BLOCKED_TONE: Record<PathResult['blockedAt'], string> = {
  NONE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PRODUCT: 'bg-red-50 text-red-700 border-red-200',
  GUARANTEE: 'bg-red-50 text-red-700 border-red-200',
  ACTION_REQUIRED: 'bg-orange-50 text-orange-700 border-orange-200',
  INSUFFICIENT: 'bg-amber-50 text-amber-700 border-amber-200',
};

/** 저장된 payload 는 옛 형식일 수 있어 값이 없으면 조용히 건너뛴다 */
function summarize(payload: unknown) {
  const p = payload as DiagnosisCase | null;
  const address = p?.property?.address?.value?.trim();
  const deposit = p?.contract?.deposit?.value;
  const term = p?.contract?.termMonths?.value;
  return {
    address: address || null,
    deposit: typeof deposit === 'number' && deposit > 0 ? `${(deposit / 1e8).toFixed(2)}억원` : null,
    term: typeof term === 'number' && term > 0 ? `${term}개월` : null,
  };
}

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

export default async function ResultListPage({
  searchParams,
}: {
  searchParams?: { page?: string };
}) {
  const supabase = getServerSupabase();
  if (!supabase) redirect('/login');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const page = Math.max(1, Number(searchParams?.page ?? '1') || 1);
  const from = (page - 1) * PAGE_SIZE;

  const { data, error, count } = await supabase
    .from('diagnosis_cases')
    .select('id, created_at, result, rule_version, payload', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const cases = (data ?? []).map((row) => {
    const results = normalizeStoredResults(row.result);
    return { ...row, results, blockedAt: aggregateBlockedAt(results), ...summarize(row.payload) };
  });

  const total = count ?? cases.length;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 마지막 페이지를 넘어선 ?page= 는 Supabase 가 range 에러로 돌려준다("Requested range not
  // satisfiable"). 주소창을 직접 고친 경우라 장애가 아니므로, 에러 대신 빈 페이지로 보여준다.
  const outOfRange = !!error && cases.length === 0 && page > 1;
  const loadError = error && !outOfRange ? error : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <p className="eyebrow">내 이력</p>
        <h1 className="mt-2 text-xl font-bold tracking-tight">저장된 진단 결과</h1>
        <p className="mt-2 text-sm text-slate-500">
          로그인 후 실행한 사전점검만 저장됩니다.
          {total > 0 && <span className="ml-1 text-slate-400">· 총 {total}건</span>}
        </p>
      </header>

      {loadError && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          이력을 불러오지 못했습니다: {loadError.message}
        </p>
      )}

      {!loadError && cases.length === 0 && (
        <div className="card card-body text-center">
          <p className="text-sm text-slate-500">
            {page > 1 ? '이 페이지에는 결과가 없습니다.' : '아직 저장된 진단 결과가 없습니다.'}
          </p>
          <Link href={page > 1 ? '/diagnosis/result' : '/diagnosis'} className="btn-main mt-4 inline-flex">
            {page > 1 ? '첫 페이지로' : '사전점검 시작'}
          </Link>
        </div>
      )}

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {cases.map((c) => (
          <li key={c.id} className="flex items-center gap-2 pr-2 transition hover:bg-slate-50">
            <Link href={`/diagnosis/result/${c.id}`} className="min-w-0 flex-1 px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <p className="truncate text-sm font-bold text-slate-900">
                  {c.address ?? '주소 미상 진단'}
                </p>
                <span className={`badge shrink-0 ${BLOCKED_TONE[c.blockedAt]}`}>
                  {BLOCKED_KO[c.blockedAt]}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-slate-400">
                {[c.deposit, c.term].filter(Boolean).join(' · ')}
                {(c.deposit || c.term) && <span className="divide-dot">·</span>}
                {dateTime(c.created_at)}
              </p>
            </Link>
            <DeleteCaseButton id={c.id} after="refresh" compact label={c.address ?? '주소 미상'} />
          </li>
        ))}
      </ul>

      {lastPage > 1 && (
        <nav className="mt-5 flex items-center justify-between" aria-label="이력 페이지">
          {page > 1 ? (
            <Link href={`/diagnosis/result?page=${page - 1}`} className="btn-sub">
              ← 이전
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-slate-400">
            {page} / {lastPage}
          </span>
          {page < lastPage ? (
            <Link href={`/diagnosis/result?page=${page + 1}`} className="btn-sub">
              다음 →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </main>
  );
}
