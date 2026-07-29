// src/features/intake/mapper.ts — 화면 상태 → DiagnosisCase 조립 (1번 담당)
// 출처(SourceCode)를 붙이는 곳은 여기 한 군데다. 화면 곳곳에서 source를 지어내면
// F04(진단자료 충분성 검사)가 검사하는 "출처 있음"이 무의미해진다.
//   - 1·2단계 폼 입력값        → USER_DECLARED
//   - 주소검색·건축HUB 조회값   → PUBLIC_API   (features/building 에서 이미 붙여 온다)
//   - 등기부 OCR 후 고객 확인값 → USER_CONFIRMED_DOCUMENT (RegistryReview 에서 붙여 온다)
import type {
  ApplicantInput, PlannedContractInput, Property, RegistryInfo, DiagnosisCase,
} from '@/types';

export function toDiagnosisCase(
  applicant: ApplicantInput,
  contract: PlannedContractInput,
  property: Property,
  registry?: RegistryInfo,
): DiagnosisCase {
  return {
    applicant: {
      age: { value: applicant.age, source: 'USER_DECLARED' },
      householdHead: { value: applicant.householdHead, source: 'USER_DECLARED' },
      homeCount: { value: applicant.homeCount, source: 'USER_DECLARED' },
      maritalStatus: { value: applicant.maritalStatus, source: 'USER_DECLARED' },
      incomeBand: { value: applicant.incomeBand, source: 'USER_DECLARED' },
      incomeType: { value: applicant.incomeType, source: 'USER_DECLARED' },
      existingJeonseLoan: { value: applicant.existingJeonseLoan, source: 'USER_DECLARED' },
    },
    contract: {
      deposit: { value: contract.deposit, source: 'USER_DECLARED' },
      termMonths: { value: contract.termMonths, source: 'USER_DECLARED' },
      moveInDate: { value: contract.moveInDate, source: 'USER_DECLARED' },
      brokered: { value: contract.brokered, source: 'USER_DECLARED' },
    },
    property,
    registry,
  };
}
