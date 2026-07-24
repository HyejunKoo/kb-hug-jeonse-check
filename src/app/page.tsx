// src/app/page.tsx — 랜딩. 진단 플로우는 /diagnosis
import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-10">
      <p className="text-xs font-semibold tracking-widest text-yellow-600">계약 전 사전점검</p>
      <h1 className="mt-1 text-3xl font-bold">KB 전세 코파일럿</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">
        계약금을 지급하기 전, 내 조건과 선택한 매물을 KB 상품요건과 HUG 보증요건에
        대조해 어디가 열려 있고 어디서 왜 막히는지 근거와 함께 확인합니다.
        <br />결과는 승인·보증 가능성을 의미하지 않습니다.
      </p>
      <div className="mt-6">
        <Link href="/diagnosis" className="btn-main inline-block">사전점검 시작</Link>
      </div>
    </main>
  );
}
