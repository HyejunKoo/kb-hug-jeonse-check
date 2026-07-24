// src/app/login/page.tsx — [MVP 이후] Supabase Auth 로그인 (2번 담당)
// 회의 결정: 로그인·매물 여러 건 저장은 MVP 이후. src/lib/supabase/client.ts 사용 예정.
import Link from 'next/link';

export default function LoginPlaceholder() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-bold">로그인</h1>
      <p className="mt-2 text-sm text-slate-500">MVP에서는 로그인 없이 이용합니다. (Supabase Auth 연동 예정)</p>
      <Link href="/diagnosis" className="btn-main mt-4 inline-block">사전점검 시작</Link>
    </main>
  );
}
