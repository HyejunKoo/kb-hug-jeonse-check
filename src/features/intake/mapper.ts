// src/features/intake/mapper.ts — 화면 상태 → DiagnosisCase 조립 (1번 담당)
import type { Applicant, PlannedContract, Property, RegistryInfo, DiagnosisCase } from '@/types';

export function toDiagnosisCase(
  applicant: Applicant, contract: PlannedContract, property: Property, registry?: RegistryInfo,
): DiagnosisCase {
  return { applicant, contract, property, registry };
}
