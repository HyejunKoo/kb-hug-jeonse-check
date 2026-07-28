// KB 4개 상품공시 실크롤러: HTTP 응답과 핵심 자격 문구가 모두 확인될 때만 규칙을 반환한다.
import type { RulePack } from '@/types';
import kbHugJson from '@/rules/kb-hug.json';
import kbHfJson from '@/rules/kb-hf.json';
import kbSgiJson from '@/rules/kb-sgi.json';
import kbYouthHfJson from '@/rules/kb-youth-hf.json';
import { crawlValidatedRules, type CrawledRuleSet, type OfficialPageProbe } from './http';

const PROBES: OfficialPageProbe[] = [
  {
    sourceId: 'KB_STAR_HUG',
    url: 'https://obank.kbstar.com/quics?cc=b104363%3Ab104516&page=C103507&prcode=LN20001364',
    requirements: [
      { label: '상품명 HUG', pattern: /KB스타 전세자금대출\(HUG_주택도시보증공사\)/ },
      {
        label: '중개·1년 이상 계약',
        pattern: /공인중개사의 중개를 통하여 1년 이상의 주택임대차계약/,
      },
      { label: '만 19세 이상 세대주', pattern: /만 19세 이상 주민등록등본상 세대주/ },
      {
        label: '보증금 수도권 7억·그 외 5억',
        pattern: /임차보증금이 수도권 7억원, 그 외 지역 5억원 이내/,
      },
      { label: '주택보유 1주택 이내', pattern: /합산 주택보유수.{0,80}1주택 이내/ },
    ],
  },
  {
    sourceId: 'KB_STAR_HF',
    url: 'https://obank.kbstar.com/quics?cc=b104363%3Ab104516&page=C103507&prcode=LN20001362',
    requirements: [
      { label: '상품명 HF', pattern: /KB스타 전세자금대출\(HF_한국주택금융공사\)/ },
      {
        label: '보증금 수도권 7억·그 외 5억',
        pattern: /임차보증금이 수도권 7억원\(그 외 지역 5억원\) 이하/,
      },
      { label: '계약금 5% 이상', pattern: /임차보증금의 5% 이상을 지급/ },
      { label: '주택보유 1주택 이내', pattern: /합산 주택보유수.{0,80}1주택 이내/ },
      { label: '공인중개업소 계약', pattern: /공인중개업소를 통해 임대차계약을 체결/ },
      { label: '기간 1~2년', pattern: /대출기간\s*:\s*1년 이상 2년 이내/ },
    ],
  },
  {
    sourceId: 'KB_STAR_SGI',
    url: 'https://obank.kbstar.com/quics?QSL=F&cc=b104363%3Ab104516&isNew=Y&page=C103507&prcode=LN20001363',
    requirements: [
      { label: '상품명 SGI', pattern: /KB스타 전세자금대출\(SGI_서울보증보험\)/ },
      { label: '중개·기간 3개월~3년', pattern: /부동산중개업소를 통하여 3개월 이상 3년 이내/ },
      { label: '만 19세 이상 세대주', pattern: /만 19세 이상 주민등록등본상 세대주/ },
      { label: '소득증빙 가능', pattern: /소득증빙이 가능.{0,80}금융비용부담율.{0,20}40% 이내/ },
      { label: '주택보유 1주택 이내', pattern: /합산 주택보유수.{0,80}1주택 이내/ },
    ],
  },
  {
    sourceId: 'KB_YOUTH_HF',
    url: 'https://obank.kbstar.com/quics?QSL=F&cc=b104363%3Ab104516&isNew=N&page=C103507&prcode=LN20000156',
    requirements: [
      { label: '청년 맞춤형 상품명', pattern: /KB 청년 맞춤형 전세자금대출/ },
      { label: '만 19~34세 무주택', pattern: /만 19세 이상 만 34세 이하 무주택/ },
      {
        label: '보증금 수도권 7억·그 외 5억',
        pattern: /임차보증금 수도권 7억원\(그 외 지역 5억원\) 이하/,
      },
      { label: '계약금 5% 이상', pattern: /임차보증금의 5% 이상 계약금 지급/ },
      { label: '연소득 7천만원 이하', pattern: /부부합산 연소득 7천만원 이하/ },
      { label: '기간 1~2년', pattern: /대출기간\s*:\s*1년 이상 2년 이내/ },
    ],
  },
];

const PRODUCT_RULES = [kbHugJson, kbHfJson, kbSgiJson, kbYouthHfJson].flatMap(
  (pack) => (pack as RulePack).rules,
);

export async function crawlKbProductRules(): Promise<CrawledRuleSet> {
  return crawlValidatedRules(PROBES, PRODUCT_RULES);
}
