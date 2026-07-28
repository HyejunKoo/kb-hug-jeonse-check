import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { getServerSupabase } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'KB 전세 코파일럿 | 계약 전 사전점검',
  description: '계약금 지급 전, 공개요건 기준 사전점검',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = getServerSupabase();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  return (
    <html lang="ko">
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-900 antialiased">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-kb-500 text-[13px] font-black text-kb-900">
                KB
              </span>
              <span className="text-[15px] font-bold tracking-tight">전세 코파일럿</span>
              <span className="hidden rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 sm:inline">
                MVP
              </span>
            </Link>
            <nav className="flex items-center gap-1">
              <Link href="/diagnosis" className="btn-ghost">사전점검</Link>
              {user ? (
                <>
                  <Link href="/diagnosis/result" className="btn-ghost">저장 이력</Link>
                  <span className="hidden max-w-[10rem] truncate px-1 text-xs text-slate-400 sm:inline">
                    {user.email}
                  </span>
                  <form action="/auth/signout" method="post">
                    <button type="submit" className="btn-ghost">로그아웃</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="btn-ghost">로그인</Link>
                  <Link href="/signup" className="btn-ghost">회원가입</Link>
                </>
              )}
            </nav>
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
            <p className="text-xs leading-relaxed text-slate-500">
              본 서비스는 공개된 상품·보증 요건과 입력값을 결정론적으로 대조해 보여주는 사전점검 도구입니다.
              결과는 대출 승인 또는 보증 가능성을 의미하지 않으며, 최종 판단은 취급 영업점과 보증기관의 심사에 따릅니다.
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              데모 환경 · 실제 개인정보를 입력하지 마세요
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
