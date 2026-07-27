// POST /api/check — 규칙엔진 판정 (후속 에이전트 담당: F07 조합)
// body: CheckRequest(DiagnosisCase) → CheckResponse
// 로그인 사용자만 diagnosis_cases에 저장한다. 비로그인은 판정만 반환하고 저장하지 않는다.
import { NextResponse } from 'next/server';
import { runRulePack, parseRegion } from '@/lib/rule-engine';
import { getRulePack } from '@/lib/crawlers/rule-provider';
import { getServerSupabase } from '@/lib/supabase/server';
import type { CheckRequest, OverallStatus, PathResult } from '@/types';

export const maxDuration = 30;

function toOverallStatus(r: PathResult): OverallStatus {
  if (r.blockedAt === 'PRODUCT' || r.blockedAt === 'GUARANTEE') return 'fail';
  if (r.blockedAt === 'INSUFFICIENT') return 'insufficient';
  if (r.officialReviewCount > 0) return 'needs_review';
  return 'pass';
}

export async function POST(req: Request) {
  let diag: CheckRequest;
  try {
    diag = (await req.json()) as CheckRequest;
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  if (!diag.property.region) {
    diag.property.region = parseRegion(diag.property.address);
  }

  const pack = await getRulePack(); // 크롤링 캐시 or JSON 폴백
  const pathResult = runRulePack(diag, pack);

  let caseId: string | undefined;
  const supabase = getServerSupabase();
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('diagnosis_cases')
        .insert({
          user_id: user.id,
          payload: diag,
          result: pathResult,
          rule_version: pack.version,
          status: toOverallStatus(pathResult),
        })
        .select('id')
        .single();
      if (error) console.error('[check] supabase insert 실패:', error.message);
      else caseId = data.id;
    }
  }

  return NextResponse.json({ pathResult, ruleVersion: pack.version, ruleSource: pack.source, caseId });
}
