// GET /api/cases — 로그인 사용자의 진단 이력 목록 (로그인 필수)
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import type { CaseListResponse, CaseSummary } from '@/types';
import { aggregateBlockedAt, normalizeStoredResults } from '@/features/result/normalize';

export async function GET() {
  const supabase = getServerSupabase();
  if (!supabase)
    return NextResponse.json({ error: 'Supabase 설정이 필요합니다.' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { data, error } = await supabase
    .from('diagnosis_cases')
    .select('id, created_at, result, rule_version, status')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const cases: CaseSummary[] = (data ?? []).map((row) => {
    const results = normalizeStoredResults(row.result);
    return {
      id: row.id,
      createdAt: row.created_at,
      pathLabel:
        results.length > 1
          ? `${results.length}개 상품 비교`
          : (results[0]?.pathLabel ?? '진단 결과'),
      blockedAt: aggregateBlockedAt(results),
      status: row.status,
      ruleVersion: row.rule_version,
    };
  });

  return NextResponse.json({ cases } satisfies CaseListResponse);
}
