// POST /api/check — 규칙엔진 판정 (후속 에이전트 담당: F07 조합)
// body: CheckRequest(DiagnosisCase) → CheckResponse
// 로그인 사용자만 diagnosis_cases에 저장한다. 비로그인은 판정만 반환하고 저장하지 않는다.
import { NextResponse } from 'next/server';
import { runAllRulePacks, parseRegion } from '@/lib/rule-engine';
import { getRulePack } from '@/lib/crawlers/rule-provider';
import { getServerSupabase } from '@/lib/supabase/server';
import type { CheckRequest, OverallStatus, PathResult } from '@/types';

export const maxDuration = 30;

function toOverallStatus(results: PathResult[]): OverallStatus {
  const candidates = results.filter((r) => r.blockedAt === 'NONE');
  if (candidates.some((r) => r.officialReviewCount === 0)) return 'pass';
  if (candidates.length > 0) return 'needs_review';
  if (results.some((r) => r.blockedAt === 'INSUFFICIENT')) return 'insufficient';
  return 'fail';
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
  const pathResults = runAllRulePacks(diag, pack);

  let caseId: string | undefined;
  const supabase = getServerSupabase();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('diagnosis_cases')
        .insert({
          user_id: user.id,
          payload: diag,
          result: pathResults,
          rule_version: pack.version,
          status: toOverallStatus(pathResults),
        })
        .select('id')
        .single();
      if (error) console.error('[check] supabase insert 실패:', error.message);
      else caseId = data.id;
    }
  }

  return NextResponse.json({
    pathResults,
    ruleVersion: pack.version,
    ruleSource: pack.source,
    caseId,
  });
}
