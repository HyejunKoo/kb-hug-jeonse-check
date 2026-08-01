import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
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
            {/* 로고는 여백을 트림한 투명 PNG다 — 헤더가 반투명이라 흰 배경이 남으면 사각형이 비친다.
                세로 26px 고정, 가로는 원본 비율(1.412)대로. 22px 는 손그림 획이 가늘어 'b'가
                뭉개지고, 28px 는 h-14 헤더에서 워드마크보다 무거워진다. */}
            <Link
              href="/"
              className="group flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-kb-500/60 focus-visible:ring-offset-2"
            >
              <Image
                src="/logo.png"
                alt="KB"
                width={168}
                height={119}
                priority
                className="h-[26px] w-auto transition-opacity duration-150 group-hover:opacity-75"
              />
              {/* 412px 미만에서는 마크만 남긴다. 네비 항목이 3개라 그 아래에서는 워드마크를
                  넣는 순간 간격이 거의 사라진다 (측정: 360px→0px, 390px→5px, 412px→27px). */}
              <span aria-hidden className="h-4 w-px bg-slate-200 max-[411px]:hidden" />
              {/* 워드마크만 KB Dark Gray — 노랑 마크와 같은 웜톤이라 로고 옆에서 한 덩어리로 읽힌다 */}
              <span className="whitespace-nowrap text-[13.5px] font-bold tracking-tight text-kbgray-dark max-[411px]:hidden sm:text-[15px]">
                KB 전세 코파일럿
              </span>
            </Link>
            {/* 좁은 폭에서 '저장 이력'·'전세 코파일럿'이 두 줄로 깨지지 않게 한다.
                항목이 3개라 390px 에서는 btn-ghost 의 px-3 를 그대로 두면 워드마크와 맞닿는다 —
                sm 미만에서만 좌우 여백을 좁혀 제품명을 지우지 않고 자리를 만든다. */}
            <nav className="flex items-center gap-1 whitespace-nowrap [&_a]:px-2 [&_button]:px-2 sm:[&_a]:px-3 sm:[&_button]:px-3">
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
            <p className="text-xs leading-relaxed text-kbgray">
              본 서비스는 공개된 상품·보증 요건과 입력값을 결정론적으로 대조해 보여주는 사전점검 도구입니다.
              결과는 대출 승인 또는 보증 가능성을 의미하지 않으며, 최종 판단은 취급 영업점과 보증기관의 심사에 따릅니다.
            </p>
            <p className="mt-2 text-[11px] text-kbgray/70">
              데모 환경 · 실제 개인정보를 입력하지 마세요
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
