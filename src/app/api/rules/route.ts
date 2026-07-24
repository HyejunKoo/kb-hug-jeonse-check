// GET /api/rules — 현재 적용 중인 규칙팩 조회 (3번 담당)
// 디버깅·검수용: 어떤 규칙 버전이 어떤 출처(크롤링/JSON폴백)로 적용 중인지 확인
import { NextResponse } from 'next/server';
import { getRulePack } from '@/lib/crawlers/rule-provider';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  const pack = await getRulePack();
  return NextResponse.json(pack);
}
