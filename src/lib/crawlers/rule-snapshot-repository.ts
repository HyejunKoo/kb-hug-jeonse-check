import type { CrawlSummary, Rule, RulePack } from '@/types';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const RULE_PARSER_VERSION = 'kb-hug-parser-v1';

export interface StoredRulePack extends RulePack {
  source: 'SUPABASE_SNAPSHOT';
  crawl: CrawlSummary;
}

export type ActiveRuleSnapshotResult =
  | { status: 'FOUND'; pack: StoredRulePack }
  | { status: 'EMPTY' }
  | { status: 'ERROR'; error: string };

interface RuleSnapshotRow {
  version: string;
  rules: Rule[];
  crawl: CrawlSummary;
  fetched_at: string;
}

function validStoredRow(value: unknown): value is RuleSnapshotRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<RuleSnapshotRow>;
  return (
    typeof row.version === 'string' &&
    row.version.length > 0 &&
    typeof row.fetched_at === 'string' &&
    Array.isArray(row.rules) &&
    row.rules.length > 0 &&
    !!row.crawl &&
    row.crawl.success === true &&
    Array.isArray(row.crawl.reports)
  );
}

/** 크롤링에 성공한 규칙팩만 DB의 새 활성 스냅샷으로 저장한다. */
export async function saveActiveRuleSnapshot(pack: {
  version: string;
  updatedAt: string;
  rules: Rule[];
  crawl: CrawlSummary;
}): Promise<{ id?: string; error?: string }> {
  if (!pack.crawl.success || pack.rules.length === 0) {
    return { error: '성공한 비어 있지 않은 규칙팩만 저장할 수 있습니다.' };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return { error: 'Supabase 관리자 연결이 설정되지 않았습니다.' };

  const { data, error } = await supabase.rpc('save_rule_snapshot', {
    p_version: pack.version,
    p_rules: pack.rules,
    p_crawl: pack.crawl,
    p_fetched_at: pack.updatedAt,
    p_parser_version: RULE_PARSER_VERSION,
  });
  if (error) return { error: error.message };
  return { id: typeof data === 'string' ? data : undefined };
}

/** 일반 판정의 기준이 되는 활성 규칙팩을 읽고, 빈 DB와 조회 실패를 구분한다. */
export async function loadActiveRuleSnapshot(): Promise<ActiveRuleSnapshotResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { status: 'ERROR', error: 'Supabase 관리자 연결이 설정되지 않았습니다.' };
  }

  try {
    const { data, error } = await supabase
      .from('rule_snapshots')
      .select('version,rules,crawl,fetched_at')
      .eq('active', true)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { status: 'ERROR', error: error.message };
    if (data === null) return { status: 'EMPTY' };
    if (!validStoredRow(data)) {
      return { status: 'ERROR', error: '활성 규칙 스냅샷 형식이 올바르지 않습니다.' };
    }

    return {
      status: 'FOUND',
      pack: {
        version: data.version,
        updatedAt: data.fetched_at,
        rules: data.rules.map((rule) => ({ ...rule, origin: 'SUPABASE_SNAPSHOT' as const })),
        source: 'SUPABASE_SNAPSHOT',
        crawl: data.crawl,
      },
    };
  } catch (error) {
    return {
      status: 'ERROR',
      error: error instanceof Error ? error.message : 'Supabase 활성 규칙 조회 실패',
    };
  }
}
