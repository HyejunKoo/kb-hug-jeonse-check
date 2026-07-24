// src/lib/supabase/client.ts — 브라우저용 (anon 키)
// [MVP 이후] Supabase Auth 로그인 + 매물 여러 건 저장 시 사용 (2번 담당)
// 지금은 사용하는 곳 없음. RLS로 anon 접근은 차단되어 있음.
import { createClient } from '@supabase/supabase-js';

export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon);
}
