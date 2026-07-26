// GET/DELETE /api/cases/[id] — 로그인 사용자 본인 진단 1건 조회·삭제 (로그인 필수)
// RLS(user_id = auth.uid())가 다른 사용자 row 접근을 이미 막지만, 앱 레벨에서도 404로 처리한다.
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import type { CaseDetailResponse, PathResult } from '@/types';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase 설정이 필요합니다.' }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { data, error } = await supabase
    .from('diagnosis_cases')
    .select('id, created_at, result, rule_version, status')
    .eq('id', params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: '진단 이력을 찾을 수 없습니다.' }, { status: 404 });

  const body: CaseDetailResponse = {
    id: data.id,
    createdAt: data.created_at,
    pathResult: data.result as PathResult,
    status: data.status,
    ruleVersion: data.rule_version,
  };
  return NextResponse.json(body);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase 설정이 필요합니다.' }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { data, error } = await supabase
    .from('diagnosis_cases')
    .delete()
    .eq('id', params.id)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: '진단 이력을 찾을 수 없습니다.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
