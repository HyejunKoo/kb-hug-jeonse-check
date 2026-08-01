// src/app/page.tsx — 랜딩. 진단 플로우는 /diagnosis
import Link from 'next/link';

const LAYERS = [
  {
    tag: '1층',
    title: 'KB 상품요건',
    desc: '연령·세대주·주택 보유·계약기간 등 KB스타 HUG 전세자금대출이 요구하는 조건',
  },
  {
    tag: '2층',
    title: 'HUG·HF·SGI 보증요건',
    desc: '주택 유형·권리침해·소유자 일치·기관별 선순위 비율 등 보증서 발급에 필요한 공개 조건',
  },
];

const STEPS = [
  { n: '01', t: '신청인 조건', d: '연령·세대주·소득 구간을 구간 단위로 입력합니다.' },
  { n: '02', t: '예정 계약', d: '보증금·계약기간·중개 여부 등 계약 예정 내용을 입력합니다.' },
  { n: '03', t: '매물·등기', d: '주소를 검색하면 건축물대장에서 용도·유형을 조회합니다.' },
  { n: '04', t: '판정 결과', d: '항목별 판정과 근거·출처·기준일을 함께 확인합니다.' },
];

export default function Home() {
  return (
    <main>
      {/* ---------- Hero ---------- */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <p className="eyebrow">계약 전 사전점검</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-[2.5rem]">
              계약금을 넣기 전에,
              <br />
              <span className="bg-gradient-to-r from-kb-200 to-kb-100 bg-[length:100%_38%] bg-bottom bg-no-repeat">
                어디서 왜 막히는지
              </span>{' '}
              먼저 확인하세요.
            </h1>
            <p className="mt-5 text-[15px] leading-relaxed text-slate-600">
              내 조건과 선택한 매물을 <b className="font-semibold text-slate-900">KB 상품요건</b>과{' '}
              <b className="font-semibold text-slate-900">HUG·HF·SGI 보증요건</b> 두 층에 각각
              대조합니다. 예측하지 않고, 공개된 요건과 입력값을 그대로 비교해 근거와 출처를 붙여
              보여줍니다.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/diagnosis" className="btn-main px-5 py-3 text-[15px]">
                사전점검 시작
                <span aria-hidden>→</span>
              </Link>
              <span className="text-xs text-slate-500">약 3분 소요</span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 2층 구조 ---------- */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="text-lg font-bold tracking-tight">두 개의 층을 따로 봅니다</h2>
        <p className="mt-1.5 text-sm text-slate-500">
          KB 상품 규정과 각 보증기관 규정은 서로 다릅니다. 합쳐서 하나로 판정하지 않고 층별로 나눠
          보여줍니다.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {LAYERS.map((l) => (
            <div key={l.tag} className="card card-body">
              <div className="flex items-center gap-2">
                <span className="badge border-kb-300 bg-kb-50 text-kb-800">{l.tag}</span>
                <h3 className="text-[15px] font-bold">{l.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{l.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- 진행 단계 ---------- */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <h2 className="text-lg font-bold tracking-tight">진행 순서</h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n}>
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500">
                  {s.n}
                </div>
                <p className="mt-3 text-sm font-bold">{s.t}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- 고지 ---------- */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-sm font-bold">결과를 읽을 때 유의할 점</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
            <li className="flex gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-400" />
              <span>
                <b className="font-semibold text-slate-900">
                  &lsquo;확인된 충돌 없음&rsquo;은 승인이 아닙니다.
                </b>{' '}
                공개된 요건과 대조했을 때 걸리는 항목이 발견되지 않았다는 뜻입니다.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-400" />
              <span>
                선순위채권 비율처럼 공식 시세가 필요한 항목은 계약 전 판단이 불가해 &lsquo;공식 심사
                필요&rsquo;로 표시합니다.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-400" />
              <span>
                조회에 실패한 정보는 추정하지 않고 &lsquo;자료 부족&rsquo;으로 남겨 둡니다.
              </span>
            </li>
          </ul>
          <Link href="/diagnosis" className="btn-main mt-6">
            사전점검 시작
          </Link>
        </div>
      </section>
    </main>
  );
}
