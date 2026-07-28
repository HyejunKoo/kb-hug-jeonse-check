// src/lib/crawlers/rule-provider.ts — 규칙팩 공급자
// 흐름(회의록 합의): 크롤링 시도 → 성공 시 캐시 사용 → 실패 시 rules/*.json 폴백
import type { CrawlSummary, Rule, RulePack, RuleSource, PathId } from '@/types';
import { crawlKbProductRules } from './kb';
import { crawlHugGuaranteeRules } from './hug';
import { crawlHfGuaranteeRules } from './hf';
import { crawlSgiGuaranteeRules } from './sgi';
import kbHugJson from '@/rules/kb-hug.json';
import kbHfJson from '@/rules/kb-hf.json';
import kbSgiJson from '@/rules/kb-sgi.json';
import kbYouthHfJson from '@/rules/kb-youth-hf.json';
import guaranteeCommonJson from '@/rules/guarantee-common.json';
import hugGuaranteeJson from '@/rules/hug-guarantee.json';
import hfGuaranteeJson from '@/rules/hf-guarantee.json';
import sgiGuaranteeJson from '@/rules/sgi-guarantee.json';

interface ProvidedRulePack extends RulePack {
  source: RuleSource;
  crawl: CrawlSummary;
}

// 서버 프로세스 내 캐시 (요청마다 크롤링하지 않기 위함 — 회의록 합의)
let cache: { pack: ProvidedRulePack; at: number } | null = null;
const CACHE_TTL_MS = 1000 * 60 * 60; // 1시간

const fallbackPacks = [
  kbHugJson,
  kbHfJson,
  kbSgiJson,
  kbYouthHfJson,
  guaranteeCommonJson,
  hugGuaranteeJson,
  hfGuaranteeJson,
  sgiGuaranteeJson,
] as RulePack[];

const REQUIRED_PATHS: PathId[] = ['KB_STAR_HUG', 'KB_STAR_HF', 'KB_STAR_SGI', 'KB_YOUTH_HF'];

const fallbackPack: RulePack = {
  version: '1.0.0',
  updatedAt:
    fallbackPacks
      .map((pack) => pack.updatedAt)
      .sort()
      .at(-1) ?? '2026-07-28',
  rules: fallbackPacks.flatMap((pack) => pack.rules),
};

export async function getRulePack(): Promise<ProvidedRulePack> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.pack;

  let pack: ProvidedRulePack;
  try {
    const [kb, hug, hf, sgi] = await Promise.all([
      crawlKbProductRules(),
      crawlHugGuaranteeRules(),
      crawlHfGuaranteeRules(),
      crawlSgiGuaranteeRules(),
    ]);
    const reports = [...kb.reports, ...hug.reports, ...hf.reports, ...sgi.reports];
    const allSourcesOk = reports.every(({ ok }) => ok);
    const crawledRules =
      kb.rules && hug.rules && hf.rules && sgi.rules
        ? [
            ...kb.rules,
            ...(guaranteeCommonJson as RulePack).rules,
            ...hug.rules,
            ...hf.rules,
            ...sgi.rules,
          ]
        : [];
    const complete = REQUIRED_PATHS.every((path) =>
      (['PRODUCT', 'GUARANTEE'] as const).every((layer) =>
        crawledRules.some((rule) => rule.paths.includes(path) && rule.layer === layer),
      ),
    );
    const crawl: CrawlSummary = { success: allSourcesOk && complete, reports };
    if (crawl.success) {
      pack = {
        version: `crawled-${new Date().toISOString().slice(0, 10)}`,
        updatedAt: new Date().toISOString(),
        rules: crawledRules as Rule[],
        source: 'CRAWLED',
        crawl,
      };
    } else {
      pack = { ...fallbackPack, source: 'FALLBACK_JSON', crawl };
    }
  } catch (error) {
    pack = {
      ...fallbackPack,
      source: 'FALLBACK_JSON',
      crawl: {
        success: false,
        reports: [
          {
            sourceId: 'RULE_PROVIDER',
            url: '',
            ok: false,
            attempts: 1,
            matchedRequirements: [],
            fetchedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : '규칙 공급자 오류',
          },
        ],
      },
    };
  }
  cache = { pack, at: Date.now() };
  return pack;
}
