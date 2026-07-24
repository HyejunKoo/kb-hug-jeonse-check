'use client';
// src/app/diagnosis/page.tsx — 진단 플로우
// 1 신청인 → 2 예정계약 → 3 매물·등기 → 4 결과
import { useState } from 'react';
import type {
  Applicant, PlannedContract, Property, RegistryInfo, PathResult,
} from '@/types';
import {
  DEFAULT_APPLICANT, DEFAULT_CONTRACT, validateApplicant, validateContract, needsSpouseIncome,
} from '@/features/intake/schema';
import { toDiagnosisCase } from '@/features/intake/mapper';
import { searchAddress, fetchBuildingInfo } from '@/features/building/client';
import type { JusoItem } from '@/features/building/mapper';
import { Row, Toggle, Nav } from '@/features/intake/components/fields';
import { ResultCard } from '@/features/result/components/ResultCard';

const STEPS = ['신청인', '예정 계약', '매물·등기', '결과'];

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

  // 주소 검색 상태
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<JusoItem[]>([]);
  const [selected, setSelected] = useState<JusoItem | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [searched, setSearched] = useState(false);

  const set = <K extends keyof Applicant>(k: K, v: Applicant[K]) =>
    setApplicant({ ...applicant, [k]: v });
  const setC = <K extends keyof PlannedContract>(k: K, v: PlannedContract[K]) =>
    setContract({ ...contract, [k]: v });

  async function onSearch() {
    if (!query.trim()) return;
    setLoading(true); setSearched(true); setSelected(null); setProperty({ address: '' });
    try {
      const { candidates: list, notes: n } = await searchAddress(query);
      setCandidates(list); setNotes(n);
    } finally { setLoading(false); }
  }

  async function onSelect(j: JusoItem) {
    setSelected(j); setLoading(true);
    try {
      const r = await fetchBuildingInfo(j);
      if (r.property) setProperty(r.property);
      setNotes(r.notes);
    } finally { setLoading(false); }
  }

  async function onFetchOcrSample() {
    setLoading(true);
    try {
      const res = await fetch('/api/ocr', { method: 'POST' });
      setRegistry((await res.json()).registry);
    } finally { setLoading(false); }
  }

  async function onRunCheck() {
    if (!property.address) { setErrors(['매물 주소를 검색해 선택해 주세요.']); return; }
    setErrors([]); setLoading(true);
    try {
      const res = await fetch('/api/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toDiagnosisCase(applicant, contract, property, registry)),
      });
      setResult((await res.json()).pathResult);
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
      setReport((await res.json()).report ?? '');
    } finally { setLoading(false); }
  }

  function next(validate: () => string[], to: number) {
    const errs = validate();
    setErrors(errs);
    if (errs.length === 0) setStep(to);
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
        {STEPS.map((t, i) => (
          <span key={t} className={`rounded-full border px-3 py-1 ${step === i ? 'border-yellow-500 bg-yellow-50 font-semibold' : 'border-slate-200 text-slate-400'}`}>
            {i + 1}. {t}
          </span>
        ))}
      </nav>

      {errors.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errors.map((e) => <p key={e}>{e}</p>)}
        </div>
      )}

      {/* ---------- 1. 신청인 ---------- */}
      {step === 0 && (
        <section className="space-y-4 rounded-xl border p-5">
          <Row label="연령 (만)">
            <input type="number" className="inp" value={applicant.age}
              onChange={(e) => set('age', Number(e.target.value))} />
          </Row>

          <Row label="세대주 상태">
            <select className="inp" value={applicant.householdHead}
              onChange={(e) => set('householdHead', e.target.value as Applicant['householdHead'])}>
              <option value="YES">세대주</option>
              <option value="NO">세대원</option>
              <option value="PLANNED">세대주 예정 (곧 전입·세대분리)</option>
            </select>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              주민등록등본 맨 위에 나오는 사람이 세대주입니다. 혼자 전입신고를 했다면 보통 세대주,
              부모님 주소에 함께 등록돼 있다면 세대원이에요. 정부24에서 등본을 떼면 확인할 수 있습니다.
            </p>
          </Row>

          <Row label="주택 보유">
            <select className="inp" value={applicant.homeCount}
              onChange={(e) => set('homeCount', Number(e.target.value) as 0 | 1 | 2)}>
              <option value={0}>0채 (무주택)</option>
              <option value={1}>1채</option>
              <option value={2}>2채 이상</option>
            </select>
          </Row>

          <Row label="혼인 상태">
            <select className="inp" value={applicant.maritalStatus}
              onChange={(e) => set('maritalStatus', e.target.value as Applicant['maritalStatus'])}>
              <option value="SINGLE">미혼</option>
              <option value="MARRIED">기혼</option>
              <option value="PLANNED">결혼 예정</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">소득·주택 보유를 배우자와 합산할지 결정하는 데 씁니다.</p>
          </Row>

          <Row label={needsSpouseIncome(applicant) ? '부부합산 연소득' : '본인 연소득'}>
            <select className="inp" value={applicant.incomeBand}
              onChange={(e) => set('incomeBand', e.target.value as Applicant['incomeBand'])}>
              <option value="UNDER_50M">5천만원 이하</option>
              <option value="B50_60M">5천~6천만원</option>
              <option value="B60_70M">6천~7천만원</option>
              <option value="OVER_70M">7천만원 초과</option>
              <option value="UNKNOWN">모름</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              한도를 계산하지 않고 상한 요건 해당 여부만 확인합니다. 모르면 &apos;모름&apos;을 고르세요.
              {needsSpouseIncome(applicant) ? ' 배우자 소득을 합산해 신고하세요.' : ' 미혼은 본인 소득만 신고하면 됩니다.'}
            </p>
          </Row>

          <Row label="소득 유형">
            <select className="inp" value={applicant.incomeType}
              onChange={(e) => set('incomeType', e.target.value as Applicant['incomeType'])}>
              <option value="EMPLOYED">근로소득</option>
              <option value="SELF_EMPLOYED">사업소득</option>
              <option value="NO_INCOME">무소득</option>
            </select>
          </Row>

          <Row label="기존 전세자금대출 보유">
            <select className="inp" value={applicant.existingJeonseLoan}
              onChange={(e) => set('existingJeonseLoan', e.target.value as Applicant['existingJeonseLoan'])}>
              <option value="NONE">없음</option>
              <option value="HAS_ONE">1건</option>
              <option value="HAS_MULTIPLE">2건 이상</option>
            </select>
          </Row>

          <Nav onNext={() => next(() => validateApplicant(applicant), 1)} />
        </section>
      )}

      {/* ---------- 2. 예정 계약 ---------- */}
      {step === 1 && (
        <section className="space-y-4 rounded-xl border p-5">
          <Row label="예정 보증금 (원)">
            <input type="number" className="inp" value={contract.deposit}
              onChange={(e) => setC('deposit', Number(e.target.value))} />
            <p className="mt-1 text-xs text-slate-500">
              {contract.deposit > 0 ? `${(contract.deposit / 100000000).toFixed(2)}억원` : ''}
            </p>
          </Row>

          <Row label="계약기간 (개월)">
            <input type="number" className="inp" value={contract.termMonths}
              onChange={(e) => setC('termMonths', Number(e.target.value))} />
          </Row>

          <Row label="입주 예정일">
            <input type="date" className="inp" value={contract.moveInDate}
              onChange={(e) => setC('moveInDate', e.target.value)} />
          </Row>

          <Row label="공인중개사 중개">
            <Toggle value={contract.brokered} onChange={(v) => setC('brokered', v)} yes="중개" no="직거래" />
          </Row>

          <Nav onPrev={() => setStep(0)} onNext={() => next(() => validateContract(contract), 2)} />
        </section>
      )}

      {/* ---------- 3. 매물·등기 ---------- */}
      {step === 2 && (
        <section className="space-y-4 rounded-xl border p-5">
          <Row label="계약하려는 집 주소">
            <div className="flex gap-2">
              <input className="inp flex-1" placeholder="예: 마포구 월드컵로 240" value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSearch(); }} />
              <button className="btn-sub whitespace-nowrap" onClick={onSearch} disabled={loading}>
                {loading ? '검색 중…' : '주소 검색'}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">지금 사는 집이 아니라 계약하려는 매물 주소예요. 도로명 주소로 검색하세요.</p>
          </Row>

          {searched && candidates.length > 0 && (
            <div>
              <p className="mb-2 text-xs text-slate-500">검색 결과 {candidates.length}건 — 하나를 고르세요</p>
              <div className="space-y-1.5">
                {candidates.map((j) => {
                  const on = selected?.bdMgtSn === j.bdMgtSn;
                  return (
                    <button key={j.bdMgtSn} onClick={() => onSelect(j)}
                      className={`block w-full rounded-lg border p-3 text-left text-sm ${on ? 'border-yellow-500 bg-yellow-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <span className="font-medium">{j.roadAddr}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{j.jibunAddr}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {property.address && (
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold">{property.address}</p>
              <p className="mt-1">
                지역: {property.region === 'CAPITAL' ? '수도권' : '비수도권'}
                {property.propertyTypeLabel && ` · 유형: ${property.propertyTypeLabel}`}
                {property.buildingUse && ` · 용도: ${property.buildingUse.value}`}
              </p>
              {property.fetchedAt && (
                <p className="mt-1 text-[11px] text-slate-400">
                  건축물대장 조회 {new Date(property.fetchedAt).toLocaleString('ko-KR')} · 월간 갱신 데이터라 최신 발급본과 다를 수 있습니다.
                </p>
              )}
            </div>
          )}

          {notes.length > 0 && (
            <ul className="space-y-1 text-xs text-amber-700">
              {notes.map((n) => <li key={n}>· {n}</li>)}
            </ul>
          )}

          <Row label="등기부 (샘플)">
            <button className="btn-sub" onClick={onFetchOcrSample} disabled={loading}>샘플 등기부 불러오기</button>
          </Row>
          {registry && (
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <p className="mb-1 font-semibold">추출 결과 — 판정 전 반드시 확인·수정하세요</p>
              <p>
                소유자: {registry.ownerName?.value} · 근저당 합계:{' '}
                {(Number(registry.seniorLienTotal?.value) / 100000000).toFixed(1)}억 · 권리침해:{' '}
                {registry.hasRightsViolation?.value ? '있음' : '없음'}
              </p>
            </div>
          )}

          <Nav onPrev={() => setStep(1)} onNext={onRunCheck} nextLabel={loading ? '판정 중…' : '사전점검 실행'} />
        </section>
      )}

      {/* ---------- 4. 결과 ---------- */}
      {step === 3 && result && (
        <section className="space-y-4">
          <div className="rounded-xl border p-5">
            <h2 className="font-bold">{result.pathLabel}</h2>
            <p className="mt-1 text-sm">
              막힌 단계:{' '}
              <b className={result.blockedAt === 'NONE' ? '' : 'text-red-600'}>
                {result.blockedAt === 'NONE' ? '없음' : result.blockedAt === 'PRODUCT' ? '상품요건 (1층)' : '보증요건 (2층)'}
              </b>
              <span className="ml-2 text-slate-500">· 공식 심사 필요 {result.officialReviewCount}건</span>
            </p>
          </div>

          {(['PRODUCT', 'GUARANTEE'] as const).map((layer) => (
            <div key={layer}>
              <h3 className="mb-2 text-sm font-semibold text-slate-500">
                {layer === 'PRODUCT' ? '1층 · KB 상품요건' : '2층 · HUG 보증요건'}
              </h3>
              <div className="space-y-2">
                {result.results.filter((r) => r.layer === layer).map((r) => <ResultCard key={r.ruleId} r={r} />)}
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
