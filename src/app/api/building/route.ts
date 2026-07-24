// POST /api/building — 건축HUB(건축물대장) 조회 (F02)
// body: { address: string } → res: { property: Partial<Property> }
// 키가 없거나 실패하면 값 없이 반환 → 엔진이 MISSING_INFORMATION으로 처리
import { NextResponse } from 'next/server';
import { parseRegion } from '@/lib/rule-engine';
import type { Property } from '@/types';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { address } = (await req.json()) as { address?: string };
  if (!address?.trim()) {
    return NextResponse.json({ error: '주소를 입력해 주세요.' }, { status: 400 });
  }

  const property: Property = {
    address,
    region: parseRegion(address),
  };

  const apiKey = process.env.BUILDING_API_KEY;
  if (!apiKey) {
    // 키 미설정 데모 모드: 유형/위반 여부는 비워서 반환 → 자료 부족 판정 유도
    return NextResponse.json({ property, demo: true, note: 'BUILDING_API_KEY 미설정 — 공부정보 없이 반환' });
  }

  try {
    // TODO(1번): 건축HUB 표제부 조회 구현
    // 1) 주소 → 시군구코드/법정동코드/번지 변환 (주소 API 또는 파싱)
    // 2) getBrTitleInfo 호출: https://www.hub.go.kr (활용신청 필요)
    // 3) 응답에서 mainPurpsCdNm(용도), 위반건축물 표시, 전용면적 추출
    // 아래는 자리표시 — 실제 호출 코드로 교체할 것
    const _placeholder = apiKey; // eslint 미사용 경고 방지
    void _placeholder;
    return NextResponse.json({ property, implemented: false, note: '건축HUB 호출 로직 TODO' });
  } catch (e) {
    console.error('[building] 조회 실패:', e);
    return NextResponse.json({ property, error: '건축물대장 조회 실패 — 자료 부족으로 진단됩니다.' });
  }
}
