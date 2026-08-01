// POST /api/report — KB 상담용 요약 (후속 에이전트 담당: F11)
// 절대 규칙: Gemini는 문장 다듬기만. 새 판정·수치 생성 금지. 실패 시 템플릿 폴백.
//
// F11 동의 게이트: consent === true 일 때만 입력값·판정을 Gemini로 보낸다.
// 동의가 없으면 400이고 Gemini를 호출하지 않는다. 생성된 보고서 텍스트는 저장하지 않는다
// (화면 표시·복사만) — 저장되는 것은 기존 /api/check 의 진단 이력뿐이다.
import { NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini/client';
import { buildReportTemplate } from '@/features/result/formatter';
import { buildActionPlan } from '@/features/result/action-plan';
import { filterValidPathResults } from '@/features/result/normalize';
import type { ReportErrorCode, ReportRequest } from '@/types';

export const maxDuration = 60;

const fail = (error: string, code: ReportErrorCode) =>
  NextResponse.json({ error, code }, { status: 400 });

export async function POST(req: Request) {
  let body: ReportRequest;
  try {
    body = (await req.json()) as ReportRequest;
  } catch {
    return fail('잘못된 요청 본문입니다.', 'INVALID_BODY');
  }

  // 동의 확인이 가장 먼저다 — 판정 결과를 들여다보기 전에 막는다.
  if (body?.consent !== true) {
    return fail(
      '입력값·판정 결과를 요약 생성에 사용하는 것에 동의해야 상담용 요약을 만들 수 있습니다.',
      'CONSENT_REQUIRED',
    );
  }

  // 아예 안 보냈거나 빈 배열이면 '없음'이고, 뭔가 보냈는데 모양이 어긋나면 '형식 오류'다.
  if (body.pathResults == null || (Array.isArray(body.pathResults) && body.pathResults.length === 0)) {
    return fail('판정 결과가 없습니다.', 'NO_PATH_RESULTS');
  }

  // 형식까지 확인하고 나서 판정 결과를 다룬다. 이 아래는 전부 PathResult[]를 전제로 하는
  // 순수 함수라, 모양이 어긋난 값이 들어오면 TypeError로 500이 나거나 더 나쁘게는
  // '막힌 단계: undefined' 같은 문장이 담긴 상담용 보고서가 그대로 나간다.
  // 읽을 수 있는 행은 그대로 쓰고 깨진 행만 버린다. 전부 못 읽을 때만 거절한다.
  const pathResults = filterValidPathResults(body.pathResults);
  if (pathResults.length === 0) {
    return fail('판정 결과의 형식이 올바르지 않습니다.', 'INVALID_BODY');
  }
  // 클라이언트가 보낸 actionPlan은 쓰지 않는다. 같은 pathResults면 같은 결과가 나오는
  // 순수 함수라 서버에서 다시 계산하는 편이 안전하다 (프롬프트에 임의 문구가 섞이는 것을 막는다).
  const actionPlan = buildActionPlan(pathResults);
  const template = buildReportTemplate(pathResults, {
    diagnosis: body.diagnosis,
    actionPlan,
  });

  const model = getGeminiModel();
  if (!model) return NextResponse.json({ report: template, llm: false });

  try {
    const prompt = [
      '너는 판정자가 아니라 문장 정리 도구다. 아래는 전세대출 사전점검의 입력값·출처·판정 결과와',
      '그로부터 만들어진 다음 행동 목록이다. 은행 상담 창구에서 그대로 읽을 수 있는',
      '자연스러운 한국어 1페이지 요약으로 다듬어라.',
      '',
      '규칙:',
      '1. 아래에 없는 판정·수치·확률·요건을 절대 새로 만들지 마라.',
      '2. 승인 가능성·보증 가능성·통과 여부를 언급하거나 암시하지 마라.',
      "3. '확인된 충돌 없음'을 긍정적 전망으로 바꿔 쓰지 마라.",
      '4. 항목명·수치·금액·날짜·출처 표기는 원문 그대로 유지하라.',
      '5. 제공된 정보를 문장으로 정리하기만 하고, 조언·추천·순위를 덧붙이지 마라.',
      '6. 계약 보류 권고가 있으면 그 문구를 약화시키지 말고 그대로 전달하라.',
      '',
      template,
    ].join('\n');
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    // 빈 응답이 오면 템플릿이 더 낫다 — 사용자에게 빈 보고서를 보여주지 않는다.
    if (!text.trim()) return NextResponse.json({ report: template, llm: false });
    return NextResponse.json({ report: text, llm: true });
  } catch (e) {
    console.error('[report] Gemini 실패, 템플릿으로 대체:', e);
    return NextResponse.json({ report: template, llm: false });
  }
}
