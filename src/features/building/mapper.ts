// src/features/building/mapper.ts — 외부 응답 → 도메인 타입 매핑 (1번 담당)
// 실제 API 응답(2026-07 확인)에 맞춰 작성. 픽스처: __fixtures__/
import type { Property, Region } from '@/types';

// ---------- 공통 유틸 ----------

/** 건축HUB 응답은 빈 값을 ''가 아니라 공백 한 칸(' ')으로 보낸다. 반드시 거칠 것. */
export const clean = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t === '' ? undefined : t;
};

/** 건축HUB의 bun/ji는 4자리 0채움 필수. '317' → '0317' */
export const pad4 = (v: string | number): string => String(v).trim().padStart(4, '0');

// ---------- 주소검색 API → 지번코드 ----------

export interface JusoItem {
  siNm: string; sggNm: string; emdNm: string;
  roadAddr: string; jibunAddr: string;
  admCd: string;        // 10자리 법정동코드
  lnbrMnnm: string;     // 지번본번 → bun
  lnbrSlno: string;     // 지번부번 → ji
  mtYn: string;         // '1' = 산번지
  bdKdcd: string;       // '0' 일반건물 / '1' 공동주택
  bdNm: string;
}

export interface LotCode {
  sigunguCd: string;   // admCd 앞 5자리
  bjdongCd: string;    // admCd 뒤 5자리
  bun: string;         // 4자리
  ji: string;          // 4자리
  platGbCd: '0' | '1'; // 0=대지, 1=산
}

/** 주소검색 결과 1건 → 건축HUB 조회 파라미터 */
export function jusoToLotCode(j: JusoItem): LotCode {
  return {
    sigunguCd: j.admCd.slice(0, 5),
    bjdongCd: j.admCd.slice(5, 10),
    bun: pad4(j.lnbrMnnm),
    ji: pad4(j.lnbrSlno || '0'),
    platGbCd: j.mtYn === '1' ? '1' : '0',
  };
}

/** 수도권 판정 — 주소 문자열 파싱보다 siNm이 정확하다 */
export function regionFromSiNm(siNm: string): Region {
  const capital = ['서울특별시', '경기도', '인천광역시'];
  return capital.includes(siNm.trim()) ? 'CAPITAL' : 'NON_CAPITAL';
}

// ---------- 건축HUB 표제부 → Property ----------

export interface HubTitleItem {
  regstrGbCdNm?: string;    // '집합' | '일반'
  regstrKindCdNm?: string;  // '표제부' | '전유부' ...
  mainPurpsCdNm?: string;   // '공동주택' | '단독주택' | '제2종근린생활시설' ...
  etcPurps?: string;
  mainAtchGbCdNm?: string;  // '주건축물' | '부속건축물'
  hhldCnt?: number;         // 세대수 (공동주택)
  fmlyCnt?: number;         // 가구수 (다가구)
  hoCnt?: number;           // 호수
  totArea?: number;
  useAprDay?: string;
  bldNm?: string;
  dongNm?: string;
  platPlc?: string;
  newPlatPlc?: string;
}

/**
 * 주택 유형 판정.
 * mainPurpsCdNm('공동주택'/'단독주택')만으로는 다가구를 구분할 수 없어
 * 대장 구분(집합/일반) + 가구수(fmlyCnt)를 함께 본다.
 *
 * - 집합대장 → 호별 개별 등기 (다세대·연립·아파트)
 * - 일반대장 + 가구수>0 → 다가구 (건물 전체 1개 등기, 선순위 임차보증금 위험)
 *
 * HUG 담보인정비율이 다가구 80% / 그 외 90%로 갈리므로 이 분기가 중요하다.
 */
export type HousingType = 'MULTI_UNIT' | 'MULTI_FAMILY' | 'DETACHED' | 'NON_RESIDENTIAL' | 'UNKNOWN';

export function resolveHousingType(t: HubTitleItem): { type: HousingType; label: string; basis: string } {
  const registerType = clean(t.regstrGbCdNm);           // 집합 / 일반
  const purpose = clean(t.mainPurpsCdNm) ?? clean(t.etcPurps);
  const fmly = t.fmlyCnt ?? 0;
  const hhld = t.hhldCnt ?? 0;

  if (!registerType || !purpose) {
    return { type: 'UNKNOWN', label: '판정 불가', basis: '대장구분 또는 주용도 값 없음' };
  }

  if (purpose === '공동주택' || registerType === '집합') {
    return {
      type: 'MULTI_UNIT',
      label: '공동주택(다세대·연립·아파트)',
      basis: `대장구분 ${registerType} · 주용도 ${purpose} · 세대수 ${hhld}`,
    };
  }

  if (purpose === '단독주택') {
    if (fmly > 0) {
      return {
        type: 'MULTI_FAMILY',
        label: '다가구주택',
        basis: `대장구분 ${registerType} · 주용도 단독주택 · 가구수 ${fmly}`,
      };
    }
    return {
      type: 'DETACHED',
      label: '단독주택',
      basis: `대장구분 ${registerType} · 주용도 단독주택 · 가구수 0`,
    };
  }

  return { type: 'NON_RESIDENTIAL', label: `주택 외 용도(${purpose})`, basis: `주용도 ${purpose}` };
}

/** 표제부 응답 배열에서 판정 대상 1건 고르기 */
export function pickTitleItem(items: HubTitleItem[]): { item?: HubTitleItem; ambiguous: boolean } {
  const main = items.filter(
    (i) => clean(i.regstrKindCdNm) === '표제부' && clean(i.mainAtchGbCdNm) !== '부속건축물',
  );
  if (main.length === 1) return { item: main[0], ambiguous: false };
  // 동이 여러 개인 단지 → 어느 동인지 특정 불가. 추정하지 않고 자료 부족으로 넘긴다.
  return { item: undefined, ambiguous: main.length > 1 };
}

export function hubTitleToProperty(
  base: { address: string; region?: Region },
  item: HubTitleItem | undefined,
): Property {
  const p: Property = { address: base.address, region: base.region };
  if (!item) return p;

  const housing = resolveHousingType(item);
  const purpose = clean(item.mainPurpsCdNm);

  if (purpose) p.buildingUse = { value: purpose, source: 'PUBLIC_API' };
  if (housing.type !== 'UNKNOWN') p.housingType = { value: housing.label, source: 'PUBLIC_API' };

  // 위반건축물: 건축HUB 표제부·기본개요 어디에도 필드가 없다 (2026-07 확인).
  // 추정하지 않고 값을 비워 둔다 → 규칙엔진이 '자료 부족'으로 판정하고
  // 사용자에게 정부24/세움터 건축물대장 열람을 안내한다.
  return p;
}
