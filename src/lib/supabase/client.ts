// src/lib/supabase/client.ts — 브라우저용 (anon 키, RLS 적용)
// Supabase Auth 로그인(매직링크/OTP)·로그아웃 등 클라이언트 상호작용에서만 사용.
// 진단 데이터 조회/저장은 서버(lib/supabase/server.ts)에서만 한다.
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/** env가 비어 있으면 null — 호출부에서 "Supabase 미설정" 처리 */
export function getBrowserSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
