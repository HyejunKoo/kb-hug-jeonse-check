// src/types/api.ts — API 요청/응답·판정 결과
import type { DiagnosisCase } from './case';
import type { Verdict, RuleLayer, PathId, RuleSource, GuaranteeProvider } from './rule';

export interface CheckResult {
  ruleId: string;
  layer: RuleLayer;
  label: string;
  verdict: Verdict;
  reason: string;
  usedValues: string[];
  /** F04 내부 충분성 검사는 외부 출처가 없으므로 비어 있다. */
  sourceUrl?: string;
  effectiveFrom?: string;
  ruleOrigin?: RuleSource;
  verifiedAt?: string;
  sourceContentSha256?: string;
  sourceEvidence?: string[];
  nextAction: string;
}

export interface PathResult {
  path: PathId;
  pathLabel: string;
  guaranteeProvider: GuaranteeProvider;
  guaranteeLabel: string;
  blockedAt: 'NONE' | 'PRODUCT' | 'GUARANTEE' | 'INSUFFICIENT' | 'ACTION_REQUIRED';
  results: CheckResult[];
  officialReviewCount: number;
}

/** diagnosis_cases.status — 종합 판정 상태 (DB enum과 1:1) */
export type OverallStatus = 'pass' | 'fail' | 'insufficient' | 'needs_review' | 'needs_action';

// ---- F10 다음 행동 묶음 ----
// 판정을 새로 만들지 않는다. 이미 나온 CheckResult.nextAction을 "누구에게 무엇을 확인하는가"로
// 재분류할 뿐이다. 순수 함수는 features/result/action-plan.ts의 buildActionPlan().

/** 이 행동을 누구에게/무엇으로 해야 하는가 */
export type ActionCategory =
  | 'SUPPLEMENTAL_DOCUMENT' // 추가로 제출·보완해야 하는 자료
  | 'LANDLORD_CONFIRMATION' // 임대인에게 확인·요청할 사항
  | 'BROKER_CONFIRMATION' // 중개사·계약 방식에서 확인할 사항
  | 'KB_QUESTION' // KB 상담에서 물어볼 질문
  | 'CONTRACT_HOLD'; // 계약 보류 권고 (공개요건과 확정 충돌)

/** 표시 강조도. 판정 언어가 아니라 UI 우선순위 표시일 뿐이다. */
export type ActionSeverity = 'info' | 'warning' | 'critical';

export interface ActionItem {
  /** `${category}:${sourceRuleIds.join('+')}` — 같은 입력이면 항상 같은 id */
  id: string;
  category: ActionCategory;
  severity: ActionSeverity;
  /** 어떤 항목에서 나온 행동인지 (규칙 label) */
  title: string;
  /** 실제 다음 행동 문구 — CheckResult.nextAction 을 그대로 쓴다 */
  detail: string;
  /** 이 행동을 만든 규칙·F04 이슈 id (같은 문구는 하나로 합치고 id를 모은다) */
  sourceRuleIds: string[];
}

export interface ActionPlan {
  /** 결정론적으로 고른 한 줄 요약. 승인 가능성을 표현하지 않는다. */
  headline: string;
  contractHoldRecommended: boolean;
  items: ActionItem[];
}

// ---- 라우트별 계약 ----
export type CheckRequest = DiagnosisCase;
export interface CheckResponse {
  pathResults: PathResult[];
  ruleVersion: string;
  ruleSource: RuleSource;
  /** F10 — pathResults에서 파생되는 값이라 저장하지 않고 매번 다시 계산한다 */
  actionPlan: ActionPlan;
  /** 로그인 사용자의 판정만 저장되며 이때만 채워진다 */
  caseId?: string;
}

export interface BuildingRequest {
  address: string;
}

// ---- /api/ocr (F03 등기부 추출) ----
/** OCR 추출 신뢰도 상태. LOW_CONFIDENCE 기준값은 0.85 (features/registry/parser.ts OCR_CONFIDENCE_THRESHOLD) */
export type OcrFieldStatus = 'EXTRACTED' | 'LOW_CONFIDENCE' | 'MISSING';

export interface OcrFieldDraft<T> {
  value?: T;
  confidence: number; // MISSING이면 0
  status: OcrFieldStatus;
  evidence?: string; // 판단 근거가 된 원문 일부 (짧은 스니펫만, 문서 전체 미포함)
}

/**
 * /api/ocr 응답 — 판정에 바로 쓰지 않는 "추출 후보"만 담는다.
 * ownerNameCandidates는 고객 확인 화면에서 임대인명과 비교하는 용도로만 쓰고
 * RegistryInfo/서버 저장(payload)에는 절대 포함하지 않는다. 공동소유(공유자)면 여러 명이 담긴다.
 */
export interface RegistryOcrDraft {
  ownerNameCandidates?: OcrFieldDraft<string[]>;
  ownerType?: OcrFieldDraft<'INDIVIDUAL' | 'CORPORATION'>;
  seniorLienTotal?: OcrFieldDraft<number>;
  hasRightsViolation?: OcrFieldDraft<boolean>;
  /** 을구에 기존 전세권·임차권 등 등록된 권리가 남아있는지 */
  existingLeaseholdRights?: OcrFieldDraft<boolean>;
  /** 표제부 소재지 표기 — 고객이 선택한 매물 주소와 대조하는 데 쓴다 (F04) */
  documentAddress?: OcrFieldDraft<string>;
  issuedDate?: string;
}

export interface OcrResponse {
  draft: RegistryOcrDraft;
}

export type OcrErrorCode =
  | 'OCR_NOT_CONFIGURED'
  | 'INVALID_FILE'
  | 'INVALID_REGISTRY_DOCUMENT'
  | 'OCR_PROVIDER_FAILED'
  | 'RATE_LIMITED';

export interface OcrErrorResponse {
  error: string;
  code: OcrErrorCode;
}

// ---- /api/report (F11 KB 상담용 요약) ----
/**
 * 고객이 동의한 경우에만 Gemini로 전송한다. consent !== true 면 400이고 Gemini를 호출하지 않는다.
 * 보고서 텍스트는 저장하지 않는다 — 화면 표시와 복사만 제공한다.
 */
export interface ReportRequest {
  /** 입력값·판정을 Gemini로 보내는 것에 대한 명시 동의. true가 아니면 호출 자체를 하지 않는다 */
  consent: boolean;
  pathResults: PathResult[];
  /** 판정에 쓰인 입력값과 출처. 없으면 보고서에서 입력 요약 절만 빠진다 */
  diagnosis?: DiagnosisCase;
  /**
   * 참고용. 서버는 이 값을 신뢰하지 않고 pathResults로 buildActionPlan()을 다시 돌린다 —
   * 클라이언트가 임의 문구를 프롬프트에 끼워 넣지 못하게 하기 위함.
   */
  actionPlan?: ActionPlan;
}

export type ReportErrorCode = 'INVALID_BODY' | 'CONSENT_REQUIRED' | 'NO_PATH_RESULTS';

export interface ReportErrorResponse {
  error: string;
  code: ReportErrorCode;
}

export interface ReportResponse {
  report: string;
  llm: boolean;
}

// ---- 저장된 진단 이력 (로그인 사용자 전용) ----
export interface CaseSummary {
  id: string;
  createdAt: string;
  pathLabel: string;
  blockedAt: PathResult['blockedAt'];
  status: OverallStatus | null;
  ruleVersion: string;
}
export interface CaseListResponse {
  cases: CaseSummary[];
}

export interface CaseDetailResponse {
  id: string;
  createdAt: string;
  pathResults: PathResult[];
  status: OverallStatus | null;
  ruleVersion: string;
}
