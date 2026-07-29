// src/types/rule.ts — 규칙팩·판정 언어

/** 5단계 판정 언어 (기획서 판정 언어와 1:1) */
export type Verdict =
  | 'PUBLIC_REQUIREMENT_UNMET' // 공개요건 미충족
  | 'NO_PUBLIC_CONFLICT_FOUND' // 확인된 충돌 없음 (승인 의미 아님)
  | 'MISSING_INFORMATION' // 자료 부족
  | 'POST_CONTRACT_REQUIREMENT' // 계약 후 충족 요건
  | 'PRE_GUARANTEE_ACTION_REQUIRED' // 보증 실행 전 해결해야 하는 선행조치
  | 'OFFICIAL_REVIEW_REQUIRED'; // 공식 심사 필요

/**
 * SUFFICIENCY는 규칙팩에 들어가지 않는다 — F04(진단자료 충분성 검사)가 자체 생성하는 층이다.
 * 상품·보증 요건과 달리 외부 공개요건이 아니라 "판정을 시작할 자료가 갖춰졌는가"를 본다.
 */
export type RuleLayer = 'SUFFICIENCY' | 'PRODUCT' | 'GUARANTEE';
/** 현재 판정은 HUG만 실행하며, 나머지는 기존 저장 결과를 읽기 위한 호환 식별자다. */
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
  /** 공식 시행일. 공시에서 확인되지 않으면 UNCONFIRMED. */
  effectiveFrom: string;
  /** 실크롤링으로 만든 규칙인지 JSON 폴백인지 개별 규칙에도 남긴다. */
  origin?: RuleSource;
  /** 실크롤링 검증 시각과 그 응답의 증거. JSON 폴백에는 없다. */
  verifiedAt?: string;
  sourceContentSha256?: string;
  sourceEvidence?: string[];
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

/** 규칙팩이 어디서 왔는지 (이번 크롤링/마지막 정상 DB 스냅샷/JSON 폴백) */
export type RuleSource = 'CRAWLED' | 'SUPABASE_SNAPSHOT' | 'FALLBACK_JSON';
