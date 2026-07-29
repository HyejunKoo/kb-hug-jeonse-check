import type { CrawlSourceReport, Rule } from '@/types';

/** 공시 평문에서 반드시 존재해야 하는 숫자 캡처를 읽는다. 하나라도 숫자가 아니면 실패시킨다. */
export function captureNumbers(text: string, pattern: RegExp, label: string): number[] {
  const match = text.match(pattern);
  if (!match) throw new Error(`${label} 추출 실패`);
  const values = match.slice(1).map(Number);
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`${label} 숫자 변환 실패`);
  }
  return values;
}

/** 실크롤링으로 만든 규칙에 원본 응답 시각·해시·근거 문구를 붙인다. */
export function crawledRule(
  report: CrawlSourceReport,
  evidenceLabels: string[],
  rule: Omit<Rule, 'sourceUrl' | 'effectiveFrom' | 'origin' | 'verifiedAt'>,
): Rule {
  return {
    ...rule,
    sourceUrl: report.finalUrl ?? report.url,
    // 공시 조회일을 시행일로 가장하지 않는다.
    effectiveFrom: 'UNCONFIRMED',
    origin: 'CRAWLED',
    verifiedAt: report.fetchedAt,
    sourceContentSha256: report.contentSha256,
    sourceEvidence: evidenceLabels.flatMap((label) =>
      report.evidence?.[label] ? [report.evidence[label]] : [],
    ),
  };
}
