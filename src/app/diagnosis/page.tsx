'use client';
// src/app/diagnosis/page.tsx — 진단 플로우
// 1 신청인 → 2 예정계약 → 3 매물·등기 → 4 결과
// 판정 실행(사전점검 실행)은 로그인이 필요하다. 비로그인이면 입력값을 세션에 잠깐 보관하고
// 로그인/회원가입 안내 팝업을 띄운 뒤, 로그인 완료 후 돌아오면 재입력 없이 바로 결과를 보여준다.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type {
  ApplicantInput, PlannedContractInput, Property, RegistryInfo, PathResult,
  ActionPlan, DiagnosisCase,
} from '@/types';
import {
  DEFAULT_APPLICANT, DEFAULT_CONTRACT, EMPTY_PROPERTY,
  validateApplicant, validateContract, needsSpouseIncome,
} from '@/features/intake/schema';
import { toDiagnosisCase } from '@/features/intake/mapper';
import { searchAddress, fetchBuildingInfo } from '@/features/building/client';
import type { JusoItem } from '@/features/building/mapper';
import { Row, Toggle, Nav } from '@/features/intake/components/fields';
import {
  GuaranteeRatioInputs,
  type GuaranteeRatioValues,
} from '@/features/intake/components/GuaranteeRatioInputs';
import { RegistryReview } from '@/features/registry/components/RegistryReview';
import { PathComparison } from '@/features/result/components/PathComparison';
import { ActionPlanPanel } from '@/features/result/components/ActionPlanPanel';
import { buildActionPlan } from '@/features/result/action-plan';
import { getBrowserSupabase } from '@/lib/supabase/client';

const PENDING_KEY = 'kb-pending-diagnosis';

interface PendingCase {
  applicant: ApplicantInput;
  contract: PlannedContractInput;
  property: Property;
  registry?: RegistryInfo;
  guaranteeValues: GuaranteeRatioValues;
}

async function hasSession(): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

const STEPS = [
  { t: '신청인', d: '본인 조건을 구간 단위로 입력합니다. 실제 개인정보는 입력하지 마세요.' },
  { t: '예정 계약', d: '체결하려는 전세계약의 예정 내용을 입력합니다.' },
  { t: '매물·등기', d: '계약할 집 주소를 검색하면 건축물대장에서 용도·유형을 조회합니다.' },
  { t: '결과', d: '항목별 판정을 층별로 나눠 근거·출처와 함께 보여줍니다.' },
];

const INCOME_KO: Record<ApplicantInput['incomeBand'], string> = {
  UNDER_50M: '5천만원 이하', B50_60M: '5천~6천만원', B60_70M: '6천~7천만원',
  OVER_70M: '7천만원 초과', UNKNOWN: '모름',
};
const HEAD_KO: Record<ApplicantInput['householdHead'], string> = {
  YES: '세대주', NO: '세대원', PLANNED: '세대주 예정',
};

/** 위반건축물 표시 여부 — 공개 API에 없어 사용자가 건축물대장을 열람해 고른다 */
type IllegalChoice = 'YES' | 'NO' | 'UNKNOWN';

const won = (n: number) => (n > 0 ? `${(n / 100000000).toFixed(2)}억원` : '—');

export default function DiagnosisPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const [applicant, setApplicant] = useState<ApplicantInput>(DEFAULT_APPLICANT);
  const [contract, setContract] = useState<PlannedContractInput>(DEFAULT_CONTRACT);
  const [property, setProperty] = useState<Property>(EMPTY_PROPERTY);
  const [registry, setRegistry] = useState<RegistryInfo | undefined>();
  const [guaranteeValues, setGuaranteeValues] = useState<GuaranteeRatioValues>({});
  const [results, setResults] = useState<PathResult[]>([]);
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
  /** 판정에 실제로 쓰인 입력값 — F11 리포트에 입력값·출처를 함께 넣는 데 쓴다 */
  const [checkedCase, setCheckedCase] = useState<DiagnosisCase | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [report, setReport] = useState('');
  const [reportError, setReportError] = useState('');
  const [reportConsent, setReportConsent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // 주소 검색 상태
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<JusoItem[]>([]);
  const [selected, setSelected] = useState<JusoItem | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [searched, setSearched] = useState(false);

  const set = <K extends keyof ApplicantInput>(k: K, v: ApplicantInput[K]) =>
    setApplicant({ ...applicant, [k]: v });
  const setC = <K extends keyof PlannedContractInput>(k: K, v: PlannedContractInput[K]) =>
    setContract({ ...contract, [k]: v });

  // 위반건축물 여부는 property 안에 직접 담는다 — 세션 보관·복원 경로가 자동으로 따라오고,
  // 매물을 다시 고르면 property가 통째로 갈리면서 이전 확인값도 함께 사라진다.
  const illegalChoice: IllegalChoice =
    property.isIllegalBuilding === undefined ? 'UNKNOWN' : property.isIllegalBuilding.value ? 'YES' : 'NO';

  const setIllegal = (v: IllegalChoice) =>
    setProperty({
      ...property,
      isIllegalBuilding: v === 'UNKNOWN' ? undefined : { value: v === 'YES', source: 'USER_CONFIRMED_DOCUMENT' },
    });

  async function onSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    setSelected(null);
    setProperty(EMPTY_PROPERTY);
    setRegistry(undefined);
    setGuaranteeValues({});
    try {
      const { candidates: list, notes: n } = await searchAddress(query);
      setCandidates(list);
      setNotes(n);
    } finally {
      setLoading(false);
    }
  }

  async function onSelect(j: JusoItem) {
    setSelected(j);
    setLoading(true);
    setRegistry(undefined);
    setGuaranteeValues({});
    try {
      const r = await fetchBuildingInfo(j);
      if (r.property) setProperty(r.property);
      setNotes(r.notes);
    } finally {
      setLoading(false);
    }
  }

  async function runCheck(
    a: ApplicantInput,
    c: PlannedContractInput,
    p: Property,
    r: RegistryInfo | undefined,
    ratios: GuaranteeRatioValues,
  ) {
    setLoading(true);
    try {
      const propertyForCheck: Property =
        ratios.housingPrice === undefined
          ? p
          : {
              ...p,
              housingPrice: {
                value: ratios.housingPrice,
                source: 'USER_CONFIRMED_PUBLIC_INFO',
              },
            };
      const registryForCheck: RegistryInfo | undefined =
        ratios.seniorLeaseDepositTotal === undefined
          ? r
          : {
              ...r,
              seniorLeaseDepositTotal: {
                value: ratios.seniorLeaseDepositTotal,
                source: 'USER_CONFIRMED_DOCUMENT',
              },
            };
      const diag = toDiagnosisCase(a, c, propertyForCheck, registryForCheck);
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(diag),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.pathResults)) {
        setErrors([data.error ?? '판정 결과를 불러오지 못했습니다.']);
        return;
      }
      setResults(data.pathResults);
      // 서버가 안 내려주는 경우에도 같은 순수 함수로 화면에서 다시 만든다 (동일 입력 → 동일 결과)
      setActionPlan(data.actionPlan ?? buildActionPlan(data.pathResults));
      setCheckedCase(diag);
      setCaseId(data.caseId ?? null);
      // 새 판정이면 이전 동의·보고서는 남기지 않는다
      setReport('');
      setReportError('');
      setReportConsent(false);
      setStep(3);
    } finally {
      setLoading(false);
    }
  }

  async function onRunCheck() {
    if (!property.address.value) { setErrors(['매물 주소를 검색해 선택해 주세요.']); return; }
    if (
      guaranteeValues.housingPrice !== undefined &&
      (!Number.isFinite(guaranteeValues.housingPrice) || guaranteeValues.housingPrice <= 0)
    ) {
      setErrors(['공식 주택가격은 0보다 큰 원 단위 금액으로 입력해 주세요.']);
      return;
    }
    if (
      guaranteeValues.seniorLeaseDepositTotal !== undefined &&
      (!Number.isFinite(guaranteeValues.seniorLeaseDepositTotal) ||
        guaranteeValues.seniorLeaseDepositTotal < 0)
    ) {
      setErrors(['선순위 임차보증금 합계는 0 이상의 원 단위 금액으로 입력해 주세요.']);
      return;
    }
    setErrors([]);

    if (!(await hasSession())) {
      const pending: PendingCase = { applicant, contract, property, registry, guaranteeValues };
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
      setShowLoginPrompt(true);
      return;
    }

    await runCheck(applicant, contract, property, registry, guaranteeValues);
  }

  // 로그인 유도 팝업 이후 로그인/회원가입을 마치고 돌아오면, 보관해둔 입력값으로 바로 판정을 이어간다
  useEffect(() => {
    (async () => {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return;
      if (!(await hasSession())) return; // 아직 로그인 전(예: 가입 확인 메일 대기) — 다음 방문 때 다시 시도

      sessionStorage.removeItem(PENDING_KEY);
      const pending: PendingCase = JSON.parse(raw);
      setApplicant(pending.applicant);
      setContract(pending.contract);
      setProperty(pending.property);
      setRegistry(pending.registry);
      setGuaranteeValues(pending.guaranteeValues ?? {});
      await runCheck(
        pending.applicant,
        pending.contract,
        pending.property,
        pending.registry,
        pending.guaranteeValues ?? {},
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onMakeReport() {
    if (results.length === 0 || !reportConsent) return;
    setLoading(true);
    setReportError('');
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consent: true,
          pathResults: results,
          diagnosis: checkedCase ?? undefined,
          actionPlan: actionPlan ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || typeof data.report !== 'string') {
        setReportError(data.error ?? '요약을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      setReport(data.report);
    } finally {
      setLoading(false);
    }
  }

  async function onCopyReport() {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 클립보드 권한 없음 — 무시 */
    }
  }

  function next(validate: () => string[], to: number) {
    const errs = validate();
    setErrors(errs);
    if (errs.length === 0) setStep(to);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="card card-body w-full max-w-sm text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-lg">🔒</span>
            <h2 className="mt-4 text-base font-bold tracking-tight">로그인이 필요합니다</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              사전점검 결과를 확인하려면 로그인 또는 회원가입이 필요해요.
              지금 입력한 내용은 그대로 보관되니 다시 입력하지 않아도 됩니다.
            </p>
            <div className="mt-5 flex gap-2">
              <Link href="/login?next=/diagnosis" className="btn-main flex-1">로그인</Link>
              <Link href="/signup?next=/diagnosis" className="btn-sub flex-1">회원가입</Link>
            </div>
            <button type="button" className="btn-ghost mt-2 w-full" onClick={() => setShowLoginPrompt(false)}>
              취소
            </button>
          </div>
        </div>
      )}

      {/* ---------- 페이지 헤더 ---------- */}
      {/* 서비스명은 헤더 워드마크가 이미 말한다. 여기서는 지금 하는 일만 적는다.
          내부 기능코드(F05·F06)는 팀 용어라 사용자 화면에 노출하지 않는다. */}
      <header className="mb-7">
        <h1 className="text-2xl font-bold tracking-tight">계약 전 사전점검</h1>
        <p className="mt-2 text-sm text-slate-500">
          공개요건과 입력값을 결정론적으로 대조합니다. 결과는 승인·보증 가능성을 의미하지 않습니다.
        </p>
      </header>

      {/* ---------- 스텝 인디케이터 ---------- */}
      <nav aria-label="진행 단계" className="mb-6">
        <ol className="flex items-center">
          {STEPS.map((s, i) => {
            const done = i < step;
            const now = i === step;
            // 이미 지나온 단계는 눌러서 돌아갈 수 있게 한다. 앞 단계는 입력 검증을 건너뛰게
            // 되므로 잠가 둔다 (결과 화면에서는 어디로도 점프하지 않는다).
            const canJump = done && step < 3;
            const Dot = canJump ? 'button' : 'span';
            return (
              <li key={s.t} className={`flex items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
                <Dot
                  {...(canJump
                    ? { type: 'button' as const, onClick: () => setStep(i), 'aria-label': `${s.t} 단계로 돌아가기` }
                    : {})}
                  className={`flex items-center gap-2 rounded-full ${canJump ? 'cursor-pointer' : ''}`}
                >
                  <span
                    aria-current={now ? 'step' : undefined}
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[12px] font-bold transition ${
                      now
                        ? 'border-kb-500 bg-kb-500 text-kb-900'
                        : done
                          ? `border-slate-300 bg-slate-800 text-white ${canJump ? 'hover:bg-slate-600' : ''}`
                          : 'border-slate-200 bg-white text-slate-400'
                    }`}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  <span
                    className={`hidden text-xs sm:inline ${now ? 'font-bold text-slate-900' : 'font-medium text-slate-400'} ${canJump ? 'hover:text-slate-600' : ''}`}
                  >
                    {s.t}
                  </span>
                </Dot>
                {i < STEPS.length - 1 && (
                  <span className={`mx-2 h-px flex-1 ${done ? 'bg-slate-400' : 'bg-slate-200'}`} />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {errors.length > 0 && (
        <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-800">입력을 확인해 주세요</p>
          <ul className="mt-1.5 space-y-0.5 text-sm text-red-700">
            {errors.map((e) => (
              <li key={e}>· {e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={step === 3 ? '' : 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]'}>
        <div>
          {/* ---------- 1. 신청인 ---------- */}
          {step === 0 && (
            <section className="card">
              <div className="card-head">
                <h2 className="text-base font-bold">1. 신청인 조건</h2>
                <p className="mt-1 text-xs text-slate-500">{STEPS[0].d}</p>
              </div>
              <div className="card-body space-y-5">
                <Row label="연령 (만)" required>
                  <input
                    type="number"
                    className="inp"
                    value={applicant.age}
                    inputMode="numeric"
                    onChange={(e) => set('age', Number(e.target.value))}
                  />
                </Row>

                <Row
                  label="세대주 상태"
                  required
                  hint="주민등록등본 맨 위에 나오는 사람이 세대주입니다. 혼자 전입신고를 했다면 보통 세대주, 부모님 주소에 함께 등록돼 있다면 세대원이에요. 정부24에서 등본을 떼면 확인할 수 있습니다."
                >
                  <select
                    className="inp"
                    value={applicant.householdHead}
                    onChange={(e) =>
                      set('householdHead', e.target.value as ApplicantInput['householdHead'])
                    }
                  >
                    <option value="YES">세대주</option>
                    <option value="NO">세대원</option>
                    <option value="PLANNED">세대주 예정 (곧 전입·세대분리)</option>
                  </select>
                </Row>

                <Row label="주택 보유" required>
                  <select
                    className="inp"
                    value={applicant.homeCount}
                    onChange={(e) => set('homeCount', Number(e.target.value) as 0 | 1 | 2)}
                  >
                    <option value={0}>0채 (무주택)</option>
                    <option value={1}>1채</option>
                    <option value={2}>2채 이상</option>
                  </select>
                </Row>

                <Row
                  label="혼인 상태"
                  required
                  hint="소득·주택 보유를 배우자와 합산할지 결정하는 데 씁니다."
                >
                  <select
                    className="inp"
                    value={applicant.maritalStatus}
                    onChange={(e) =>
                      set('maritalStatus', e.target.value as ApplicantInput['maritalStatus'])
                    }
                  >
                    <option value="SINGLE">미혼</option>
                    <option value="MARRIED">기혼</option>
                    <option value="PLANNED">결혼 예정</option>
                  </select>
                </Row>

                <Row
                  label={needsSpouseIncome(applicant) ? '부부합산 연소득' : '본인 연소득'}
                  required
                  hint={`한도를 계산하지 않고 상한 요건 해당 여부만 확인합니다. 모르면 '모름'을 고르세요.${
                    needsSpouseIncome(applicant)
                      ? ' 배우자 소득을 합산해 신고하세요.'
                      : ' 미혼은 본인 소득만 신고하면 됩니다.'
                  }`}
                >
                  <select
                    className="inp"
                    value={applicant.incomeBand}
                    onChange={(e) => set('incomeBand', e.target.value as ApplicantInput['incomeBand'])}
                  >
                    <option value="UNDER_50M">5천만원 이하</option>
                    <option value="B50_60M">5천~6천만원</option>
                    <option value="B60_70M">6천~7천만원</option>
                    <option value="OVER_70M">7천만원 초과</option>
                    <option value="UNKNOWN">모름</option>
                  </select>
                </Row>

                <Row label="소득 유형" required>
                  <select
                    className="inp"
                    value={applicant.incomeType}
                    onChange={(e) => set('incomeType', e.target.value as ApplicantInput['incomeType'])}
                  >
                    <option value="EMPLOYED">근로소득</option>
                    <option value="SELF_EMPLOYED">사업소득</option>
                    <option value="NO_INCOME">무소득</option>
                  </select>
                </Row>

                <Row label="기존 전세자금대출 보유" required>
                  <select
                    className="inp"
                    value={applicant.existingJeonseLoan}
                    onChange={(e) =>
                      set('existingJeonseLoan', e.target.value as ApplicantInput['existingJeonseLoan'])
                    }
                  >
                    <option value="NONE">없음</option>
                    <option value="HAS_ONE">1건</option>
                    <option value="HAS_MULTIPLE">2건 이상</option>
                  </select>
                </Row>

                <Nav onNext={() => next(() => validateApplicant(applicant), 1)} />
              </div>
            </section>
          )}

          {/* ---------- 2. 예정 계약 ---------- */}
          {step === 1 && (
            <section className="card">
              <div className="card-head">
                <h2 className="text-base font-bold">2. 예정 계약 내용</h2>
                <p className="mt-1 text-xs text-slate-500">{STEPS[1].d}</p>
              </div>
              <div className="card-body space-y-5">
                <Row
                  label="예정 보증금"
                  required
                  hint={
                    contract.deposit > 0
                      ? `${won(contract.deposit)} · 원 단위로 입력하세요`
                      : '원 단위로 입력하세요 (예: 200000000)'
                  }
                >
                  <input
                    type="number"
                    className="inp"
                    value={contract.deposit}
                    inputMode="numeric"
                    onChange={(e) => setC('deposit', Number(e.target.value))}
                  />
                </Row>

                <Row label="계약기간 (개월)" required>
                  <input
                    type="number"
                    className="inp"
                    value={contract.termMonths}
                    inputMode="numeric"
                    onChange={(e) => setC('termMonths', Number(e.target.value))}
                  />
                </Row>

                <Row label="입주 예정일" required>
                  <input
                    type="date"
                    className="inp"
                    value={contract.moveInDate}
                    onChange={(e) => setC('moveInDate', e.target.value)}
                  />
                </Row>

                <Row label="공인중개사 중개" required>
                  <Toggle
                    value={contract.brokered}
                    onChange={(v) => setC('brokered', v)}
                    yes="중개"
                    no="직거래"
                  />
                </Row>

                <Nav
                  onPrev={() => setStep(0)}
                  onNext={() => next(() => validateContract(contract), 2)}
                />
              </div>
            </section>
          )}

          {/* ---------- 3. 매물·등기 ---------- */}
          {step === 2 && (
            <section className="card">
              <div className="card-head">
                <h2 className="text-base font-bold">3. 매물·등기 정보</h2>
                <p className="mt-1 text-xs text-slate-500">{STEPS[2].d}</p>
              </div>
              <div className="card-body space-y-5">
                <Row
                  label="계약하려는 집 주소"
                  required
                  hint="지금 사는 집이 아니라 계약하려는 매물 주소예요. 도로명 주소로 검색하세요."
                >
                  <div className="flex gap-2">
                    <input
                      className="inp flex-1"
                      placeholder="예: 마포구 월드컵로 240"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onSearch();
                      }}
                    />
                    <button
                      className="btn-sub whitespace-nowrap"
                      onClick={onSearch}
                      disabled={loading}
                    >
                      {loading ? '검색 중…' : '주소 검색'}
                    </button>
                  </div>
                </Row>

                {searched && candidates.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-slate-500">
                      검색 결과 {candidates.length}건 — 하나를 고르세요
                    </p>
                    <div className="max-h-72 space-y-1.5 overflow-y-auto pr-0.5">
                      {candidates.map((j) => {
                        const on = selected?.bdMgtSn === j.bdMgtSn;
                        return (
                          <button
                            key={j.bdMgtSn}
                            onClick={() => onSelect(j)}
                            className={`block w-full rounded-lg border p-3 text-left transition ${
                              on
                                ? 'border-kb-500 bg-kb-50 ring-2 ring-kb-500/15'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <span className="block text-sm font-semibold text-slate-900">
                              {j.roadAddr}
                            </span>
                            <span className="mt-0.5 block text-xs text-slate-500">
                              {j.jibunAddr}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {searched && candidates.length === 0 && !loading && (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                    검색 결과가 없습니다. 도로명 + 건물번호 형태로 다시 검색해 보세요.
                  </p>
                )}

                {property.address.value && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      선택한 매물
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{property.address.value}</p>
                    {property.jibunAddress && (
                      <p className="mt-0.5 text-xs text-slate-500">{property.jibunAddress.value}</p>
                    )}
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                      <div>
                        <dt className="text-slate-400">지역</dt>
                        <dd className="mt-0.5 font-semibold text-slate-700">
                          {property.region?.value === 'CAPITAL' ? '수도권' : '비수도권'}
                        </dd>
                      </div>
                      {property.propertyTypeLabel && (
                        <div>
                          <dt className="text-slate-400">유형</dt>
                          <dd className="mt-0.5 font-semibold text-slate-700">
                            {property.propertyTypeLabel}
                          </dd>
                        </div>
                      )}
                      {property.buildingUse && (
                        <div>
                          <dt className="text-slate-400">주용도</dt>
                          <dd className="mt-0.5 font-semibold text-slate-700">
                            {property.buildingUse.value}
                          </dd>
                        </div>
                      )}
                      {property.exclusiveArea && (
                        <div>
                          <dt className="text-slate-400">전용면적</dt>
                          <dd className="mt-0.5 font-semibold tabular-nums text-slate-700">
                            {property.exclusiveArea.value}㎡
                          </dd>
                        </div>
                      )}
                    </dl>
                    {property.fetchedAt && (
                      <p className="mt-3 border-t border-slate-200 pt-2 text-[11px] text-slate-400">
                        건축물대장 조회 {new Date(property.fetchedAt).toLocaleString('ko-KR')} ·
                        월간 갱신 데이터라 최신 발급본과 다를 수 있습니다.
                      </p>
                    )}
                  </div>
                )}

                {notes.length > 0 && (
                  <ul className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-800">
                    {notes.map((n) => (
                      <li key={n} className="flex gap-2">
                        <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                        <span>{n}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* 위반건축물 표시는 건축HUB 공개 API에 없어 사용자가 건축물대장을 열람해 직접 확인해야 한다 */}
                {property.address.value && (
                  <Row
                    label="건축물대장 위반건축물 표시"
                    required
                    hint="정부24 또는 세움터에서 건축물대장을 열람하면 상단에 '위반건축물' 표시가 있는지 확인할 수 있습니다. 공개 API로는 조회되지 않아 직접 확인이 필요하며, 확인하지 않으면 진단이 보류됩니다."
                  >
                    <select className="inp" value={illegalChoice}
                      onChange={(e) => setIllegal(e.target.value as IllegalChoice)}>
                      <option value="UNKNOWN">모름 / 확인 안 됨</option>
                      <option value="NO">표시 없음</option>
                      <option value="YES">위반건축물 표시 있음</option>
                    </select>
                  </Row>
                )}

                {/* 매물(주소)이 바뀌면 이전 문서에 대한 확인 상태를 이어받지 않도록 완전히 새로 마운트한다 */}
                <RegistryReview
                  key={property.address.value || 'no-property'}
                  propertyAddress={property.address.value}
                  propertyJibunAddress={property.jibunAddress?.value}
                  onConfirmed={setRegistry}
                />

                {property.address.value && (
                  <GuaranteeRatioInputs
                    propertyType={property.propertyType?.value}
                    value={guaranteeValues}
                    onChange={setGuaranteeValues}
                  />
                )}

                <Nav
                  onPrev={() => setStep(1)}
                  onNext={onRunCheck}
                  nextLabel={loading ? '판정 중…' : '사전점검 실행'}
                  disabled={loading}
                />
              </div>
            </section>
          )}

          {/* ---------- 4. 결과 ---------- */}
          {step === 3 && results.length > 0 && (
            <section className="space-y-6">
              <PathComparison results={results} />

              {actionPlan && <ActionPlanPanel plan={actionPlan} />}

              {caseId ? (
                <p className="text-xs font-semibold text-emerald-700">
                  ✓ 저장됨 ·{' '}
                  <Link href="/diagnosis/result" className="underline underline-offset-2">
                    내 이력에서 보기
                  </Link>
                </p>
              ) : (
                <p className="text-xs text-amber-700">
                  결과 저장에 실패했습니다. 새로고침 후 다시 시도해 주세요.
                </p>
              )}

              {/* F11 — 동의한 경우에만 입력값·판정을 요약 생성에 사용한다 */}
              <div className="card card-body space-y-3">
                <h3 className="text-sm font-bold">KB 상담용 요약 생성</h3>
                <label className="flex cursor-pointer gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 accent-kb-500"
                    checked={reportConsent}
                    onChange={(e) => setReportConsent(e.target.checked)}
                  />
                  <span className="text-xs leading-relaxed text-slate-600">
                    위에 입력한 값과 그 출처, 판정 결과, 다음 행동 목록이 요약 문장을 다듬기 위해
                    생성형 AI(Google Gemini)로 전송되는 것에 동의합니다. 요약은 새 판정을 만들지
                    않고 위 내용을 문장으로 정리하기만 하며,{' '}
                    <b className="font-semibold text-slate-700">
                      생성된 요약 텍스트는 저장하지 않고 이 화면에서 보고 복사만
                    </b>{' '}
                    할 수 있습니다. 동의하지 않으면 전송하지 않습니다.
                  </span>
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-sub"
                    onClick={() => {
                      setStep(0);
                      setResults([]);
                      setActionPlan(null);
                      setCheckedCase(null);
                      setCaseId(null);
                      setReport('');
                      setReportError('');
                      setReportConsent(false);
                    }}
                  >
                    처음부터
                  </button>
                  <button
                    className="btn-main"
                    onClick={onMakeReport}
                    disabled={loading || !reportConsent}
                    title={reportConsent ? undefined : '동의해야 요약을 생성할 수 있습니다.'}
                  >
                    {loading ? '생성 중…' : 'KB 상담용 요약 생성'}
                  </button>
                </div>

                {reportError && (
                  <p role="alert" className="text-xs font-semibold text-red-700">
                    {reportError}
                  </p>
                )}
              </div>

              {report && (
                <div className="card">
                  <div className="card-head flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold">KB 상담용 요약</h3>
                    <button className="btn-ghost" onClick={onCopyReport}>
                      {copied ? '복사됨' : '복사'}
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap px-5 py-5 text-xs leading-relaxed text-slate-700 sm:px-6">
                    {report}
                  </pre>
                </div>
              )}
            </section>
          )}
        </div>

        {/* ---------- 입력 요약 사이드바 ---------- */}
        {step < 3 && (
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-4">
              <div className="card card-body">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  입력 요약
                </p>
                <dl className="mt-3 space-y-2.5 text-xs">
                  <SummaryRow k="연령" v={`만 ${applicant.age}세`} on={step > 0} />
                  <SummaryRow k="세대주" v={HEAD_KO[applicant.householdHead]} on={step > 0} />
                  <SummaryRow
                    k="주택 보유"
                    v={`${applicant.homeCount === 2 ? '2채 이상' : `${applicant.homeCount}채`}`}
                    on={step > 0}
                  />
                  <SummaryRow k="연소득" v={INCOME_KO[applicant.incomeBand]} on={step > 0} />
                  <SummaryRow k="보증금" v={won(contract.deposit)} on={step > 1} />
                  <SummaryRow k="계약기간" v={`${contract.termMonths}개월`} on={step > 1} />
                  <SummaryRow k="중개" v={contract.brokered ? '중개' : '직거래'} on={step > 1} />
                  <SummaryRow k="매물" v={property.address.value || '미선택'} on={!!property.address.value} />
                </dl>
              </div>

              <p className="px-1 text-[11px] leading-relaxed text-slate-400">
                입력값은 판정에만 사용되며 실제 개인정보를 넣지 마세요. 모든 판정에는 근거와
                출처·기준일이 함께 표시됩니다.
              </p>
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}

/**
 * 아직 지나오지 않은 단계의 값은 아예 감춘다.
 * 색만 흐리게 하면 폼 기본값(보증금 2억 등)이 1단계에서부터 보여서, 사용자가 자기가
 * 입력한 값으로 착각한다.
 */
function SummaryRow({ k, v, on }: { k: string; v: string; on: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-slate-400">{k}</dt>
      <dd className={`truncate text-right font-semibold ${on ? 'text-slate-800' : 'text-slate-300'}`}>
        {on ? v : '—'}
      </dd>
    </div>
  );
}
