// src/lib/crawlers/rule-provider.ts — 규칙팩 공급자
// 흐름(회의록 합의): 크롤링 시도 → 성공 시 캐시 사용 → 실패 시 rules/*.json 폴백
import type { Rule, RulePack, RuleSource } from '@/types';
import { crawlKbProductRules } from './kb';
import { crawlHugGuaranteeRules } from './hug';
import kbHugJson from '@/rules/kb-hug.json';

interface ProvidedRulePack extends RulePack { source: RuleSource; }

// 서버 프로세스 내 캐시 (요청마다 크롤링하지 않기 위함 — 회의록 합의)
let cache: { pack: ProvidedRulePack; at: number } | null = null;
const CACHE_TTL_MS = 1000 * 60 * 60; // 1시간

/**
 * 규칙팩을 실제로 적용하지 않는 경로(F04에서 판정을 중단한 경우)에서 기록용으로만 쓰는 로컬 기준 버전.
 * 크롤링을 시도하지 않으므로 외부 호출이 없다 — 판정하지 않기로 한 요청에 크롤링 비용을 물리지 않기 위함.
 */
export function getFallbackRuleVersion(): string {
  return (kbHugJson as RulePack).version;
}

export async function getRulePack(): Promise<ProvidedRulePack> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.pack;

  let pack: ProvidedRulePack;
  try {
    const [kb, hug] = await Promise.all([crawlKbProductRules(), crawlHugGuaranteeRules()]);
    if (kb && hug) {
      pack = {
        version: `crawled-${new Date().toISOString().slice(0, 10)}`,
        updatedAt: new Date().toISOString(),
        rules: [...kb, ...hug] as Rule[],
        source: 'CRAWLED',
      };
    } else {
      pack = { ...(kbHugJson as RulePack), source: 'FALLBACK_JSON' };
    }
  } catch {
    pack = { ...(kbHugJson as RulePack), source: 'FALLBACK_JSON' };
  }
  cache = { pack, at: Date.now() };
  return pack;
}
