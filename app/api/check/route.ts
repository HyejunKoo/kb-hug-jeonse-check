// POST /api/check — 규칙엔진 판정 (F05~F07)
// body: DiagnosisCase → res: { pathResult: PathResult }
import { NextResponse } from 'next/server';
import { runRulePack, parseRegion } from '@/lib/ruleEngine';
import { getSupabase } from '@/lib/supabase';
import rulePack from '@/rules/kb-hug.json';
import type { DiagnosisCase, RulePack } from '@/lib/types';

export const maxDuration = 30;

export async function POST(req: Request) {
  let diag: DiagnosisCase;
  try {
    diag = (await req.json()) as DiagnosisCase;
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  // 지역 파싱 보정
  if (!diag.property.region) {
    diag.property.region = parseRegion(diag.property.address);
  }

  const pathResult = runRulePack(diag, rulePack as RulePack);

  // DB 저장은 있으면 하고, 없어도 판정은 반환 (데모 안전장치)
  const sb = getSupabase();
  if (sb) {
    await sb.from('diagnosis_cases').insert({
      payload: diag,
      result: pathResult,
      rule_version: (rulePack as RulePack).version,
    }).then(({ error }) => {
      if (error) console.error('[check] supabase insert 실패:', error.message);
    });
  }

  return NextResponse.json({ pathResult, ruleVersion: (rulePack as RulePack).version });
}
