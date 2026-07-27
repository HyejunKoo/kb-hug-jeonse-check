// GET /auth/confirm — 이메일 매직링크 클릭 시 진입. Supabase 이메일 템플릿의
// ConfirmationURL을 `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=...`
// 형태로 바꿔야 동작한다 (Supabase 대시보드 > Auth > Email Templates 설정 필요).
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
