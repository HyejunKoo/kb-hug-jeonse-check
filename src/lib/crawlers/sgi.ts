// SGI 경로는 KB 상품공시의 SGI 청약·선순위 조건을 실크롤링해 검증한다.
import type { RulePack } from '@/types';
import sgiGuaranteeJson from '@/rules/sgi-guarantee.json';
import { crawlValidatedRules, type CrawledRuleSet, type OfficialPageProbe } from './http';

const PROBES: OfficialPageProbe[] = [
  {
    sourceId: 'SGI_GUARANTEE_VIA_KB',
    url: 'https://obank.kbstar.com/quics?QSL=F&cc=b104363%3Ab104516&isNew=Y&page=C103507&prcode=LN20001363',
    requirements: [
      {
        label: 'SGI 보험증권 발급',
        pattern: /서울보증보험.{0,80}보험증권.{0,40}발급이 가능한 고객/,
      },
      {
        label: '선순위+전세대출 시세 80%',
        pattern: /선순위 설정최고액과 전세대출금의 합계가 시세의 80% 이내/,
      },
      { label: '대출기간 3개월~3년', pattern: /대출기간\s*:\s*3개월 이상 3년 이내/ },
    ],
  },
];

export async function crawlSgiGuaranteeRules(): Promise<CrawledRuleSet> {
  return crawlValidatedRules(PROBES, (sgiGuaranteeJson as RulePack).rules);
}
