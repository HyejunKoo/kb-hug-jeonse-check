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
