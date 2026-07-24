// src/features/intake/schema.ts — F01 입력 기본값·검증 (1번 담당)
import type { Applicant, PlannedContract } from '@/types';

export const DEFAULT_APPLICANT: Applicant = {
  age: 28, isHouseholder: true, homeCount: 0, maritalStatus: 'SINGLE',
  incomeBand: 'UNDER_50M', incomeType: 'EMPLOYED', hasExistingJeonseLoan: false,
};

export const DEFAULT_CONTRACT: PlannedContract = {
  deposit: 200000000, termMonths: 24, moveInDate: '', brokered: true,
};

/** 다음 단계 이동 전 최소 검증. 오류 메시지 배열 반환 (빈 배열 = 통과) */
export function validateApplicant(a: Applicant): string[] {
  const errs: string[] = [];
  if (!Number.isFinite(a.age) || a.age < 1 || a.age > 120) errs.push('연령을 확인해 주세요.');
  return errs;
}

export function validateContract(c: PlannedContract): string[] {
  const errs: string[] = [];
  if (!Number.isFinite(c.deposit) || c.deposit <= 0) errs.push('보증금을 입력해 주세요.');
  if (!Number.isFinite(c.termMonths) || c.termMonths <= 0) errs.push('계약기간을 입력해 주세요.');
  return errs;
}
