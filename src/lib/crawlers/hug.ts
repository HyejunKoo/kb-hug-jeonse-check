// HUG 전세금안심대출보증 공식 페이지 실크롤러
import type { RulePack } from '@/types';
import hugGuaranteeJson from '@/rules/hug-guarantee.json';
import { crawlValidatedRules, type CrawledRuleSet, type OfficialPageProbe } from './http';

const PROBES: OfficialPageProbe[] = [
  {
    sourceId: 'HUG_GUARANTEE',
    url: 'https://www.khug.or.kr/hug/web/ig/dl/igdl000001.jsp',
    requirements: [
      { label: '전세금안심대출보증 상품', pattern: /전세금안심대출보증/ },
      { label: '담보인정비율 90%', pattern: /주택가격\s*x\s*담보인정비율\(90%\)/i },
      {
        label: '보증금+선순위 90% 이내',
        pattern: /전세보증금과 선순위채권을 더한 금액이.{0,60}담보인정비율\(90%\).{0,20}이내/,
      },
      {
        label: '단독·다가구·다중 선순위 80%',
        pattern: /단독,\s*다가구,\s*다중주택의 경우.{0,160}선순위채권의 합이 주택가액의 80%\s*이내/,
      },
    ],
  },
];

export async function crawlHugGuaranteeRules(): Promise<CrawledRuleSet> {
  return crawlValidatedRules(PROBES, (hugGuaranteeJson as RulePack).rules);
}
