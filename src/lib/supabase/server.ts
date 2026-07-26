// src/lib/supabase/server.ts — 서버 전용 (app/api/, 서버 컴포넌트 안에서만 import)
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

let adminCached: SupabaseClient | null = null;

/**
 * service_role 키 사용 — RLS를 우회하는 관리자 전용 클라이언트.
 * 사용자별 데이터 조회/저장에는 절대 쓰지 말 것 (getServerSupabase 사용).
 * env가 비어 있으면 null → 호출부에서 "DB 없이도 동작" 처리
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!adminCached) adminCached = createClient(url, key, { auth: { persistSession: false } });
  return adminCached;
}

/**
 * 요청자 쿠키(세션)를 그대로 사용하는 anon 클라이언트 — RLS가 적용된다.
 * Route Handler·서버 컴포넌트에서 매 요청마다 새로 생성해야 한다 (캐시 금지).
 * env가 비어 있으면 null.
 */
export function getServerSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const cookieStore = cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // 서버 컴포넌트 렌더 중 호출된 경우 — 세션 갱신은 middleware가 담당하므로 무시 가능
        }
      },
    },
  });
}
