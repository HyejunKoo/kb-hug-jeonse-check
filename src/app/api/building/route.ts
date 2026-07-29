// POST /api/building — 선택된 주소 1건으로 건축HUB 표제부 조회 (F02, 1번 담당)
// body: { juso: JusoItem } → { property, lot, housing, notes }
// 주소 후보 검색은 /api/address 가 담당한다.
import { NextResponse } from 'next/server';
import {
  jusoToLotCode, jusoToProperty, pickTitleItem, hubTitleToProperty, resolveHousingType,
  type JusoItem, type HubTitleItem, type LotCode,
} from '@/features/building/mapper';
import hubFixture from '@/features/building/__fixtures__/hub-title.json';
import type { Property } from '@/types';

export const maxDuration = 30;

const HUB_URL = 'https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo';

async function fetchHubTitle(lot: LotCode): Promise<HubTitleItem[]> {
  const key = process.env.BUILDING_API_KEY;
  if (process.env.USE_FIXTURES === '1' || !key) {
    return hubFixture.response.body.items.item as unknown as HubTitleItem[];
  }
  const u = new URL(HUB_URL);
  u.searchParams.set('serviceKey', key);
  u.searchParams.set('sigunguCd', lot.sigunguCd);
  u.searchParams.set('bjdongCd', lot.bjdongCd);
  u.searchParams.set('platGbCd', lot.platGbCd);
  u.searchParams.set('bun', lot.bun);
  u.searchParams.set('ji', lot.ji);
  u.searchParams.set('_type', 'json');
  u.searchParams.set('numOfRows', '50');
  u.searchParams.set('pageNo', '1');
  const res = await fetch(u, { cache: 'no-store' });
  const data = await res.json();
  if (data?.response?.header?.resultCode !== '00') {
    throw new Error(`건축HUB 실패: ${data?.response?.header?.resultMsg ?? 'unknown'}`);
  }
  const raw = data.response.body?.items?.item;
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]) as HubTitleItem[];
}

export async function POST(req: Request) {
  const { juso } = (await req.json()) as { juso?: JusoItem };
  if (!juso?.admCd) {
    return NextResponse.json({ error: '주소를 먼저 선택해 주세요.' }, { status: 400 });
  }

  const notes: string[] = [];
  const lot = jusoToLotCode(juso);
  let property: Property = jusoToProperty(juso);

  try {
    const items = await fetchHubTitle(lot);
    const { item, ambiguous, onlyAnnex } = pickTitleItem(items);

    if (ambiguous) {
      notes.push('한 지번에 주건축물이 여러 동입니다. 동을 특정할 수 없어 건물 정보는 자료 부족으로 처리됩니다.');
    }
    if (onlyAnnex) {
      notes.push('부속건축물만 조회되었습니다. 주거용 주건축물이 확인되지 않습니다.');
    }
    if (!item && !ambiguous && !onlyAnnex) {
      notes.push('건축물대장 정보를 찾지 못했습니다.');
    }

    property = hubTitleToProperty(property, item);
    notes.push('위반건축물 여부는 공개 API로 제공되지 않습니다. 정부24·세움터에서 건축물대장을 열람해 확인해 주세요.');

    return NextResponse.json({
      property, lot,
      housing: item ? resolveHousingType(item) : undefined,
      notes,
      fixtures: process.env.USE_FIXTURES === '1' || !process.env.BUILDING_API_KEY,
    });
  } catch (e) {
    console.error('[building]', e);
    return NextResponse.json({
      property, lot,
      notes: [...notes, '건축물대장 조회에 실패했습니다. 건물 정보는 자료 부족으로 처리됩니다.'],
    });
  }
}
