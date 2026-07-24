// src/lib/gemini/client.ts — Gemini 초기화. app/api/report 안에서만 사용.
// 절대 규칙: Gemini는 문장 다듬기만. 판정·수치 생성 금지.
import { GoogleGenerativeAI } from '@google/generative-ai';

export function getGeminiModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenerativeAI(key).getGenerativeModel({ model: 'gemini-1.5-flash' });
}
