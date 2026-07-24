// src/features/building/client.ts — /api/building 호출 래퍼 (1번 담당)
import type { Property } from '@/types';

export async function fetchBuildingInfo(address: string): Promise<Property | null> {
  const res = await fetch('/api/building', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.property ?? null;
}
