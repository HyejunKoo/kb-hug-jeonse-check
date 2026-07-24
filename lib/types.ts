// ============================================================
// lib/types.ts — 공통 타입 (팀 전체가 이 파일만 import)
// 새 타입이 필요하면 여기에 추가하고 단톡에 공유할 것
// ============================================================

/** 값의 출처 라벨 — 모든 판정 입력값에 반드시 붙는다 */
export type SourceCode =
  | 'USER_DECLARED'            // 자기신고
  | 'USER_CONFIRMED_DOCUMENT'  // 업로드 문서에서 추출 후 고객이 확인
  | 'PUBLIC_API'               // 건축HUB 등 공공 API
  | 'INTERNAL_REQUIRED';       // 기관 내부정보 필요 (접근 불가)

/** 5단계 판정 언어 (기획서 3-2 판정 언어와 1:1 대응) */
export type Verdict =
  | 'PUBLIC_REQUIREMENT_UNMET'   // 공개요건 미충족
  | 'NO_PUBLIC_CONFLICT_FOUND'   // 확인된 충돌 없음 (승인 의미 아님)
  | 'MISSING_INFORMATION'        // 자료 부족
  | 'POST_CONTRACT_REQUIREMENT'  // 계약 후 충족 요건
  | 'OFFICIAL_REVIEW_REQUIRED';  // 공식 심사 필요

/** 출처가 붙은 값 */
export interface Field<T> {
  value: T;
  source: SourceCode;
}

// ---------- 입력 (F01) ----------

export type IncomeBand = 'UNDER_50M' | 'B50_60M' | 'B60_70M' | 'OVER_70M' | 'UNKNOWN';
export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'ENGAGED';
export type IncomeType = 'EMPLOYED' | 'SELF_EMPLOYED' | 'NO_INCOME';
export type HomeCount = 0 | 1 | 2; // 2 = "2채 이상"

export interface Applicant {
  age: number;
  isHouseholder: boolean;
  homeCount: HomeCount;
  maritalStatus: MaritalStatus;
  incomeBand: IncomeBand;          // 상한 O/X 판정용. 한도 계산 아님
  incomeType: IncomeType;
  hasExistingJeonseLoan: boolean;
}

export interface PlannedContract {
  deposit: number;        // 원 단위
  termMonths: number;
  moveInDate: string;     // YYYY-MM-DD
  brokered: boolean;      // 공인중개사 중개 여부
}

// ---------- 매물 (F02 건축HUB / F03 등기부) ----------

export type Region = 'CAPITAL' | 'NON_CAPITAL'; // 수도권/비수도권

export interface Property {
  address: string;
  region?: Region;                    // 주소에서 파싱
  buildingUse?: Field<string>;        // 건축물 용도
  housingType?: Field<string>;        // 아파트/다가구/다세대 등 — 자기신고 경로 없음
  isIllegalBuilding?: Field<boolean>; // 위반건축물 여부
  exclusiveArea?: Field<number>;      // 전용면적 ㎡
}

export interface RegistryInfo {
  ownerName?: Field<string>;
  ownerType?: Field<'INDIVIDUAL' | 'CORPORATION'>;
  seniorLienTotal?: Field<number>;    // 근저당 설정액 합계 (원)
  hasRightsViolation?: Field<boolean>; // 압류/가압류/경매/가처분/가등기
  issuedDate?: string;                // 등기부 발급일 YYYY-MM-DD
}

// ---------- 진단 건 (하나의 case) ----------

export interface DiagnosisCase {
  applicant: Applicant;
  contract: PlannedContract;
  property: Property;
  registry?: RegistryInfo;
}

// ---------- 규칙팩 (rules/*.json) ----------

/** 규칙팩 JSON의 규칙 1건. checkId는 ruleEngine.ts의 체크 함수명과 매칭 */
export interface Rule {
  ruleId: string;            // 예: 'KB-HUG-AGE'
  layer: 'PRODUCT' | 'GUARANTEE'; // 1층 KB 상품 / 2층 보증기관
  path: 'KB_STAR_HUG';       // MVP는 HUG 경로만
  label: string;             // 사람이 읽는 규칙명
  checkId: string;           // 엔진의 판정 함수 키
  params?: Record<string, number | string | boolean>;
  sourceUrl: string;         // 공식 출처
  effectiveFrom: string;     // 기준일 YYYY-MM-DD
}

export interface RulePack {
  version: string;
  updatedAt: string;
  rules: Rule[];
}

// ---------- 판정 결과 (F05~F07, F09, F10) ----------

export interface CheckResult {
  ruleId: string;
  layer: 'PRODUCT' | 'GUARANTEE';
  label: string;
  verdict: Verdict;
  reason: string;            // 어떤 값에 어떤 기준을 적용했는지
  usedValues: string[];      // 근거 표시용 "입력값(출처)" 문자열들
  sourceUrl: string;
  effectiveFrom: string;
  nextAction: string;        // 다음 행동 (없으면 '')
}

export interface PathResult {
  path: 'KB_STAR_HUG';
  pathLabel: string;
  blockedAt: 'NONE' | 'PRODUCT' | 'GUARANTEE' | 'INSUFFICIENT'; // 어느 층에서 막혔나
  results: CheckResult[];
  officialReviewCount: number; // '공식 심사 필요' 개수 — 충돌없음과 항상 함께 표시
}
