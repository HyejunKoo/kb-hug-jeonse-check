// POST /api/address — 주소 후보 검색 (F02, 1번 담당)
// body: { address } → { candidates: JusoItem[] }
// 사용자가 목록에서 하나를 고른 뒤 /api/building 으로 넘긴다.
import { NextResponse } from 'next/server';
import jusoFixture from '@/features/building/__fixtures__/juso-search.json';
import type { JusoItem } from '@/features/building/mapper';

export const maxDuration = 30;

const JUSO_URL = 'https://business.juso.go.kr/addrlink/addrLinkApi.do';

export async function POST(req: Request) {
  const { address } = (await req.json()) as { address?: string };
  if (!address?.trim()) {
    return NextResponse.json({ error: '주소를 입력해 주세요.' }, { status: 400 });
  }

  // 주소검색 API는 SQL 예약어·특수문자가 들어가면 IP가 차단될 수 있다.
  const keyword = address.replace(/[^가-힣a-zA-Z0-9\s\-]/g, ' ').trim();
  if (keyword.length < 2) {
    return NextResponse.json({ candidates: [], notes: ['검색어가 너무 짧습니다.'] });
  }

  const key = process.env.JUSO_API_KEY;
  const useFixture = process.env.USE_FIXTURES === '1' || !key;

  try {
    let list: JusoItem[];
    if (useFixture) {
      list = jusoFixture.results.juso as unknown as JusoItem[];
    } else {
      const u = new URL(JUSO_URL);
      u.searchParams.set('confmKey', key!);
      u.searchParams.set('currentPage', '1');
      u.searchParams.set('countPerPage', '20');
      u.searchParams.set('keyword', keyword);
      u.searchParams.set('resultType', 'json');
      const res = await fetch(u, { cache: 'no-store' });
      const data = await res.json();
      if (data?.results?.common?.errorCode !== '0') {
        return NextResponse.json({
          candidates: [],
          notes: [`주소 검색 실패: ${data?.results?.common?.errorMessage ?? '알 수 없는 오류'}`],
        });
      }
      list = (data.results.juso ?? []) as JusoItem[];
    }

    // 지하 주소(udrtYn='1')는 전세 매물 대상이 아니므로 제외
    const candidates = list.filter((j) => j.udrtYn !== '1');

    const notes: string[] = [];
    if (candidates.length === 0) {
      notes.push('해당 주소를 찾지 못했습니다. 도로명 주소로 다시 검색해 보세요. (예: 월드컵로 240)');
    }
    return NextResponse.json({ candidates, notes, fixtures: useFixture });
  } catch (e) {
    console.error('[address]', e);
    return NextResponse.json({ candidates: [], notes: ['주소 검색 중 오류가 발생했습니다.'] });
  }
}
