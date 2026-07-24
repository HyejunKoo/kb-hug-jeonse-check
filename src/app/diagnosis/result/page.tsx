// src/app/diagnosis/result/page.tsx — [MVP 이후] 저장된 진단 건 결과 페이지
// 현재 MVP는 /diagnosis 안에서 결과를 인라인 표시한다.
// Supabase Auth + 진단 건 저장(2번 담당)이 붙으면 여기서 case id로 조회해 렌더링.
import Link from 'next/link';

export default function ResultPlaceholder() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-bold">저장된 진단 결과</h1>
      <p className="mt-2 text-sm text-slate-500">
        로그인·진단 이력 기능과 함께 제공될 예정입니다. 지금은 사전점검 화면에서 결과를 바로 확인하세요.
      </p>
      <Link href="/diagnosis" className="btn-main mt-4 inline-block">사전점검으로 이동</Link>
    </main>
  );
}
