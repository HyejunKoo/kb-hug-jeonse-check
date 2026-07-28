// src/features/building/mapper.ts — 외부 응답 → 도메인 타입 매핑 (1번 담당)
// 실제 API 응답(2026-07 확인)에 맞춰 작성. 픽스처: __fixtures__/
import type { Property, Region, PropertyTypeCode } from '@/types';

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
  udrtYn?: string;      // '1' = 지하. 전세 매물 대상 아님
  bdMgtSn?: string;     // 건물관리번호 (목록 key)
  zipNo?: string;
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
  archArea?: number;
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
export interface HousingResolution {
  code: PropertyTypeCode;
  label: string;
  isMultiFamily: boolean;  // 다가구 여부 (DETACHED 중에서도 가구수>0)
  basis: string;
}

export function resolveHousingType(t: HubTitleItem): HousingResolution {
  const registerType = clean(t.regstrGbCdNm);           // 집합 / 일반
  const purpose = clean(t.mainPurpsCdNm) ?? clean(t.etcPurps);
  const etc = clean(t.etcPurps) ?? '';
  const fmly = t.fmlyCnt ?? 0;
  const hhld = t.hhldCnt ?? 0;

  if (!registerType || !purpose) {
    return { code: 'OUT_OF_SCOPE', label: '판정 불가', isMultiFamily: false, basis: '대장구분 또는 주용도 값 없음' };
  }

  const base = `대장구분 ${registerType} · 주용도 ${purpose}`;

  // 주거용 오피스텔은 주용도가 업무시설로 기재되므로 세부용도 문자열로 확인
  if (/오피스텔/.test(purpose) || /오피스텔/.test(etc)) {
    return { code: 'OFFICETEL', label: '오피스텔', isMultiFamily: false, basis: `${base} (주거용 여부는 별도 확인 필요)` };
  }

  if (purpose === '공동주택' || registerType === '집합') {
    if (/아파트/.test(purpose) || /아파트/.test(etc)) {
      return { code: 'APT', label: '아파트', isMultiFamily: false, basis: `${base} · 세대수 ${hhld}` };
    }
    return {
      code: 'MULTI_UNIT',
      label: '공동주택(다세대·연립·아파트)',
      isMultiFamily: false,
      basis: `${base} · 세대수 ${hhld}`,
    };
  }

  if (purpose === '단독주택') {
    // 다가구는 단독주택의 한 종류. 가구수(fmlyCnt)로 구분한다.
    const multi = fmly > 0;
    return {
      code: 'DETACHED',
      label: multi ? '다가구주택' : '단독주택',
      isMultiFamily: multi,
      basis: `${base} · 가구수 ${fmly}`,
    };
  }

  return { code: 'OUT_OF_SCOPE', label: `주택 외 용도(${purpose})`, isMultiFamily: false, basis: base };
}

/** 표제부 응답 배열에서 판정 대상 1건 고르기 */
/**
 * 대장 종류 표기가 대장구분에 따라 다르다 (2026-07 실응답 확인).
 *   집합대장(다세대·아파트) → '표제부'
 *   일반대장(단독·다가구)   → '일반건축물'   ← 다가구가 여기 속한다
 */
const TITLE_KINDS = ['표제부', '일반건축물'];

export function pickTitleItem(
  items: HubTitleItem[],
): { item?: HubTitleItem; ambiguous: boolean; onlyAnnex: boolean } {
  const kindMatched = items.filter((i) => TITLE_KINDS.includes(clean(i.regstrKindCdNm) ?? ''));
  // 부속건축물(창고·주차장 등)은 주거 판정 대상이 아니다
  const main = kindMatched.filter((i) => clean(i.mainAtchGbCdNm) !== '부속건축물');

  if (main.length === 1) return { item: main[0], ambiguous: false, onlyAnnex: false };
  // 주건축물이 없고 부속건축물만 조회된 경우 (예: 경기장 부속동)
  if (main.length === 0 && kindMatched.length > 0) {
    return { item: undefined, ambiguous: false, onlyAnnex: true };
  }
  // 동이 여러 개인 단지 → 어느 동인지 특정 불가. 추정하지 않고 자료 부족으로 넘긴다.
  return { item: undefined, ambiguous: main.length > 1, onlyAnnex: false };
}

/** 주소검색 결과 1건 → 건축HUB 조회 전의 Property 뼈대 (주소·지역만 채워진 상태) */
export function jusoToProperty(j: JusoItem): Property {
  const jibun = clean(j.jibunAddr);
  return {
    address: { value: clean(j.roadAddr) ?? jibun ?? '', source: 'PUBLIC_API' },
    // 등기부 소재지는 지번 주소로 표기되므로 F04의 주소 대조에 이 값이 필요하다
    jibunAddress: jibun ? { value: jibun, source: 'PUBLIC_API' } : undefined,
    region: { value: regionFromSiNm(j.siNm), source: 'PUBLIC_API' },
  };
}

export function hubTitleToProperty(base: Property, item: HubTitleItem | undefined): Property {
  const p: Property = {
    ...base,
    fetchedAt: new Date().toISOString(),  // 명세 F-02: 조회시각 저장
  };
  if (!item) return p;

  const housing = resolveHousingType(item);
  const purpose = clean(item.mainPurpsCdNm);

  if (purpose) p.buildingUse = { value: purpose, source: 'PUBLIC_API' };
  p.propertyType = { value: housing.code, source: 'PUBLIC_API' };
  p.propertyTypeLabel = housing.label;
  p.isMultiFamily = { value: housing.isMultiFamily, source: 'PUBLIC_API' };

  // 위반건축물: 건축HUB 표제부·기본개요 어디에도 필드가 없다 (2026-07 확인).
  // 추정하지 않고 값을 비워 둔다 → 사용자가 건축물대장을 열람해 직접 확인한 값
  // (USER_CONFIRMED_DOCUMENT)이 들어오기 전까지 F04가 자료 부족으로 판정을 막는다.
  return p;
}
