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

// ---- 라우트별 계약 ----
export type CheckRequest = DiagnosisCase;
export interface CheckResponse { pathResult: PathResult; ruleVersion: string; ruleSource: RuleSource; }

export interface BuildingRequest { address: string; }

export interface ReportRequest { pathResult: PathResult; }
export interface ReportResponse { report: string; llm: boolean; }
