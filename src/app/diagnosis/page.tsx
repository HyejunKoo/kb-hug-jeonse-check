'use client';
// src/app/diagnosis/page.tsx — 진단 플로우 (1번: 입력 / 결과 표시는 후속 에이전트)
// MVP: 결과는 이 페이지 안에서 인라인 표시. /diagnosis/result 분리는 저장 기능 이후.
import { useState } from 'react';
import type {
  Applicant, PlannedContract, Property, RegistryInfo, PathResult,
} from '@/types';
import { DEFAULT_APPLICANT, DEFAULT_CONTRACT, validateApplicant, validateContract } from '@/features/intake/schema';
import { toDiagnosisCase } from '@/features/intake/mapper';
import { fetchBuildingInfo } from '@/features/building/client';
import { Row, Toggle, Nav } from '@/features/intake/components/fields';
import { ResultCard } from '@/features/result/components/ResultCard';

export default function DiagnosisPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const [applicant, setApplicant] = useState<Applicant>(DEFAULT_APPLICANT);
  const [contract, setContract] = useState<PlannedContract>(DEFAULT_CONTRACT);
  const [property, setProperty] = useState<Property>({ address: '' });
  const [registry, setRegistry] = useState<RegistryInfo | undefined>();
  const [result, setResult] = useState<PathResult | null>(null);
  const [report, setReport] = useState('');

  async function onFetchBuilding() {
    setLoading(true);
    try {
      const p = await fetchBuildingInfo(property.address);
      if (p) setProperty(p);
    } finally { setLoading(false); }
  }

  async function onFetchOcrSample() {
    setLoading(true);
    try {
      const res = await fetch('/api/ocr', { method: 'POST' });
      const data = await res.json();
      setRegistry(data.registry);
    } finally { setLoading(false); }
  }

  async function onRunCheck() {
    setLoading(true);
    try {
      const res = await fetch('/api/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toDiagnosisCase(applicant, contract, property, registry)),
      });
      const data = await res.json();
      setResult(data.pathResult);
      setStep(3);
    } finally { setLoading(false); }
  }

  async function onMakeReport() {
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

  function next(validate?: () => string[], to?: number) {
    const errs = validate ? validate() : [];
    setErrors(errs);
    if (errs.length === 0 && to !== undefined) setStep(to);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs font-semibold tracking-widest text-yellow-600">계약 전 사전점검</p>
        <h1 className="mt-1 text-2xl font-bold">
          KB 전세 코파일럿 <span className="text-sm font-normal text-slate-400">(MVP · HUG 경로)</span>
        </h1>
        <p className="mt-2 text-sm text-slate-500">결과는 승인·보증 가능성을 의미하지 않습니다.</p>
      </header>

      <nav className="mb-6 flex gap-2 text-xs">
        {['신청인', '예정 계약', '매물·등기', '결과'].map((t, i) => (
          <span key={t} className={`rounded-full border px-3 py-1 ${step === i ? 'border-yellow-500 bg-yellow-50 font-semibold' : 'border-slate-200 text-slate-400'}`}>
            {i + 1}. {t}
          </span>
        ))}
      </nav>

      {errors.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errors.map(e => <p key={e}>{e}</p>)}
        </div>
      )}

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
          <Nav onNext={() => next(() => validateApplicant(applicant), 1)} />
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
          <Nav onPrev={() => setStep(0)} onNext={() => next(() => validateContract(contract), 2)} />
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4 rounded-xl border p-5">
          <Row label="매물 주소">
            <div className="flex gap-2">
              <input className="inp flex-1" placeholder="도로명 주소 입력" value={property.address}
                onChange={e => setProperty({ ...property, address: e.target.value })} />
              <button className="btn-sub" onClick={onFetchBuilding} disabled={loading}>건축물대장 조회</button>
            </div>
          </Row>
          {property.region && (
            <p className="text-xs text-slate-500">지역 구분: {property.region === 'CAPITAL' ? '수도권' : '비수도권'} (주소 파싱)</p>
          )}
          <Row label="등기부 (샘플)">
            <button className="btn-sub" onClick={onFetchOcrSample} disabled={loading}>샘플 등기부 불러오기</button>
          </Row>
          {registry && (
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <p className="mb-1 font-semibold">추출 결과 — 판정 전 반드시 확인·수정하세요</p>
              <p>소유자: {registry.ownerName?.value} · 근저당 합계: {(Number(registry.seniorLienTotal?.value) / 100000000).toFixed(1)}억
                 · 권리침해: {registry.hasRightsViolation?.value ? '있음' : '없음'}</p>
            </div>
          )}
          <Nav onPrev={() => setStep(1)} onNext={onRunCheck} nextLabel={loading ? '판정 중…' : '사전점검 실행'} />
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
            <button className="btn-main" onClick={onMakeReport} disabled={loading}>
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
