// src/types/rule.ts — 규칙팩·판정 언어

/** 5단계 판정 언어 (기획서 판정 언어와 1:1) */
export type Verdict =
  | 'PUBLIC_REQUIREMENT_UNMET' // 공개요건 미충족
  | 'NO_PUBLIC_CONFLICT_FOUND' // 확인된 충돌 없음 (승인 의미 아님)
  | 'MISSING_INFORMATION' // 자료 부족
  | 'POST_CONTRACT_REQUIREMENT' // 계약 후 충족 요건
  | 'OFFICIAL_REVIEW_REQUIRED'; // 공식 심사 필요

export type RuleLayer = 'PRODUCT' | 'GUARANTEE';
export type PathId = 'KB_STAR_HUG' | 'KB_STAR_HF' | 'KB_STAR_SGI' | 'KB_YOUTH_HF';
export type GuaranteeProvider = 'HUG' | 'HF' | 'SGI';

export interface Rule {
  ruleId: string;
  layer: RuleLayer;
  /** 한 규칙을 여러 상품 경로에서 재사용할 수 있다 (공통 보증 규칙팩). */
  paths: PathId[];
  label: string;
  checkId: string; // rule-engine/evaluator.ts의 체크 함수 키
  params?: Record<string, number | string | boolean>;
  sourceUrl: string;
  effectiveFrom: string; // YYYY-MM-DD
}

export interface RulePack {
  version: string;
  updatedAt: string;
  rules: Rule[];
}

/** 공식 페이지를 실제로 조회하고 필수 문구를 검증한 결과. */
export interface CrawlSourceReport {
  sourceId: string;
  url: string;
  finalUrl?: string;
  ok: boolean;
  attempts: number;
  status?: number;
  contentType?: string;
  charset?: string;
  bytes?: number;
  title?: string;
  matchedRequirements: string[];
  evidence?: Record<string, string>;
  contentSha256?: string;
  fetchedAt: string;
  error?: string;
}

export interface CrawlSummary {
  success: boolean;
  reports: CrawlSourceReport[];
}

/** 규칙팩이 어디서 왔는지 (크롤링 성공 vs JSON 폴백) */
export type RuleSource = 'CRAWLED' | 'FALLBACK_JSON';
