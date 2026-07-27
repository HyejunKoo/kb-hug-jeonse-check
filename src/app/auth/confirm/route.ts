// GET /auth/confirm — 회원가입 이메일 인증 링크 클릭 시 진입 (로그인 자체는 이메일+비밀번호, 인증 불필요).
// Supabase 대시보드 > Auth > Email Templates > "Confirm signup"의 ConfirmationURL을
// `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup` 형태로 바꿔야 동작한다.
// (기본 템플릿의 {{ .ConfirmationURL }}은 Supabase 호스팅 verify 엔드포인트를 거쳐 해시 프래그먼트로
// 세션을 반환하는 implicit flow라 이 서버 라우트를 타지 않는다 — 반드시 위 형태로 바꿔야 함)
import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/diagnosis/result';

  if (tokenHash && type) {
    const supabase = getServerSupabase();
    if (supabase) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=인증 링크가 만료되었거나 잘못되었습니다.`);
}
