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
