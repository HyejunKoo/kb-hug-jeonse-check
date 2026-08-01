// src/features/intake/schema.ts — F01 입력 기본값·검증 (1번 담당)
// 명세 F-01 입력 필드 정의·완료 조건 기준
import type { ApplicantInput, PlannedContractInput, Property } from '@/types';

// 숫자 입력은 0으로 비워 둔다. 그럴듯한 값(28세·2억·24개월)을 미리 채워두면 사용자가 자기
// 값으로 착각한 채 넘어간다 — 화면에서는 0을 빈 칸으로 그리고 placeholder 로 예시를 보여준다.
// 0 은 validateApplicant·validateContract 가 이미 오류로 잡으므로 그냥 통과할 수 없다.
export const DEFAULT_APPLICANT: ApplicantInput = {
  age: 0,
  householdHead: 'YES',
  homeCount: 0,
  maritalStatus: 'SINGLE',
  incomeBand: 'UNDER_50M',
  incomeType: 'EMPLOYED',
  existingJeonseLoan: 'NONE',
};

export const DEFAULT_CONTRACT: PlannedContractInput = {
  deposit: 0,
  termMonths: 0,
  moveInDate: '',
  brokered: true,
};

/**
 * 주소를 아직 고르지 않은 상태의 매물.
 * address는 필수 필드라 빈 값으로 자리를 잡아두고, 실제 판정 진입은
 * 화면의 주소 선택 가드와 F04(F04-PROPERTY-ADDRESS)가 함께 막는다.
 */
export const EMPTY_PROPERTY: Property = {
  address: { value: '', source: 'PUBLIC_API' },
};

/** 소득을 배우자와 합산해 신고해야 하는가 (미혼이면 본인 소득만) */
export function needsSpouseIncome(a: ApplicantInput): boolean {
  return a.maritalStatus !== 'SINGLE';
}

/** 명세: 연령 19~99. 오류 메시지 배열 반환 (빈 배열 = 통과) */
export function validateApplicant(a: ApplicantInput): string[] {
  const errs: string[] = [];
  if (!Number.isInteger(a.age) || a.age < 19 || a.age > 99) {
    errs.push('연령은 만 19세 이상 99세 이하로 입력해 주세요.');
  }
  // 명세 완료조건: 미혼 선택 시 부부합산 소득 입력을 요구하지 않는다
  if (a.maritalStatus === 'SINGLE' && a.incomeBand !== 'UNKNOWN') {
    // 미혼은 본인 소득만 신고하면 되므로 별도 오류는 아니다 (라벨로만 구분)
  }
  return errs;
}

/** 명세: 계약기간 1~36개월, 보증금 양수, 입주예정일 필수 */
export function validateContract(c: PlannedContractInput): string[] {
  const errs: string[] = [];
  if (!Number.isFinite(c.deposit) || c.deposit <= 0) {
    errs.push('예정 보증금을 입력해 주세요.');
  }
  if (!Number.isInteger(c.termMonths) || c.termMonths < 1 || c.termMonths > 36) {
    errs.push('계약기간은 1개월 이상 36개월 이하로 입력해 주세요.');
  }
  if (!c.moveInDate) {
    errs.push('입주 예정일을 선택해 주세요.');
  }
  return errs;
}
