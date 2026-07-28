// POST /api/report — KB 상담용 요약 (후속 에이전트 담당: F11)
// 절대 규칙: Gemini는 문장 다듬기만. 새 판정·수치 생성 금지. 실패 시 템플릿 폴백.
import { NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini/client';
import { buildReportTemplate } from '@/features/result/formatter';
import type { ReportRequest } from '@/types';

export const maxDuration = 60;

export async function POST(req: Request) {
  let body: ReportRequest;
  try {
    body = (await req.json()) as ReportRequest;
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  if (!Array.isArray(body.pathResults) || body.pathResults.length === 0) {
    return NextResponse.json({ error: '판정 결과가 없습니다.' }, { status: 400 });
  }

  const template = buildReportTemplate(body.pathResults);
  const model = getGeminiModel();
  if (!model) return NextResponse.json({ report: template, llm: false });

  try {
    const prompt = [
      '아래는 전세대출 사전점검 판정 결과다. 은행 상담사가 읽기 좋게 자연스러운 한국어 1페이지 요약으로 다듬어라.',
      '규칙: 아래에 없는 판정·수치·확률을 절대 새로 만들지 마라. 승인 가능성을 언급하지 마라. 항목·수치는 그대로 유지하라.',
      '',
      template,
    ].join('\n');
    const result = await model.generateContent(prompt);
    return NextResponse.json({ report: result.response.text(), llm: true });
  } catch (e) {
    console.error('[report] Gemini 실패, 템플릿으로 대체:', e);
    return NextResponse.json({ report: template, llm: false });
  }
}
