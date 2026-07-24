// src/features/building/client.ts — 브라우저 → API 래퍼 (1번 담당)
import type { Property } from '@/types';
import type { JusoItem } from './mapper';

export interface AddressSearchResult {
  candidates: JusoItem[];
  notes: string[];
}

export async function searchAddress(address: string): Promise<AddressSearchResult> {
  const res = await fetch('/api/address', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  });
  const data = await res.json();
  return { candidates: data.candidates ?? [], notes: data.notes ?? [] };
}

export interface BuildingResult {
  property: Property | null;
  housing?: { type: string; label: string; basis: string };
  notes: string[];
}

export async function fetchBuildingInfo(juso: JusoItem): Promise<BuildingResult> {
  const res = await fetch('/api/building', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ juso }),
  });
  const data = await res.json();
  return { property: data.property ?? null, housing: data.housing, notes: data.notes ?? [] };
}
