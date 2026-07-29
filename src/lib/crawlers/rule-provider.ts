// HUG-only MVP 규칙팩 공급자.
// 일반 요청은 Supabase 활성 규칙을 사용한다.
// DB가 정상 조회됐지만 비어 있을 때만 최초 크롤링하고, DB 오류면 JSON으로 폴백한다.
import { createHash } from 'node:crypto';
import type { CrawlSummary, Rule, RulePack, RuleSource } from '@/types';
import { crawlKbHugProductRules } from './kb';
import { crawlHugGuaranteeRules } from './hug';
import { loadActiveRuleSnapshot, saveActiveRuleSnapshot } from './rule-snapshot-repository';
import kbHugJson from '@/rules/kb-hug.json';
import hugGuaranteeJson from '@/rules/hug-guarantee.json';

interface ProvidedRulePack extends RulePack {
  source: RuleSource;
  crawl: CrawlSummary;
}

const fallbackPacks = [kbHugJson, hugGuaranteeJson] as RulePack[];
const fallbackRules: Rule[] = fallbackPacks
  .flatMap((pack) => pack.rules)
  .filter((rule) => rule.paths.includes('KB_STAR_HUG'))
  .map((rule) => ({ ...rule, origin: 'FALLBACK_JSON' as const }));

const fallbackPack: RulePack = {
  version: 'hug-fallback-1.0.0',
  updatedAt:
    fallbackPacks
      .map((pack) => pack.updatedAt)
      .sort()
      .at(-1) ?? '2026-07-29',
  rules: fallbackRules,
};

/** 응답 HTML의 동적 장식이 아니라 실제 추출 규칙값이 같으면 같은 버전이다. */
function crawledVersion(rules: Rule[]): string {
  const canonical = rules.map((rule) => ({
    ruleId: rule.ruleId,
    layer: rule.layer,
    paths: rule.paths,
    checkId: rule.checkId,
    params: rule.params,
    sourceUrl: rule.sourceUrl,
  }));
  const hash = createHash('sha256').update(JSON.stringify(canonical)).digest('hex').slice(0, 12);
  return `crawled-hug-${hash}`;
}

export async function getRulePack(): Promise<ProvidedRulePack> {
  const stored = await loadActiveRuleSnapshot();
  if (stored.status === 'FOUND') return stored.pack;
  if (stored.status === 'ERROR') {
    return {
      ...fallbackPack,
      source: 'FALLBACK_JSON',
      crawl: {
        success: false,
        reports: [
          {
            sourceId: 'RULE_SNAPSHOT_DB',
            url: '',
            ok: false,
            attempts: 1,
            matchedRequirements: [],
            fetchedAt: new Date().toISOString(),
            error: stored.error,
          },
        ],
      },
    };
  }

  // 여기부터는 DB 조회가 성공했고 활성 행이 없는 최초 부트스트랩인 경우뿐이다.
  try {
    const [kb, hug] = await Promise.all([crawlKbHugProductRules(), crawlHugGuaranteeRules()]);
    const reports = [...kb.reports, ...hug.reports];
    const rules = kb.rules && hug.rules ? [...kb.rules, ...hug.rules] : [];
    const complete = (['PRODUCT', 'GUARANTEE'] as const).every((layer) =>
      rules.some((rule) => rule.paths.includes('KB_STAR_HUG') && rule.layer === layer),
    );
    const crawl: CrawlSummary = {
      success: reports.every((report) => report.ok) && complete,
      reports,
    };

    if (crawl.success) {
      const pack: ProvidedRulePack = {
        version: crawledVersion(rules),
        updatedAt:
          reports
            .map((report) => report.fetchedAt)
            .sort()
            .at(-1) ?? new Date().toISOString(),
        rules,
        source: 'CRAWLED',
        crawl,
      };
      const saved = await saveActiveRuleSnapshot(pack);
      if (saved.error) console.error('[rules] Supabase 스냅샷 저장 실패:', saved.error);
      return pack;
    }
    return {
      ...fallbackPack,
      source: 'FALLBACK_JSON',
      crawl,
    };
  } catch (error) {
    return {
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
}
