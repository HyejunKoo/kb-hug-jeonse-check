'use client';
// src/app/login/page.tsx — Supabase Auth 이메일 매직링크/OTP 로그인 (2번 담당)
import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase/client';

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

  const supabase = getBrowserSupabase();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(urlError ?? '');

  async function onSendLink(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !email.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
      });
      if (err) setError(err.message);
      else setSent(true);
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyCode(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { error: err } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'email',
      });
      if (err) {
        setError(err.message);
        return;
      }
      router.push('/diagnosis/result');
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

  return (
    <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="card card-body">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-lg">🔒</span>
        <h1 className="mt-4 text-center text-lg font-bold tracking-tight">로그인</h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-slate-500">
          이메일로 받은 링크를 클릭하거나, 메일 속 6자리 코드를 입력하세요.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        {!sent ? (
          <form onSubmit={onSendLink} className="mt-6 space-y-3">
            <input
              type="email"
              required
              className="inp"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-main w-full" disabled={loading}>
              {loading ? '전송 중…' : '인증 메일 보내기'}
            </button>
          </form>
        ) : (
          <form onSubmit={onVerifyCode} className="mt-6 space-y-3">
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <strong className="text-slate-900">{email}</strong>로 인증 메일을 보냈습니다.
            </p>
            <input
              type="text"
              inputMode="numeric"
              required
              className="inp"
              placeholder="6자리 코드"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-main w-full" disabled={loading}>
              {loading ? '확인 중…' : '코드 확인'}
            </button>
            <button
              type="button"
              className="btn-ghost w-full"
              onClick={() => { setSent(false); setCode(''); setError(''); }}
            >
              이메일 다시 입력
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
