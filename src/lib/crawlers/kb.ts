// KB HUG 상품공시 실크롤러.
// 성공 시 공시 본문에서 캡처한 수치로 규칙을 새로 만든다. JSON은 여기서 사용하지 않는다.
import type { Rule } from '@/types';
import { fetchOfficialPage, type CrawledRuleSet, type OfficialPageProbe } from './http';
import { captureNumbers, crawledRule } from './extract';

const KB_HUG_URL =
  'https://obank.kbstar.com/quics?cc=b104363%3Ab104516&page=C103507&prcode=LN20001364';

const PROBE: OfficialPageProbe = {
  sourceId: 'KB_STAR_HUG',
  url: KB_HUG_URL,
  requirements: [
    { label: '상품명 HUG', pattern: /KB스타 전세자금대출\(HUG_주택도시보증공사\)/ },
    { label: '공인중개사 중개', pattern: /공인중개사의 중개를 통하여/ },
    { label: '임대차계약 최소기간', pattern: /(\d+)년 이상의 주택임대차계약/ },
    { label: '계약금 비율', pattern: /임차보증금의 (\d+)% 이상을 지급/ },
    { label: '최소 연령·세대주', pattern: /만 (\d+)세 이상 주민등록등본상 세대주/ },
    {
      label: '보증금 수도권·그 외 한도',
      pattern: /임차보증금이 수도권 (\d+)억원, 그 외 지역 (\d+)억원 이내/,
    },
    { label: '주택보유 상한', pattern: /합산 주택보유수.{0,80}?(\d+)주택 이내/ },
    {
      label: 'HUG 통합보증 가입',
      pattern: /전세보증금반환보증.{0,40}전세자금대출특약보증.{0,40}가입이 가능한 고객/,
    },
  ],
};

export async function crawlKbHugProductRules(): Promise<CrawledRuleSet> {
  const page = await fetchOfficialPage(PROBE);
  if (!page.report.ok || !page.text) return { rules: null, reports: [page.report] };

  try {
    const [minLeaseYears] = captureNumbers(
      page.text,
      /(\d+)년 이상의 주택임대차계약/,
      '임대차계약 최소기간',
    );
    const [downPaymentPct] = captureNumbers(
      page.text,
      /임차보증금의 (\d+)% 이상을 지급/,
      '계약금 비율',
    );
    const [minAge] = captureNumbers(
      page.text,
      /만 (\d+)세 이상 주민등록등본상 세대주/,
      '최소 연령',
    );
    const [capitalEok, nonCapitalEok] = captureNumbers(
      page.text,
      /임차보증금이 수도권 (\d+)억원, 그 외 지역 (\d+)억원 이내/,
      '보증금 한도',
    );
    const [maxHomes] = captureNumbers(
      page.text,
      /합산 주택보유수.{0,80}?(\d+)주택 이내/,
      '주택보유 상한',
    );
    const capitalCap = capitalEok * 100_000_000;
    const nonCapitalCap = nonCapitalEok * 100_000_000;

    const rules: Rule[] = [
      crawledRule(page.report, ['최소 연령·세대주'], {
        ruleId: 'KB-HUG-AGE',
        layer: 'PRODUCT',
        paths: ['KB_STAR_HUG'],
        label: `민법상 성년(만 ${minAge}세 이상)`,
        checkId: 'checkAge',
        params: { min: minAge },
      }),
      crawledRule(page.report, ['최소 연령·세대주'], {
        ruleId: 'KB-HUG-HOUSEHOLDER',
        layer: 'PRODUCT',
        paths: ['KB_STAR_HUG'],
        label: '주민등록등본상 세대주',
        checkId: 'checkHouseholder',
      }),
      crawledRule(page.report, ['주택보유 상한'], {
        ruleId: 'KB-HUG-HOMECOUNT',
        layer: 'PRODUCT',
        paths: ['KB_STAR_HUG'],
        label: `부부합산 주택보유 ${maxHomes}주택 이내`,
        checkId: 'checkHomeCount',
        params: { maxHomes },
      }),
      crawledRule(page.report, ['공인중개사 중개'], {
        ruleId: 'KB-HUG-BROKERED',
        layer: 'PRODUCT',
        paths: ['KB_STAR_HUG'],
        label: '공인중개사 중개 계약',
        checkId: 'checkBrokered',
      }),
      crawledRule(page.report, ['임대차계약 최소기간'], {
        ruleId: 'KB-HUG-TERM',
        layer: 'PRODUCT',
        paths: ['KB_STAR_HUG'],
        label: `임대차 계약기간 ${minLeaseYears}년 이상`,
        checkId: 'checkTermMin',
        params: { minMonths: minLeaseYears * 12 },
      }),
      crawledRule(page.report, ['보증금 수도권·그 외 한도'], {
        ruleId: 'KB-HUG-DEPOSIT',
        layer: 'PRODUCT',
        paths: ['KB_STAR_HUG'],
        label: `임차보증금 수도권 ${capitalEok}억·그 외 ${nonCapitalEok}억 이하`,
        checkId: 'checkDepositCap',
        params: { capitalCap, nonCapitalCap },
      }),
      crawledRule(page.report, ['계약금 비율'], {
        ruleId: 'KB-HUG-DOWNPAYMENT',
        layer: 'PRODUCT',
        paths: ['KB_STAR_HUG'],
        label: `계약금 ${downPaymentPct}% 이상 지급`,
        checkId: 'alwaysPostContract',
        params: { downPaymentPct },
      }),
      crawledRule(page.report, ['HUG 통합보증 가입'], {
        ruleId: 'KB-HUG-GUARANTEE-ISSUANCE',
        layer: 'PRODUCT',
        paths: ['KB_STAR_HUG'],
        label: 'HUG 반환보증·대출특약보증 가입 가능',
        checkId: 'alwaysOfficialReview',
      }),
    ];
    return { rules, reports: [page.report] };
  } catch (error) {
    return {
      rules: null,
      reports: [
        {
          ...page.report,
          ok: false,
          error: error instanceof Error ? error.message : 'KB HUG 규칙 추출 실패',
        },
      ],
    };
  }
}
