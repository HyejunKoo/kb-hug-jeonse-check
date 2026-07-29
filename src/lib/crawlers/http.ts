import { createHash } from 'node:crypto';
import type { CrawlSourceReport, Rule } from '@/types';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 KBJeonseRuleVerifier/1.0';
const FETCH_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_ATTEMPTS = 2;

export interface PageRequirement {
  label: string;
  pattern: RegExp;
}

export interface OfficialPageProbe {
  sourceId: string;
  url: string;
  requirements: PageRequirement[];
}

export interface CrawledRuleSet {
  rules: Rule[] | null;
  reports: CrawlSourceReport[];
}

interface PageFetchResult {
  report: CrawlSourceReport;
  text?: string;
}

function charsetFrom(contentType: string): string {
  const raw = contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1]?.toLowerCase();
  if (!raw) return 'utf-8';
  if (raw === 'euc-kr' || raw === 'ks_c_5601-1987') return 'euc-kr';
  return raw;
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    ndash: '–',
    quot: '"',
    lsquo: '‘',
    rsquo: '’',
    le: '≤',
    middot: '·',
  };
  return text
    .replace(/&#(\d+);/g, (_, value: string) => String.fromCodePoint(Number(value)))
    .replace(/&#x([\da-f]+);/gi, (_, value: string) =>
      String.fromCodePoint(Number.parseInt(value, 16)),
    )
    .replace(/&([a-z]+);/gi, (entity, name: string) => named[name.toLowerCase()] ?? entity);
}

function htmlToSearchText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--([\s\S]*?)-->/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function pageTitle(html: string): string | undefined {
  const titleHtml = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (!titleHtml) return undefined;
  return htmlToSearchText(titleHtml).slice(0, 200) || undefined;
}

async function fetchOfficialPageAttempt(
  probe: OfficialPageProbe,
  attempt: number,
): Promise<PageFetchResult> {
  const fetchedAt = new Date().toISOString();
  try {
    const response = await fetch(probe.url, {
      cache: 'no-store',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.7',
        Connection: 'close',
        'User-Agent': USER_AGENT,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const contentType = response.headers.get('content-type') ?? '';
    const charset = charsetFrom(contentType);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_RESPONSE_BYTES) {
      throw new Error(`응답이 ${MAX_RESPONSE_BYTES}바이트 제한을 초과했습니다.`);
    }

    let html: string;
    try {
      html = new TextDecoder(charset).decode(bytes);
    } catch {
      html = new TextDecoder('utf-8').decode(bytes);
    }
    const searchText = htmlToSearchText(html);
    const matches = probe.requirements.flatMap(({ label, pattern }) => {
      const matched = searchText.match(pattern)?.[0];
      return matched ? [{ label, text: matched.replace(/\s+/g, ' ').trim().slice(0, 240) }] : [];
    });
    const matchedRequirements = matches.map(({ label }) => label);
    const requirementsOk = matchedRequirements.length === probe.requirements.length;
    const ok = response.ok && /text\/html/i.test(contentType) && requirementsOk;

    return {
      text: searchText,
      report: {
        sourceId: probe.sourceId,
        url: probe.url,
        finalUrl: response.url,
        ok,
        attempts: attempt,
        status: response.status,
        contentType,
        charset,
        bytes: bytes.byteLength,
        title: pageTitle(html),
        matchedRequirements,
        evidence: Object.fromEntries(matches.map(({ label, text }) => [label, text])),
        contentSha256: createHash('sha256').update(bytes).digest('hex'),
        fetchedAt,
        error: ok
          ? undefined
          : response.ok
            ? `필수 문구 ${matchedRequirements.length}/${probe.requirements.length}개 확인`
            : `HTTP ${response.status}`,
      },
    };
  } catch (error) {
    return {
      report: {
        sourceId: probe.sourceId,
        url: probe.url,
        ok: false,
        attempts: attempt,
        matchedRequirements: [],
        fetchedAt,
        error: error instanceof Error ? error.message : '알 수 없는 크롤링 오류',
      },
    };
  }
}

export async function fetchOfficialPage(probe: OfficialPageProbe): Promise<PageFetchResult> {
  let lastResult: PageFetchResult | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    lastResult = await fetchOfficialPageAttempt(probe, attempt);
    if (lastResult.report.ok) return lastResult;

    const status = lastResult.report.status;
    const retryable = status === undefined || status === 429 || status >= 500;
    if (!retryable || attempt === MAX_ATTEMPTS) return lastResult;
    await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
  }
  return lastResult!;
}

export async function crawlValidatedRules(
  probes: OfficialPageProbe[],
  fallbackRules: Rule[],
): Promise<CrawledRuleSet> {
  const pages = await Promise.all(probes.map(fetchOfficialPage));
  const reports = pages.map(({ report }) => report);
  return {
    rules: reports.every(({ ok }) => ok) ? fallbackRules : null,
    reports,
  };
}
