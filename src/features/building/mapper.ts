// src/features/building/mapper.ts — 건축HUB 원본 응답 → Property 매핑 (1번 담당)
// TODO(1번): getBrTitleInfo 실제 응답 필드(mainPurpsCdNm 등)를 Field<T>(PUBLIC_API)로 변환
import type { Property } from '@/types';

export function mapHubResponseToProperty(address: string, _raw: unknown): Partial<Property> {
  void _raw;
  return { address };
}
