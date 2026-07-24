// src/app/login/page.tsx — [MVP 이후] Supabase Auth 로그인 (2번 담당)
// 회의 결정: 로그인·매물 여러 건 저장은 MVP 이후. src/lib/supabase/client.ts 사용 예정.
import Link from 'next/link';

export default function LoginPlaceholder() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="card card-body text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-lg">🔒</span>
        <h1 className="mt-4 text-lg font-bold tracking-tight">로그인</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          MVP에서는 로그인 없이 이용합니다.
          <br />Supabase Auth 연동은 이후 단계에서 제공됩니다.
        </p>
        <Link href="/diagnosis" className="btn-main mt-6 w-full">사전점검 시작</Link>
      </div>
    </main>
  );
}
