// HUG 전세금안심대출보증 공식 페이지 실크롤러.
// 성공 시 본문에서 직접 캡처한 수치와 확인 문구로 HUG 규칙을 만든다.
import type { Rule } from '@/types';
import { captureNumbers, crawledRule } from './extract';
import { fetchOfficialPage, type CrawledRuleSet, type OfficialPageProbe } from './http';

const HUG_URL = 'https://www.khug.or.kr/hug/web/ig/dl/igdl000001.jsp';

const PROBE: OfficialPageProbe = {
  sourceId: 'HUG_GUARANTEE',
  url: HUG_URL,
  requirements: [
    { label: '전세금안심대출보증 상품', pattern: /전세금안심대출보증/ },
    {
      label: '대상 주택유형',
      pattern:
        /대상주택\s*:\s*단독.{0,120}다중.{0,120}다가구.{0,120}연립.{0,120}다세대.{0,120}아파트.{0,120}주거용 오피스텔/,
    },
    { label: '임대차계약 최소기간', pattern: /전세계약기간이 (\d+)년 이상일 것/ },
    {
      label: '보증금 수도권·그 외 한도',
      pattern: /전세보증금.{0,80}수도권 (\d+)억원 이하, 그 외 지역 (\d+)억원 이하/,
    },
    { label: '공인중개사 확인', pattern: /공인중개사가 확인\(날인\)한 전세계약/ },
    {
      label: '소유자 일치',
      pattern: /보증대상 주택의 건물과 토지는 모두 동일 임대인의 소유일 것/,
    },
    {
      label: '권리침해 없음',
      pattern: /주택 소유권에 대한 권리침해.{0,100}없을 것/,
    },
    {
      label: '타 세대 전입 없음',
      pattern:
        /전입세대확인서 상 타 세대의 전입내역이 없을 것.{0,60}단독.{0,40}다중.{0,40}다가구 제외/,
    },
    { label: '위반건축물 아님', pattern: /건축물대장에 위반건축물로 기재되어 있지 않을 것/ },
    { label: '담보인정비율', pattern: /주택가격\s*x\s*담보인정비율\((\d+)%\)/i },
    {
      label: '보증금+선순위 한도',
      pattern: /전세보증금과 선순위채권을 더한 금액이.{0,80}담보인정비율\((\d+)%\).{0,20}이내/,
    },
    { label: '선순위채권 한도', pattern: /선순위채권이 주택가액의 (\d+)% 이내일 것/ },
    {
      label: '주택가액 정의',
      pattern: /주택가액\s*=\s*주택가격\s*[x*×]\s*담보인정비율/i,
    },
    {
      label: '단독·다가구·다중 선순위 한도',
      pattern:
        /단독,\s*다가구,\s*다중주택의 경우.{0,180}선순위채권의 합이 주택가액의 (\d+)%\s*이내/,
    },
    {
      label: '연간 이자부담 한도',
      pattern: /연간 인정소득 대비 연간 부담하는 이자비용이 (\d+)% 이내/,
    },
    { label: '법인 임대인 제외', pattern: /임대인이 법인인 경우 취급이 불가능/ },
    {
      label: '전입·확정일자',
      pattern: /주택의 인도와 전입신고를 마치고 전세계약서상 확정일자를 갖출 것/,
    },
    {
      label: '전세권 이전·말소',
      pattern: /전세권이 설정된 경우 이를 공사로 이전하거나 말소/,
    },
  ],
};

export async function crawlHugGuaranteeRules(): Promise<CrawledRuleSet> {
  const page = await fetchOfficialPage(PROBE);
  if (!page.report.ok || !page.text) return { rules: null, reports: [page.report] };

  try {
    const [minLeaseYears] = captureNumbers(
      page.text,
      /전세계약기간이 (\d+)년 이상일 것/,
      '임대차계약 최소기간',
    );
    const [capitalEok, nonCapitalEok] = captureNumbers(
      page.text,
      /전세보증금.{0,80}수도권 (\d+)억원 이하, 그 외 지역 (\d+)억원 이하/,
      '보증금 한도',
    );
    const [collateralPct] = captureNumbers(
      page.text,
      /주택가격\s*x\s*담보인정비율\((\d+)%\)/i,
      '담보인정비율',
    );
    const [combinedPct] = captureNumbers(
      page.text,
      /전세보증금과 선순위채권을 더한 금액이.{0,80}담보인정비율\((\d+)%\).{0,20}이내/,
      '보증금+선순위 한도',
    );
    if (combinedPct !== collateralPct) {
      throw new Error(`담보인정비율 상충: ${collateralPct}% / ${combinedPct}%`);
    }
    const [seniorLienPct] = captureNumbers(
      page.text,
      /선순위채권이 주택가액의 (\d+)% 이내일 것/,
      '선순위채권 한도',
    );
    const [multiFamilySeniorPct] = captureNumbers(
      page.text,
      /단독,\s*다가구,\s*다중주택의 경우.{0,180}선순위채권의 합이 주택가액의 (\d+)%\s*이내/,
      '단독·다가구·다중 선순위 한도',
    );
    const [interestBurdenPct] = captureNumbers(
      page.text,
      /연간 인정소득 대비 연간 부담하는 이자비용이 (\d+)% 이내/,
      '연간 이자부담 한도',
    );
    const capitalCap = capitalEok * 100_000_000;
    const nonCapitalCap = nonCapitalEok * 100_000_000;

    const rules: Rule[] = [
      crawledRule(page.report, ['대상 주택유형'], {
        ruleId: 'HUG-PROPERTY-TYPE',
        layer: 'GUARANTEE',
        paths: ['KB_STAR_HUG'],
        label: 'HUG 보증 대상 주택유형',
        checkId: 'checkEligiblePropertyType',
        params: { allowed: 'APT,MULTI_UNIT,DETACHED,OFFICETEL' },
      }),
      crawledRule(page.report, ['임대차계약 최소기간'], {
        ruleId: 'HUG-TERM',
        layer: 'GUARANTEE',
        paths: ['KB_STAR_HUG'],
        label: `전세계약기간 ${minLeaseYears}년 이상`,
        checkId: 'checkTermMin',
        params: { minMonths: minLeaseYears * 12 },
      }),
      crawledRule(page.report, ['보증금 수도권·그 외 한도'], {
        ruleId: 'HUG-DEPOSIT-CAP',
        layer: 'GUARANTEE',
        paths: ['KB_STAR_HUG'],
        label: `HUG 보증금 수도권 ${capitalEok}억·그 외 ${nonCapitalEok}억 이하`,
        checkId: 'checkDepositCap',
        params: { capitalCap, nonCapitalCap },
      }),
      crawledRule(page.report, ['공인중개사 확인'], {
        ruleId: 'HUG-BROKERED',
        layer: 'GUARANTEE',
        paths: ['KB_STAR_HUG'],
        label: '공인중개사가 확인·날인한 전세계약',
        checkId: 'checkBrokered',
      }),
      crawledRule(page.report, ['소유자 일치'], {
        ruleId: 'HUG-OWNER-MATCH',
        layer: 'GUARANTEE',
        paths: ['KB_STAR_HUG'],
        label: '주택 건물·토지의 동일 임대인 소유',
        checkId: 'checkOwnerMatch',
      }),
      crawledRule(page.report, ['법인 임대인 제외'], {
        ruleId: 'HUG-INDIVIDUAL-OWNER',
        layer: 'GUARANTEE',
        paths: ['KB_STAR_HUG'],
        label: '임대인이 법인이 아닐 것',
        checkId: 'checkIndividualOwner',
      }),
      crawledRule(page.report, ['권리침해 없음'], {
        ruleId: 'HUG-NO-RIGHTS-VIOLATION',
        layer: 'GUARANTEE',
        paths: ['KB_STAR_HUG'],
        label: '소유권 권리침해 없음',
        checkId: 'checkNoRightsViolation',
      }),
      crawledRule(page.report, ['위반건축물 아님'], {
        ruleId: 'HUG-NOT-ILLEGAL-BUILDING',
        layer: 'GUARANTEE',
        paths: ['KB_STAR_HUG'],
        label: '건축물대장상 위반건축물 아님',
        checkId: 'checkNotIllegalBuilding',
      }),
      crawledRule(page.report, ['타 세대 전입 없음'], {
        ruleId: 'HUG-NO-OTHER-HOUSEHOLD',
        layer: 'GUARANTEE',
        paths: ['KB_STAR_HUG'],
        label: '전입세대확인서상 타 세대 전입 없음',
        checkId: 'checkOtherHouseholdOccupancy',
      }),
      crawledRule(
        page.report,
        [
          '담보인정비율',
          '보증금+선순위 한도',
          '선순위채권 한도',
          '주택가액 정의',
          '단독·다가구·다중 선순위 한도',
        ],
        {
          ruleId: 'HUG-COLLATERAL-RATIO',
          layer: 'GUARANTEE',
          paths: ['KB_STAR_HUG'],
          label: `HUG 주택가액 ${collateralPct}%·선순위 ${seniorLienPct}%·다가구 ${multiFamilySeniorPct}%`,
          checkId: 'checkHugCollateralRatio',
          params: { collateralPct, seniorLienPct, multiFamilySeniorPct },
        },
      ),
      crawledRule(page.report, ['연간 이자부담 한도'], {
        ruleId: 'HUG-INTEREST-BURDEN',
        layer: 'GUARANTEE',
        paths: ['KB_STAR_HUG'],
        label: `연간 인정소득 대비 연간 이자비용 ${interestBurdenPct}% 이내`,
        checkId: 'checkHugInterestBurden',
        params: { interestBurdenPct },
      }),
      crawledRule(page.report, ['전입·확정일자'], {
        ruleId: 'HUG-MOVE-IN-FIXED-DATE',
        layer: 'GUARANTEE',
        paths: ['KB_STAR_HUG'],
        label: '주택 인도·전입신고·확정일자',
        checkId: 'alwaysPostContract',
      }),
      crawledRule(page.report, ['전세권 이전·말소'], {
        ruleId: 'HUG-LEASEHOLD-TRANSFER',
        layer: 'GUARANTEE',
        paths: ['KB_STAR_HUG'],
        label: '설정된 전세권의 HUG 이전 또는 말소',
        checkId: 'checkExistingLeaseholdTransfer',
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
          error: error instanceof Error ? error.message : 'HUG 보증 규칙 추출 실패',
        },
      ],
    };
  }
}
