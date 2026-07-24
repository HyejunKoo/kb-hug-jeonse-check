// POST /api/check — 규칙엔진 판정 (후속 에이전트 담당: F07 조합)
// body: CheckRequest(DiagnosisCase) → CheckResponse
import { NextResponse } from 'next/server';
import { runRulePack, parseRegion } from '@/lib/rule-engine';
import { getRulePack } from '@/lib/crawlers/rule-provider';
import { getSupabase } from '@/lib/supabase/server';
import type { CheckRequest } from '@/types';

export const maxDuration = 30;

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

  const sb = getSupabase();
  if (sb) {
    await sb.from('diagnosis_cases').insert({
      payload: diag, result: pathResult, rule_version: pack.version,
    }).then(({ error }) => {
      if (error) console.error('[check] supabase insert 실패:', error.message);
    });
  }

  return NextResponse.json({ pathResult, ruleVersion: pack.version, ruleSource: pack.source });
}
