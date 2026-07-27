'use client';
// src/app/signup/page.tsx — Supabase Auth 이메일+비밀번호 회원가입 (2번 담당)
// 가입 시 1회 이메일 인증(Confirm signup) 필요. 인증 완료 후 /login에서 비밀번호로 로그인한다.
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserSupabase } from '@/lib/supabase/client';

function friendlyError(message: string): string {
  if (message.includes('User already registered')) return '이미 가입된 이메일입니다. 로그인해 주세요.';
  if (message.includes('Password should be at least')) return '비밀번호는 6자 이상이어야 합니다.';
  return message;
}

export default function SignupPage() {
  const router = useRouter();
  const supabase = getBrowserSupabase();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !email.trim() || !password) return;
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
      });
      if (err) {
        setError(friendlyError(err.message));
        return;
      }
      if (data.session) {
        // 이메일 인증 설정이 꺼져 있으면 가입과 동시에 로그인된다
        router.push('/diagnosis/result');
        router.refresh();
        return;
      }
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  if (!supabase) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="card card-body text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-lg">🔒</span>
          <h1 className="mt-4 text-lg font-bold tracking-tight">회원가입</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Supabase 환경변수가 설정되지 않아 회원가입을 사용할 수 없습니다.
            <br />관리자에게 문의하세요.
          </p>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="card card-body text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-lg">✉️</span>
          <h1 className="mt-4 text-lg font-bold tracking-tight">가입 확인 메일을 보냈어요</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            <strong className="text-slate-900">{email}</strong>로 인증 메일을 보냈습니다.
            <br />메일의 링크를 눌러 인증을 완료한 뒤 로그인해 주세요.
          </p>
          <Link href="/login" className="btn-main mt-6 w-full">로그인으로 이동</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="card card-body">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-lg">📝</span>
        <h1 className="mt-4 text-center text-lg font-bold tracking-tight">회원가입</h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-slate-500">
          이메일과 비밀번호를 입력하세요. 가입 확인 메일이 1회 발송됩니다.
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
            minLength={6}
            className="inp"
            placeholder="비밀번호 (6자 이상)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="btn-main w-full" disabled={loading}>
            {loading ? '가입 중…' : '회원가입'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          이미 계정이 있으신가요? <Link href="/login" className="font-semibold text-kb-700 underline underline-offset-2">로그인</Link>
        </p>
      </div>
    </main>
  );
}
