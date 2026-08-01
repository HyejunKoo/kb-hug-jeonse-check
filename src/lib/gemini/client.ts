// src/lib/gemini/client.ts — Gemini 초기화. app/api/report 안에서만 사용.
// 절대 규칙: Gemini는 문장 다듬기만. 판정·수치 생성 금지.
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * 은퇴한 모델 id를 쓰면 매 호출이 404로 실패하고 report route가 조용히 템플릿으로 폴백한다
 * (폴백이 정상 동작해서 화면상으로는 티가 안 난다). 모델을 바꿀 땐 실제 호출로 llm:true 를 확인하라.
 *   확인: GET https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY
 */
const MODEL = 'gemini-2.5-flash';

export function getGeminiModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenerativeAI(key).getGenerativeModel({ model: MODEL });
}
