// POST /api/report — KB 상담용 요약 생성 (F11, 2번 담당)
// 절대 규칙: Gemini는 문장 변환만. 새 판정·수치를 만들지 않는다.
// body: { pathResult: PathResult } → res: { report: string }
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { PathResult } from '@/lib/types';

export const maxDuration = 60;

const VERDICT_KO: Record<string, string> = {
  PUBLIC_REQUIREMENT_UNMET: '공개요건 미충족',
  NO_PUBLIC_CONFLICT_FOUND: '확인된 충돌 없음',
  MISSING_INFORMATION: '자료 부족',
  POST_CONTRACT_REQUIREMENT: '계약 후 충족 요건',
  OFFICIAL_REVIEW_REQUIRED: '공식 심사 필요',
};

/** LLM 없이도 항상 생성되는 결정론적 템플릿 (fallback 겸 Gemini 입력) */
function buildTemplate(r: PathResult): string {
  const lines: string[] = [
    `# KB 상담용 사전점검 요약`,
    `경로: ${r.pathLabel}`,
    `막힌 단계: ${r.blockedAt === 'NONE' ? '없음' : r.blockedAt === 'PRODUCT' ? '상품요건(1층)' : '보증요건(2층)'}`,
    `공식 심사 필요 항목: ${r.officialReviewCount}건`,
    ``,
    `## 판정 상세`,
  ];
  for (const c of r.results) {
    lines.push(`- [${VERDICT_KO[c.verdict]}] ${c.label}: ${c.reason}`);
    if (c.nextAction) lines.push(`  → 다음 행동: ${c.nextAction}`);
  }
  lines.push(``, `※ '확인된 충돌 없음'은 승인·보증 가능을 의미하지 않습니다.`);
  return lines.join('\n');
}

export async function POST(req: Request) {
  let pathResult: PathResult;
  try {
    ({ pathResult } = (await req.json()) as { pathResult: PathResult });
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  const template = buildTemplate(pathResult);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ report: template, llm: false });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = [
      '아래는 전세대출 사전점검 판정 결과다. 은행 상담사가 읽기 좋게 자연스러운 한국어 1페이지 요약으로 다듬어라.',
      '규칙: 아래에 없는 판정·수치·확률을 절대 새로 만들지 마라. 승인 가능성을 언급하지 마라. 항목·수치는 그대로 유지하라.',
      '', template,
    ].join('\n');
    const result = await model.generateContent(prompt);
    return NextResponse.json({ report: result.response.text(), llm: true });
  } catch (e) {
    console.error('[report] Gemini 실패, 템플릿으로 대체:', e);
    return NextResponse.json({ report: template, llm: false });
  }
}
