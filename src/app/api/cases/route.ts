// GET /api/cases — 로그인 사용자의 진단 이력 목록 (로그인 필수)
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import type { CaseListResponse, CaseSummary, PathResult } from '@/types';

export async function GET() {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase 설정이 필요합니다.' }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { data, error } = await supabase
    .from('diagnosis_cases')
    .select('id, created_at, result, rule_version, status')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const cases: CaseSummary[] = (data ?? []).map((row) => {
    const result = row.result as PathResult;
    return {
      id: row.id,
      createdAt: row.created_at,
      pathLabel: result.pathLabel,
      blockedAt: result.blockedAt,
      status: row.status,
      ruleVersion: row.rule_version,
    };
  });

  return NextResponse.json({ cases } satisfies CaseListResponse);
}
