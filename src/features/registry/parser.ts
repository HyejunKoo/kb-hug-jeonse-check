// src/features/registry/parser.ts — 등기부 텍스트 → RegistryInfo 추출 (2번 담당)
// TODO(2번): OCR/PDF 텍스트에서 소유자·근저당 설정액 합계·권리침해(압류 등) 추출
// 절대 규칙: 추출 결과는 고객 확인·수정 후에만 판정에 사용 (저신뢰 값 자동 사용 금지)
import type { RegistryInfo } from '@/types';

export function parseRegistryText(_text: string): Partial<RegistryInfo> {
  void _text;
  return {};
}
