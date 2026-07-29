'use client';
// src/app/login/page.tsx — Supabase Auth 이메일+비밀번호 로그인 (2번 담당)
// 이메일 인증은 회원가입(/signup) 시 1회만. 로그인은 이메일/비밀번호만으로 즉시 처리.
//
// 회원가입 확인 메일은 커스텀 SMTP 없이는 템플릿(Source) 편집이 막혀 있어 기본 템플릿을 그대로 쓴다.
// 기본 템플릿의 링크는 Supabase 호스팅 verify를 거쳐 세션을 URL 해시(#access_token=...)로 돌려주는
// implicit flow라서 서버 라우트(/auth/confirm)가 아니라 이 페이지가 착지점이다.
// 해시는 access_token/refresh_token을 직접 파싱해 setSession으로 세션을 만든다
// (자동감지(detectSessionInUrl)에 기대지 않는다 — 매 렌더마다 새 클라이언트를 만들면 신뢰할 수 없다).
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getBrowserSupabase } from '@/lib/supabase/client';

function friendlyError(message: string): string {
  if (message.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (message.includes('Email not confirmed')) return '이메일 인증이 필요합니다. 가입 시 받은 메일의 링크를 확인해 주세요.';
  return message;
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  const next = searchParams.get('next') || '/diagnosis/result';

  const [supabase] = useState(() => getBrowserSupabase());

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(urlError ?? '');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const hash = window.location.hash;
    if (!hash) return;

    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      setConfirming(true);
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error: err }) => {
        if (err) {
          setError(friendlyError(err.message));
          setConfirming(false);
          return;
        }
        router.push(next);
        router.refresh();
      });
      return;
    }

    const errorDescription = params.get('error_description');
    if (errorDescription) setError(errorDescription.replace(/\+/g, ' '));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !email.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) {
        setError(friendlyError(err.message));
        return;
      }
      router.push(next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (!supabase) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="card card-body text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-lg">🔒</span>
          <h1 className="mt-4 text-lg font-bold tracking-tight">로그인</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Supabase 환경변수가 설정되지 않아 로그인을 사용할 수 없습니다.
            <br />관리자에게 문의하세요.
          </p>
        </div>
      </main>
    );
  }

  if (confirming) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="card card-body text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-lg">✉️</span>
          <h1 className="mt-4 text-lg font-bold tracking-tight">이메일 인증 확인 중…</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">잠시만 기다려 주세요.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="card card-body">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-lg">🔒</span>
        <h1 className="mt-4 text-center text-lg font-bold tracking-tight">로그인</h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-slate-500">
          이메일과 비밀번호를 입력하세요.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input
            type="email"
            required
            className="inp"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          <input
            type="password"
            required
            className="inp"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="btn-main w-full" disabled={loading}>
            {loading ? '로그인 중…' : '로그인'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          계정이 없으신가요?{' '}
          <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-kb-700 underline underline-offset-2">
            회원가입
          </Link>
        </p>
      </div>
    </main>
  );
}
