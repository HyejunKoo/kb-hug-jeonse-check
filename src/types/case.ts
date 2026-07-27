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
export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'PLANNED';
export type IncomeType = 'EMPLOYED' | 'SELF_EMPLOYED' | 'NO_INCOME';
export type HomeCount = 0 | 1 | 2;                                  // 2 = "2채 이상"
export type HouseholdHead = 'YES' | 'NO' | 'PLANNED';               // PLANNED = 세대주 예정자
export type ExistingJeonseLoan = 'NONE' | 'HAS_ONE' | 'HAS_MULTIPLE';

export interface Applicant {
  age: number;                          // 19~99
  householdHead: HouseholdHead;
  homeCount: HomeCount;
  maritalStatus: MaritalStatus;
  incomeBand: IncomeBand;               // 상한 O/X 판정용. 한도 계산 금지
  incomeType: IncomeType;
  existingJeonseLoan: ExistingJeonseLoan;
}

export interface PlannedContract {
  deposit: number;        // 원 단위
  termMonths: number;
  moveInDate: string;     // YYYY-MM-DD
  brokered: boolean;      // 공인중개사 중개 여부
}

export type Region = 'CAPITAL' | 'NON_CAPITAL';

/** 명세 F-02 주택 유형 매핑 코드. 임계값 분기의 기준. */
export type PropertyTypeCode =
  | 'APT'           // 아파트 — HUG 담보인정 90%
  | 'MULTI_UNIT'    // 연립·다세대 — 90%
  | 'DETACHED'      // 단독·다가구 — 80%, HF는 80%+60% 동시충족
  | 'OFFICETEL'     // 주거용 오피스텔 — 90%
  | 'OUT_OF_SCOPE'; // 그 외 — 대상주택 요건 미충족

export interface Property {
  address: string;
  region?: Region;                        // DERIVED
  buildingUse?: Field<string>;            // 건축물대장 주용도 원문
  propertyType?: Field<PropertyTypeCode>; // 자기신고 경로 없음 (명세 완료조건)
  propertyTypeLabel?: string;             // 화면 표기용 한글
  isMultiFamily?: boolean;                // 다가구 여부 (선순위 임차보증금 경고용)
  isIllegalBuilding?: Field<boolean>;     // 공개 API 미제공 → 현재 항상 미확보
  exclusiveArea?: Field<number>;          // 전용면적 ㎡
  fetchedAt?: string;                     // 공공API 조회시각 ISO. 명세 F-02 저장정보
}

export interface RegistryInfo {
  /** 등기부 소유자와 계약 임대인이 같은 사람인지 — 실명은 저장하지 않고 결과만 저장 */
  ownerMatch?: Field<boolean>;
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
