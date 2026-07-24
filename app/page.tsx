'use client';
// app/page.tsx — 진단 플로우 (F01 입력 → F02/F03 수집 → 판정 → 결과 카드 → 상담 요약)
// A 담당: 이 파일과 components/ 를 발전시키면 됨. API 계약은 lib/types.ts 참조.
import { useState } from 'react';
import type {
  Applicant, PlannedContract, Property, RegistryInfo, DiagnosisCase,
  PathResult, CheckResult, Verdict,
} from '@/lib/types';

const VERDICT_UI: Record<Verdict, { label: string; cls: string }> = {
  PUBLIC_REQUIREMENT_UNMET: { label: '공개요건 미충족', cls: 'bg-red-100 text-red-800 border-red-300' },
  NO_PUBLIC_CONFLICT_FOUND: { label: '확인된 충돌 없음', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  MISSING_INFORMATION: { label: '자료 부족', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  POST_CONTRACT_REQUIREMENT: { label: '계약 후 충족 요건', cls: 'bg-sky-100 text-sky-800 border-sky-300' },
  OFFICIAL_REVIEW_REQUIRED: { label: '공식 심사 필요', cls: 'bg-slate-200 text-slate-800 border-slate-400' },
};

export default function Home() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [applicant, setApplicant] = useState<Applicant>({
    age: 28, isHouseholder: true, homeCount: 0, maritalStatus: 'SINGLE',
    incomeBand: 'UNDER_50M', incomeType: 'EMPLOYED', hasExistingJeonseLoan: false,
  });
  const [contract, setContract] = useState<PlannedContract>({
    deposit: 200000000, termMonths: 24, moveInDate: '', brokered: true,
  });
  const [property, setProperty] = useState<Property>({ address: '' });
  const [registry, setRegistry] = useState<RegistryInfo | undefined>();
  const [result, setResult] = useState<PathResult | null>(null);
  const [report, setReport] = useState('');

  async function fetchBuilding() {
    setLoading(true);
    try {
      const res = await fetch('/api/building', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: property.address }),
      });
      const data = await res.json();
      if (data.property) setProperty(data.property);
    } finally { setLoading(false); }
  }

  async function fetchOcrSample() {
    setLoading(true);
    try {
      const res = await fetch('/api/ocr', { method: 'POST' });
      const data = await res.json();
      setRegistry(data.registry);
    } finally { setLoading(false); }
  }

  async function runCheck() {
    setLoading(true);
    try {
      const diag: DiagnosisCase = { applicant, contract, property, registry };
      const res = await fetch('/api/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(diag),
      });
      const data = await res.json();
      setResult(data.pathResult);
      setStep(3);
    } finally { setLoading(false); }
  }

  async function makeReport() {
    if (!result) return;
    setLoading(true);
    try {
      const res = await fetch('/api/report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathResult: result }),
      });
      const data = await res.json();
      setReport(data.report ?? '');
    } finally { setLoading(false); }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs font-semibold tracking-widest text-yellow-600">계약 전 사전점검</p>
        <h1 className="mt-1 text-2xl font-bold">KB 전세 코파일럿 <span className="text-sm font-normal text-slate-400">(MVP · HUG 경로)</span></h1>
        <p className="mt-2 text-sm text-slate-500">
          계약금을 지급하기 전, 공개요건 기준으로 확인 가능한 문제를 먼저 찾습니다.
          결과는 승인·보증 가능성을 의미하지 않습니다.
        </p>
      </header>

      <nav className="mb-6 flex gap-2 text-xs">
        {['신청인', '예정 계약', '매물·등기', '결과'].map((t, i) => (
          <span key={t} className={`rounded-full border px-3 py-1 ${step === i ? 'border-yellow-500 bg-yellow-50 font-semibold' : 'border-slate-200 text-slate-400'}`}>
            {i + 1}. {t}
          </span>
        ))}
      </nav>

      {step === 0 && (
        <section className="space-y-4 rounded-xl border p-5">
          <Row label="연령 (만)">
            <input type="number" className="inp" value={applicant.age}
              onChange={e => setApplicant({ ...applicant, age: Number(e.target.value) })} />
          </Row>
          <Row label="세대주 여부">
            <Toggle value={applicant.isHouseholder} onChange={v => setApplicant({ ...applicant, isHouseholder: v })} yes="세대주" no="아님" />
          </Row>
          <Row label="주택 보유">
            <select className="inp" value={applicant.homeCount}
              onChange={e => setApplicant({ ...applicant, homeCount: Number(e.target.value) as 0 | 1 | 2 })}>
              <option value={0}>0채 (무주택)</option>
              <option value={1}>1채</option>
              <option value={2}>2채 이상</option>
            </select>
          </Row>
          <Row label="부부합산 연소득">
            <select className="inp" value={applicant.incomeBand}
              onChange={e => setApplicant({ ...applicant, incomeBand: e.target.value as Applicant['incomeBand'] })}>
              <option value="UNDER_50M">5천만원 이하</option>
              <option value="B50_60M">5천~6천만원</option>
              <option value="B60_70M">6천~7천만원</option>
              <option value="OVER_70M">7천만원 초과</option>
              <option value="UNKNOWN">모름</option>
            </select>
          </Row>
          <Nav onNext={() => setStep(1)} />
        </section>
      )}

      {step === 1 && (
        <section className="space-y-4 rounded-xl border p-5">
          <Row label="예정 보증금 (원)">
            <input type="number" className="inp" value={contract.deposit}
              onChange={e => setContract({ ...contract, deposit: Number(e.target.value) })} />
          </Row>
          <Row label="계약기간 (개월)">
            <input type="number" className="inp" value={contract.termMonths}
              onChange={e => setContract({ ...contract, termMonths: Number(e.target.value) })} />
          </Row>
          <Row label="공인중개사 중개">
            <Toggle value={contract.brokered} onChange={v => setContract({ ...contract, brokered: v })} yes="중개" no="직거래" />
          </Row>
          <Nav onPrev={() => setStep(0)} onNext={() => setStep(2)} />
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4 rounded-xl border p-5">
          <Row label="매물 주소">
            <div className="flex gap-2">
              <input className="inp flex-1" placeholder="도로명 주소 입력" value={property.address}
                onChange={e => setProperty({ ...property, address: e.target.value })} />
              <button className="btn-sub" onClick={fetchBuilding} disabled={loading}>건축물대장 조회</button>
            </div>
          </Row>
          {property.region && (
            <p className="text-xs text-slate-500">지역 구분: {property.region === 'CAPITAL' ? '수도권' : '비수도권'} (주소 파싱)</p>
          )}
          <Row label="등기부 (샘플)">
            <button className="btn-sub" onClick={fetchOcrSample} disabled={loading}>샘플 등기부 불러오기</button>
          </Row>
          {registry && (
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <p className="mb-1 font-semibold">추출 결과 — 판정 전 반드시 확인·수정하세요</p>
              <p>소유자: {registry.ownerName?.value} · 근저당 합계: {(Number(registry.seniorLienTotal?.value) / 100000000).toFixed(1)}억
                 · 권리침해: {registry.hasRightsViolation?.value ? '있음' : '없음'}</p>
            </div>
          )}
          <Nav onPrev={() => setStep(1)} onNext={runCheck} nextLabel={loading ? '판정 중…' : '사전점검 실행'} />
        </section>
      )}

      {step === 3 && result && (
        <section className="space-y-4">
          <div className="rounded-xl border p-5">
            <h2 className="font-bold">{result.pathLabel}</h2>
            <p className="mt-1 text-sm">
              막힌 단계: <b>{result.blockedAt === 'NONE' ? '없음' : result.blockedAt === 'PRODUCT' ? '상품요건 (1층)' : '보증요건 (2층)'}</b>
              <span className="ml-2 text-slate-500">· 공식 심사 필요 {result.officialReviewCount}건</span>
            </p>
          </div>

          {(['PRODUCT', 'GUARANTEE'] as const).map(layer => (
            <div key={layer}>
              <h3 className="mb-2 text-sm font-semibold text-slate-500">
                {layer === 'PRODUCT' ? '1층 · KB 상품요건' : '2층 · HUG 보증요건'}
              </h3>
              <div className="space-y-2">
                {result.results.filter(r => r.layer === layer).map(r => <ResultCard key={r.ruleId} r={r} />)}
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <button className="btn-sub" onClick={() => { setStep(0); setResult(null); setReport(''); }}>처음부터</button>
            <button className="btn-main" onClick={makeReport} disabled={loading}>
              {loading ? '생성 중…' : 'KB 상담용 요약 생성'}
            </button>
          </div>
          {report && (
            <pre className="whitespace-pre-wrap rounded-xl border bg-slate-50 p-4 text-xs leading-relaxed">{report}</pre>
          )}
        </section>
      )}
    </main>
  );
}

function ResultCard({ r }: { r: CheckResult }) {
  const v = VERDICT_UI[r.verdict];
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{r.label}</p>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${v.cls}`}>{v.label}</span>
      </div>
      <p className="mt-1 text-sm text-slate-600">{r.reason}</p>
      {r.usedValues.length > 0 && (
        <p className="mt-1 text-xs text-slate-400">근거: {r.usedValues.join(' · ')}</p>
      )}
      {r.nextAction && <p className="mt-1 text-xs text-yellow-700">→ {r.nextAction}</p>}
      <p className="mt-1 text-[10px] text-slate-400">
        출처 <a className="underline" href={r.sourceUrl} target="_blank" rel="noreferrer">{r.sourceUrl}</a> · 기준일 {r.effectiveFrom}
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ value, onChange, yes, no }: { value: boolean; onChange: (v: boolean) => void; yes: string; no: string }) {
  return (
    <div className="flex gap-2">
      {[{ v: true, t: yes }, { v: false, t: no }].map(o => (
        <button key={o.t} type="button"
          className={`rounded-lg border px-3 py-1.5 text-sm ${value === o.v ? 'border-yellow-500 bg-yellow-50 font-semibold' : 'border-slate-200 text-slate-500'}`}
          onClick={() => onChange(o.v)}>{o.t}</button>
      ))}
    </div>
  );
}

function Nav({ onPrev, onNext, nextLabel = '다음' }: { onPrev?: () => void; onNext: () => void; nextLabel?: string }) {
  return (
    <div className="flex justify-between pt-2">
      {onPrev ? <button className="btn-sub" onClick={onPrev}>이전</button> : <span />}
      <button className="btn-main" onClick={onNext}>{nextLabel}</button>
    </div>
  );
}
