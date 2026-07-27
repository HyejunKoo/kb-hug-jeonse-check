// src/types/api.ts — API 요청/응답·판정 결과
import type { DiagnosisCase } from './case';
import type { Verdict, RuleLayer, PathId, RuleSource } from './rule';

export interface CheckResult {
  ruleId: string;
  layer: RuleLayer;
  label: string;
  verdict: Verdict;
  reason: string;
  usedValues: string[];
  sourceUrl: string;
  effectiveFrom: string;
  nextAction: string;
}

export interface PathResult {
  path: PathId;
  pathLabel: string;
  blockedAt: 'NONE' | 'PRODUCT' | 'GUARANTEE' | 'INSUFFICIENT';
  results: CheckResult[];
  officialReviewCount: number;
}

/** diagnosis_cases.status — 종합 판정 상태 (DB enum과 1:1) */
export type OverallStatus = 'pass' | 'fail' | 'insufficient' | 'needs_review';

// ---- 라우트별 계약 ----
export type CheckRequest = DiagnosisCase;
export interface CheckResponse {
  pathResult: PathResult;
  ruleVersion: string;
  ruleSource: RuleSource;
  /** 로그인 사용자의 판정만 저장되며 이때만 채워진다 */
  caseId?: string;
}

export interface BuildingRequest { address: string; }

// ---- /api/ocr (F03 등기부 추출) ----
/** OCR 추출 신뢰도 상태. LOW_CONFIDENCE 기준값은 0.85 (features/registry/parser.ts OCR_CONFIDENCE_THRESHOLD) */
export type OcrFieldStatus = 'EXTRACTED' | 'LOW_CONFIDENCE' | 'MISSING';

export interface OcrFieldDraft<T> {
  value?: T;
  confidence: number; // MISSING이면 0
  status: OcrFieldStatus;
  evidence?: string;  // 판단 근거가 된 원문 일부 (짧은 스니펫만, 문서 전체 미포함)
}

/**
 * /api/ocr 응답 — 판정에 바로 쓰지 않는 "추출 후보"만 담는다.
 * ownerNameCandidate는 고객 확인 화면에서 임대인명과 비교하는 용도로만 쓰고
 * RegistryInfo/서버 저장(payload)에는 절대 포함하지 않는다.
 */
export interface RegistryOcrDraft {
  ownerNameCandidate?: OcrFieldDraft<string>;
  ownerType?: OcrFieldDraft<'INDIVIDUAL' | 'CORPORATION'>;
  seniorLienTotal?: OcrFieldDraft<number>;
  hasRightsViolation?: OcrFieldDraft<boolean>;
  issuedDate?: string;
}

export interface OcrResponse { draft: RegistryOcrDraft; }

export type OcrErrorCode =
  | 'OCR_NOT_CONFIGURED'
  | 'INVALID_FILE'
  | 'INVALID_REGISTRY_DOCUMENT'
  | 'OCR_PROVIDER_FAILED'
  | 'RATE_LIMITED';

export interface OcrErrorResponse { error: string; code: OcrErrorCode; }

export interface ReportRequest { pathResult: PathResult; }
export interface ReportResponse { report: string; llm: boolean; }

// ---- 저장된 진단 이력 (로그인 사용자 전용) ----
export interface CaseSummary {
  id: string;
  createdAt: string;
  pathLabel: string;
  blockedAt: PathResult['blockedAt'];
  status: OverallStatus | null;
  ruleVersion: string;
}
export interface CaseListResponse { cases: CaseSummary[]; }

export interface CaseDetailResponse {
  id: string;
  createdAt: string;
  pathResult: PathResult;
  status: OverallStatus | null;
  ruleVersion: string;
}
