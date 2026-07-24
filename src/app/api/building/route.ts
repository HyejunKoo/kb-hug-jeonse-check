// POST /api/building — 주소검색 → 지번코드 변환 → 건축HUB 표제부 조회 (F02, 1번 담당)
// body: { address } → { property, lot?, housing?, notes[] }
// 키가 없거나 USE_FIXTURES=1 이면 픽스처로 동작 (회사 노트북 개발용)
import { NextResponse } from 'next/server';
import {
  jusoToLotCode, regionFromSiNm, pickTitleItem, hubTitleToProperty, resolveHousingType,
  type JusoItem, type HubTitleItem,
} from '@/features/building/mapper';
import jusoFixture from '@/features/building/__fixtures__/juso-search.json';
import hubFixture from '@/features/building/__fixtures__/hub-title.json';
import type { Property } from '@/types';

export const maxDuration = 30;

const JUSO_URL = 'https://business.juso.go.kr/addrlink/addrLinkApi.do';
const HUB_URL = 'https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo';

const shouldUseFixtures = () =>
  process.env.USE_FIXTURES === '1' || !process.env.JUSO_API_KEY || !process.env.BUILDING_API_KEY;

async function searchJuso(keyword: string): Promise<JusoItem[]> {
  if (shouldUseFixtures()) return (jusoFixture.results.juso as unknown) as JusoItem[];
  const u = new URL(JUSO_URL);
  u.searchParams.set('confmKey', process.env.JUSO_API_KEY!);
  u.searchParams.set('currentPage', '1');
  u.searchParams.set('countPerPage', '5');
  u.searchParams.set('keyword', keyword);
  u.searchParams.set('resultType', 'json');
  const res = await fetch(u, { cache: 'no-store' });
  const data = await res.json();
  if (data?.results?.common?.errorCode !== '0') {
    throw new Error(`주소검색 실패: ${data?.results?.common?.errorMessage ?? 'unknown'}`);
  }
  return (data.results.juso ?? []) as JusoItem[];
}

async function fetchHubTitle(lot: ReturnType<typeof jusoToLotCode>): Promise<HubTitleItem[]> {
  if (shouldUseFixtures()) {
    return (hubFixture.response.body.items.item as unknown) as HubTitleItem[];
  }
  const u = new URL(HUB_URL);
  u.searchParams.set('serviceKey', process.env.BUILDING_API_KEY!);
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
  const { address } = (await req.json()) as { address?: string };
  if (!address?.trim()) {
    return NextResponse.json({ error: '주소를 입력해 주세요.' }, { status: 400 });
  }

  // 주소검색 API는 SQL 예약어·특수문자가 들어가면 IP가 차단될 수 있다. 최소 정제.
  const keyword = address.replace(/[^가-힣a-zA-Z0-9\s\-]/g, ' ').trim();

  const notes: string[] = [];
  let property: Property = { address };

  try {
    const list = await searchJuso(keyword);
    if (list.length === 0) {
      return NextResponse.json({ property, notes: ['해당 주소를 찾지 못했습니다. 도로명 주소를 확인해 주세요.'] });
    }
    // MVP: 첫 번째 결과 사용. 실제로는 화면에서 사용자가 고르게 해야 한다(TODO).
    const juso = list[0];
    if (list.length > 1) notes.push(`검색 결과가 ${list.length}건입니다. 첫 번째 주소로 조회했습니다.`);

    const lot = jusoToLotCode(juso);
    property = { address: juso.roadAddr ?? address, region: regionFromSiNm(juso.siNm) };

    const items = await fetchHubTitle(lot);
    const { item, ambiguous } = pickTitleItem(items);
    if (ambiguous) notes.push('한 지번에 건물이 여러 동입니다. 동을 특정할 수 없어 건물 정보는 자료 부족으로 처리됩니다.');
    if (!item && !ambiguous) notes.push('건축물대장 정보를 찾지 못했습니다.');

    property = hubTitleToProperty(property, item);
    notes.push('위반건축물 여부는 공개 API로 제공되지 않습니다. 정부24·세움터에서 건축물대장을 열람해 확인해 주세요.');

    return NextResponse.json({
      property,
      lot,
      housing: item ? resolveHousingType(item) : undefined,
      notes,
      fixtures: shouldUseFixtures(),
    });
  } catch (e) {
    console.error('[building]', e);
    return NextResponse.json({
      property,
      notes: [...notes, '외부 조회에 실패했습니다. 건물 정보는 자료 부족으로 처리됩니다.'],
    });
  }
}
