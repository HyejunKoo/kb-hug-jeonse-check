// src/types/rule.ts — 규칙팩·판정 언어

/** 5단계 판정 언어 (기획서 판정 언어와 1:1) */
export type Verdict =
  | 'PUBLIC_REQUIREMENT_UNMET'   // 공개요건 미충족
  | 'NO_PUBLIC_CONFLICT_FOUND'   // 확인된 충돌 없음 (승인 의미 아님)
  | 'MISSING_INFORMATION'        // 자료 부족
  | 'POST_CONTRACT_REQUIREMENT'  // 계약 후 충족 요건
  | 'OFFICIAL_REVIEW_REQUIRED';  // 공식 심사 필요

/**
 * SUFFICIENCY는 규칙팩에 들어가지 않는다 — F04(진단자료 충분성 검사)가 자체 생성하는 층이다.
 * 상품·보증 요건과 달리 외부 공개요건이 아니라 "판정을 시작할 자료가 갖춰졌는가"를 본다.
 */
export type RuleLayer = 'SUFFICIENCY' | 'PRODUCT' | 'GUARANTEE';
export type PathId = 'KB_STAR_HUG';

export interface Rule {
  ruleId: string;
  layer: RuleLayer;
  path: PathId;
  label: string;
  checkId: string;               // rule-engine/evaluator.ts의 체크 함수 키
  params?: Record<string, number | string | boolean>;
  sourceUrl: string;
  effectiveFrom: string;         // YYYY-MM-DD
}

export interface RulePack {
  version: string;
  updatedAt: string;
  rules: Rule[];
}

/** 규칙팩이 어디서 왔는지 (크롤링 성공 vs JSON 폴백) */
export type RuleSource = 'CRAWLED' | 'FALLBACK_JSON';
