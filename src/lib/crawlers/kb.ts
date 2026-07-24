// src/lib/crawlers/kb.ts — KB 상품공시 크롤러 (3번 담당)
// 회의 결정: 크롤링은 시도하되, 실패하면 rules/*.json 폴백 (rule-provider.ts 참조)
// TODO(3번): https://obank.kbstar.com 상품공시 페이지에서 요건 파싱 → Rule[] 변환
import type { Rule } from '@/types';

export async function crawlKbProductRules(): Promise<Rule[] | null> {
  // null 반환 = 크롤링 실패/미구현 → rule-provider가 JSON 폴백 사용
  return null;
}
