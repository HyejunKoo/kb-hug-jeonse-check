// HF 일반전세지킴보증 공식 페이지 실크롤러
import type { RulePack } from '@/types';
import hfGuaranteeJson from '@/rules/hf-guarantee.json';
import { crawlValidatedRules, type CrawledRuleSet, type OfficialPageProbe } from './http';

const PROBES: OfficialPageProbe[] = [
  {
    sourceId: 'HF_GUARANTEE',
    url: 'https://www.hf.go.kr/ko/sub02/sub02_05_01.do',
    requirements: [
      { label: '일반전세지킴보증 상품', pattern: /일반전세지킴보증/ },
      { label: '주택가액=주택가격 90%', pattern: /주택가격의 90%.{0,40}주택가액/ },
      {
        label: '단독·다가구 선순위총액 80%',
        pattern: /선순위채권총액은 주택가액의 80% 이내/,
      },
      { label: '단독·다가구 근저당 60%', pattern: /선순위근저당권설정액은 주택가액의 60% 이내/ },
      {
        label: '그 외 선순위총액 60%',
        pattern: /단독,\s*다가구 외.{0,100}선순위채권 총액은 주택가액의 60% 이내/,
      },
    ],
  },
];

export async function crawlHfGuaranteeRules(): Promise<CrawledRuleSet> {
  return crawlValidatedRules(PROBES, (hfGuaranteeJson as RulePack).rules);
}
