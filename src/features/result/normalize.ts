import type { GuaranteeProvider, PathResult } from '@/types';

function providerFromPath(path: string): GuaranteeProvider {
  if (path.includes('SGI')) return 'SGI';
  if (path.includes('HF') || path.includes('YOUTH')) return 'HF';
  return 'HUG';
}

/** 신규 배열 저장 형식과 기존 HUG 단일 객체 형식을 모두 읽는다. */
export function normalizeStoredResults(value: unknown): PathResult[] {
  const candidates = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? [value]
      : [];
  return candidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const result = candidate as PathResult;
    if (!result.path || !Array.isArray(result.results)) return [];
    const provider = result.guaranteeProvider ?? providerFromPath(result.path);
    return [
      {
        ...result,
        guaranteeProvider: provider,
        guaranteeLabel: result.guaranteeLabel ?? provider,
      },
    ];
  });
}

export function aggregateBlockedAt(results: PathResult[]): PathResult['blockedAt'] {
  if (results.some((result) => result.blockedAt === 'NONE')) return 'NONE';
  if (results.some((result) => result.blockedAt === 'INSUFFICIENT')) return 'INSUFFICIENT';
  if (results.some((result) => result.blockedAt === 'GUARANTEE')) return 'GUARANTEE';
  return 'PRODUCT';
}
