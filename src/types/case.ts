// src/types/case.ts — 진단 건(입력 도메인) 타입

/** 값의 출처 라벨 — 모든 판정 입력값에 반드시 붙는다 */
export type SourceCode =
  | 'USER_DECLARED'            // 자기신고
  | 'USER_CONFIRMED_DOCUMENT'  // 업로드 문서에서 추출 후 고객이 확인
  | 'PUBLIC_API'               // 건축HUB 등 공공 API
  | 'INTERNAL_REQUIRED';       // 기관 내부정보 필요 (접근 불가)

export interface Field<T> {
  value: T;
  source: SourceCode;
}

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

export type Region = 'CAPITAL' | 'NON_CAPITAL';

export interface Property {
  address: string;
  region?: Region;
  buildingUse?: Field<string>;
  housingType?: Field<string>;        // 자기신고 경로 없음
  isIllegalBuilding?: Field<boolean>;
  exclusiveArea?: Field<number>;
}

export interface RegistryInfo {
  ownerName?: Field<string>;
  ownerType?: Field<'INDIVIDUAL' | 'CORPORATION'>;
  seniorLienTotal?: Field<number>;
  hasRightsViolation?: Field<boolean>;
  issuedDate?: string;
}

export interface DiagnosisCase {
  applicant: Applicant;
  contract: PlannedContract;
  property: Property;
  registry?: RegistryInfo;
}
