// POST /api/check — 규칙엔진 판정 (후속 에이전트 담당: F07 조합)
// body: CheckRequest(DiagnosisCase) → CheckResponse
// 흐름: F04 진단자료 충분성 검사 → (충분할 때만) 규칙팩 실행
//   자료가 부족하거나 상충하면 runRulePack()을 아예 호출하지 않고 blockedAt: 'INSUFFICIENT'만
//   돌려준다. 빈 값 위에서 만든 요건 판정을 사용자에게 보여주면 안 되기 때문이다.
// 로그인 사용자만 diagnosis_cases에 저장한다. 비로그인은 판정만 반환하고 저장하지 않는다.
import { NextResponse } from 'next/server';
import { runRulePack, parseRegion } from '@/lib/rule-engine';
import { validateDiagnosticSufficiency, toSufficiencyResults } from '@/lib/rule-engine/sufficiency';
import { getRulePack, getFallbackRuleVersion } from '@/lib/crawlers/rule-provider';
import { getServerSupabase } from '@/lib/supabase/server';
import type { CheckRequest, OverallStatus, PathResult, RuleSource } from '@/types';

export const maxDuration = 30;

function toOverallStatus(results: PathResult[]): OverallStatus {
  if (results.some((r) => r.blockedAt === 'PRODUCT' || r.blockedAt === 'GUARANTEE')) return 'fail';
  if (results.some((r) => r.blockedAt === 'ACTION_REQUIRED')) return 'needs_action';
  if (results.some((r) => r.blockedAt === 'INSUFFICIENT')) return 'insufficient';
  if (results.some((r) => r.officialReviewCount > 0)) return 'needs_review';
  return 'pass';
}

const HUG_PATH = {
  path: 'KB_STAR_HUG',
  pathLabel: 'KB스타 전세자금대출 (HUG)',
  guaranteeProvider: 'HUG',
  guaranteeLabel: '주택도시보증공사(HUG)',
} as const;

export async function POST(req: Request) {
  let diag: CheckRequest;
  try {
    diag = (await req.json()) as CheckRequest;
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }
  if (!diag?.applicant || !diag?.contract || !diag?.property) {
    return NextResponse.json({ error: '신청인·예정계약·매물 정보가 모두 필요합니다.' }, { status: 400 });
  }

  // 건축HUB 조회가 지역을 못 채운 경우의 보조 경로. 주소 자체가 주소검색 API에서 온 값이라
  // 도출값의 출처도 그 주소의 출처를 그대로 따른다.
  if (!diag.property.region && diag.property.address?.value) {
    const region = parseRegion(diag.property.address.value);
    if (region) diag.property.region = { value: region, source: diag.property.address.source };
  }

  // ---- F04: 자료가 갖춰졌는지 먼저 본다 ----
  const issues = validateDiagnosticSufficiency(diag);
  const sufficiencyResults = toSufficiencyResults(issues);

  let pathResult: PathResult;
  let ruleVersion: string;
  let ruleSource: RuleSource;

  if (issues.length > 0) {
    // 판정을 중단하기로 한 요청이라 규칙팩도 가져오지 않는다 — 크롤러가 붙으면 외부 호출이 따라온다.
    // 적용된 규칙이 하나도 없으므로 버전은 "어느 기준의 F04였나"를 남기는 로컬 값만 기록한다.
    pathResult = {
      ...HUG_PATH,
      blockedAt: 'INSUFFICIENT',
      results: sufficiencyResults,
      officialReviewCount: 0,
    };
    ruleVersion = getFallbackRuleVersion();
    ruleSource = 'FALLBACK_JSON';
  } else {
    const pack = await getRulePack(); // Supabase 활성 규칙 → 최초 부트스트랩 크롤링 → JSON 폴백
    const ruleResult = runRulePack(diag, pack);
    pathResult = { ...ruleResult, results: [...sufficiencyResults, ...ruleResult.results] };
    ruleVersion = pack.version;
    ruleSource = pack.source;
  }

  // 응답·저장 형식은 과거 다중 경로와 호환되는 배열을 유지하지만 MVP 실행 경로는 HUG 하나뿐이다.
  const pathResults = [pathResult];

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
          rule_version: ruleVersion,
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
    ruleVersion,
    ruleSource,
    caseId,
  });
}
