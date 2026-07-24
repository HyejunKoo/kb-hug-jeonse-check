// lib/supabase.ts — 서버 전용 클라이언트 (app/api/ 안에서만 import)
// 프론트에서 직접 DB 접근 금지. SERVICE_ROLE 키는 절대 클라이언트로 노출하지 않는다.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/** env가 비어 있으면 null 반환 → 호출부에서 "DB 없이도 동작" 처리 */
export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!cached) cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
