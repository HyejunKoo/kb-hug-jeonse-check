// F10 다음 행동 묶음 · F11 상담용 요약 수동 테스트
//   npx tsx --tsconfig tsconfig.json tests/f10-f11.manual.ts
//
// F04 발급일 검사가 '오늘'에 의존하므로 today를 고정해서 돌린다.
// /api/report 는 실제 라우트 핸들러를 그대로 호출한다 — 동의 게이트가 Gemini 호출보다
// 먼저 도는지 확인하려면 라우트를 통째로 태우는 수밖에 없다.
import { validateDiagnosticSufficiency, toSufficiencyResults } from '@/lib/rule-engine/sufficiency';
import { runRulePack } from '@/lib/rule-engine';
import { buildActionPlan } from '@/features/result/action-plan';
import { POST as reportPOST } from '@/app/api/report/route';
import kbHugJson from '@/rules/kb-hug.json';
import hugGuaranteeJson from '@/rules/hug-guarantee.json';
import type {
  ActionCategory, ActionPlan, DiagnosisCase, PathResult, RegistryInfo, RulePack,
} from '@/types';

const TODAY = '2026-08-01';
const PACK: RulePack = {
  version: 'manual-f10-hug',
  updatedAt: TODAY,
  rules: [...(kbHugJson as RulePack).rules, ...(hugGuaranteeJson as RulePack).rules],
};

const HUG_PATH = {
  path: 'KB_STAR_HUG',
  pathLabel: 'KB스타 전세자금대출 (HUG)',
  guaranteeProvider: 'HUG',
  guaranteeLabel: '주택도시보증공사(HUG)',
} as const;

const registry = (over: Partial<RegistryInfo> = {}): RegistryInfo => ({
  documentAddress: { value: '서울특별시 마포구 성산동 515-1', source: 'USER_CONFIRMED_DOCUMENT' },
  addressMatch: { value: 'MATCHED', source: 'USER_CONFIRMED_DOCUMENT' },
  ownerMatch: { value: 'MATCHED', source: 'USER_CONFIRMED_DOCUMENT' },
  ownerType: { value: 'INDIVIDUAL', source: 'USER_CONFIRMED_DOCUMENT' },
  hasRightsViolation: { value: false, source: 'USER_CONFIRMED_DOCUMENT' },
  existingLeaseholdRights: { value: false, source: 'USER_CONFIRMED_DOCUMENT' },
  seniorLienTotal: { value: 120000000, source: 'USER_CONFIRMED_DOCUMENT' },
  issuedDate: { value: '2026-07-20', source: 'USER_CONFIRMED_DOCUMENT' },
  ...over,
});

const base = (): DiagnosisCase => ({
  applicant: {
    age: { value: 30, source: 'USER_DECLARED' },
    householdHead: { value: 'YES', source: 'USER_DECLARED' },
    homeCount: { value: 0, source: 'USER_DECLARED' },
    maritalStatus: { value: 'SINGLE', source: 'USER_DECLARED' },
    incomeBand: { value: 'UNDER_50M', source: 'USER_DECLARED' },
    incomeType: { value: 'EMPLOYED', source: 'USER_DECLARED' },
    existingJeonseLoan: { value: 'NONE', source: 'USER_DECLARED' },
  },
  contract: {
    deposit: { value: 200000000, source: 'USER_DECLARED' },
    termMonths: { value: 24, source: 'USER_DECLARED' },
    moveInDate: { value: '2026-09-01', source: 'USER_DECLARED' },
    brokered: { value: true, source: 'USER_DECLARED' },
  },
  property: {
    address: { value: '서울특별시 마포구 월드컵로 240', source: 'PUBLIC_API' },
    jibunAddress: { value: '서울특별시 마포구 성산동 515-1', source: 'PUBLIC_API' },
    region: { value: 'CAPITAL', source: 'PUBLIC_API' },
    propertyType: { value: 'MULTI_UNIT', source: 'PUBLIC_API' },
    propertyTypeLabel: '공동주택(다세대·연립·아파트)',
    isMultiFamily: { value: false, source: 'PUBLIC_API' },
    isIllegalBuilding: { value: false, source: 'USER_CONFIRMED_DOCUMENT' },
  },
  registry: registry(),
});

function tweak(fn: (d: DiagnosisCase) => void): DiagnosisCase {
  const d = base();
  fn(d);
  return d;
}

/** /api/check 와 같은 순서: F04 → (통과했을 때만) 규칙팩 */
function runCheckLike(diag: DiagnosisCase): PathResult[] {
  const issues = validateDiagnosticSufficiency(diag, { today: TODAY });
  const sufficiency = toSufficiencyResults(issues);
  if (issues.length > 0) {
    return [{ ...HUG_PATH, blockedAt: 'INSUFFICIENT', results: sufficiency, officialReviewCount: 0 }];
  }
  const ruleResult = runRulePack(diag, PACK);
  return [{ ...ruleResult, results: [...sufficiency, ...ruleResult.results] }];
}

// ---------- F10 케이스 ----------

interface F10Case {
  name: string;
  diag: DiagnosisCase;
  expectHold: boolean;
  /** 반드시 나와야 하는 카테고리 */
  expectCategories?: ActionCategory[];
  /** 절대 나오면 안 되는 카테고리 */
  forbidCategories?: ActionCategory[];
  /** 이 규칙 id가 이 카테고리 액션을 만들어야 한다 */
  expectRuleIn?: [ruleId: string, category: ActionCategory][];
}

const F10_CASES: F10Case[] = [
  {
    name: 'F04 자료 부족 (등기부 없음)',
    diag: tweak((d) => { d.registry = undefined; }),
    expectHold: false,
    expectCategories: ['SUPPLEMENTAL_DOCUMENT'],
    forbidCategories: ['CONTRACT_HOLD', 'LANDLORD_CONFIRMATION', 'BROKER_CONFIRMATION', 'KB_QUESTION'],
  },
  {
    name: 'HUG 대상 외 주택유형',
    diag: tweak((d) => {
      d.property.propertyType = { value: 'OUT_OF_SCOPE', source: 'PUBLIC_API' };
      d.property.propertyTypeLabel = '근린생활시설';
    }),
    expectHold: true,
    expectRuleIn: [['HUG-PROPERTY-TYPE', 'CONTRACT_HOLD']],
  },
  {
    name: '위반건축물 표시 있음',
    diag: tweak((d) => {
      d.property.isIllegalBuilding = { value: true, source: 'USER_CONFIRMED_DOCUMENT' };
    }),
    expectHold: true,
    expectRuleIn: [['HUG-NOT-ILLEGAL-BUILDING', 'CONTRACT_HOLD']],
  },
  {
    name: '등기부 소유자 불일치',
    diag: tweak((d) => {
      d.registry = registry({ ownerMatch: { value: 'NOT_MATCHED', source: 'USER_CONFIRMED_DOCUMENT' } });
    }),
    expectHold: true,
    expectRuleIn: [['HUG-OWNER-MATCH', 'CONTRACT_HOLD']],
  },
  {
    name: '권리침해 기재 있음',
    diag: tweak((d) => {
      d.registry = registry({ hasRightsViolation: { value: true, source: 'USER_CONFIRMED_DOCUMENT' } });
    }),
    expectHold: true,
    expectRuleIn: [['HUG-NO-RIGHTS-VIOLATION', 'CONTRACT_HOLD']],
  },
  {
    name: '기존 전세권 있음 → 임대인 확인 + KB 질문',
    diag: tweak((d) => {
      d.registry = registry({ existingLeaseholdRights: { value: true, source: 'USER_CONFIRMED_DOCUMENT' } });
    }),
    expectHold: false,
    expectCategories: ['LANDLORD_CONFIRMATION', 'KB_QUESTION'],
    expectRuleIn: [
      ['HUG-LEASEHOLD-TRANSFER', 'LANDLORD_CONFIRMATION'],
      ['HUG-LEASEHOLD-TRANSFER', 'KB_QUESTION'],
    ],
  },
  {
    name: '공식 주택가격 없음 → KB 상담 질문',
    diag: base(),
    expectHold: false,
    expectCategories: ['KB_QUESTION'],
    expectRuleIn: [['HUG-COLLATERAL-RATIO', 'KB_QUESTION']],
  },
  {
    name: '직거래 → 중개사 확인사항',
    diag: tweak((d) => { d.contract.brokered = { value: false, source: 'USER_DECLARED' }; }),
    expectHold: false,
    expectCategories: ['BROKER_CONFIRMATION'],
    expectRuleIn: [
      ['KB-HUG-BROKERED', 'BROKER_CONFIRMATION'],
      ['HUG-BROKERED', 'BROKER_CONFIRMATION'],
    ],
  },
  {
    name: '공동소유자 일부만 임대인 → 임대인 확인사항',
    diag: tweak((d) => {
      d.registry = registry({
        ownerMatch: { value: 'MATCHED_PARTIAL_CO_OWNERS', source: 'USER_CONFIRMED_DOCUMENT' },
      });
    }),
    expectHold: false,
    expectRuleIn: [['HUG-OWNER-MATCH', 'LANDLORD_CONFIRMATION']],
  },
  {
    name: '정상 HUG 입력 → 계약 보류 없음',
    diag: base(),
    expectHold: false,
    forbidCategories: ['CONTRACT_HOLD'],
  },
];

function categoriesOf(plan: ActionPlan): ActionCategory[] {
  return plan.items
    .map((i) => i.category)
    .filter((c, i, all) => all.indexOf(c) === i);
}

let failed = 0;
const fail = (name: string, msg: string) => {
  failed += 1;
  console.log(`[FAIL] ${name}`);
  console.log(`        ↳ ${msg}`);
};
const pass = (name: string, note = '') => console.log(`[ OK ] ${name.padEnd(42)}${note}`);

console.log('--- F10 buildActionPlan ---');
for (const c of F10_CASES) {
  const pathResults = runCheckLike(c.diag);
  const plan = buildActionPlan(pathResults);
  const cats = categoriesOf(plan);
  const problems: string[] = [];

  if (plan.contractHoldRecommended !== c.expectHold) {
    problems.push(`contractHoldRecommended=${plan.contractHoldRecommended} (기대 ${c.expectHold})`);
  }
  for (const want of c.expectCategories ?? []) {
    if (!cats.includes(want)) problems.push(`카테고리 ${want} 없음`);
  }
  for (const banned of c.forbidCategories ?? []) {
    if (cats.includes(banned)) problems.push(`카테고리 ${banned} 나오면 안 됨`);
  }
  for (const [ruleId, category] of c.expectRuleIn ?? []) {
    const hit = plan.items.some((i) => i.category === category && i.sourceRuleIds.includes(ruleId));
    if (!hit) problems.push(`${ruleId} 이 ${category} 액션을 만들지 않음`);
  }
  if (!plan.headline.trim()) problems.push('headline 비어 있음');
  if (/승인|가능성이 높|통과할/.test(plan.headline) && !plan.headline.includes('승인 의미 아님')) {
    problems.push(`headline 이 승인 가능성을 암시함: ${plan.headline}`);
  }
  // id는 화면 key로 쓰이므로 중복되면 안 된다
  const ids = plan.items.map((i) => i.id);
  if (new Set(ids).size !== ids.length) problems.push(`ActionItem id 중복: ${ids.join(', ')}`);
  // 결정론 — 같은 입력이면 같은 결과
  if (JSON.stringify(buildActionPlan(pathResults)) !== JSON.stringify(plan)) {
    problems.push('같은 입력인데 결과가 다름 (결정론 위반)');
  }

  if (problems.length > 0) fail(c.name, problems.join(' / '));
  else pass(c.name, `액션 ${plan.items.length}건 [${cats.join(', ')}]`);
}

// ---------- F11 /api/report ----------

const post = (body: unknown) =>
  reportPOST(
    new Request('http://localhost/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

async function runReportTests() {
  console.log('\n--- F11 /api/report ---');
  const diag = base();
  const pathResults = runCheckLike(diag);
  const actionPlan = buildActionPlan(pathResults);
  const realFetch = globalThis.fetch;

  // 1) 동의 누락
  delete process.env.GEMINI_API_KEY;
  {
    const res = await post({ pathResults });
    const body = await res.json();
    if (res.status !== 400 || body.code !== 'CONSENT_REQUIRED') {
      fail('동의 누락 → 400', `status=${res.status} code=${body.code}`);
    } else pass('동의 누락 → 400 CONSENT_REQUIRED');
  }

  // 2) 동의 false
  {
    const res = await post({ consent: false, pathResults });
    const body = await res.json();
    if (res.status !== 400 || body.code !== 'CONSENT_REQUIRED') {
      fail('동의 false → 400', `status=${res.status} code=${body.code}`);
    } else pass('동의 false → 400 CONSENT_REQUIRED');
  }

  // 3) 동의했지만 판정 결과 없음
  {
    const res = await post({ consent: true, pathResults: [] });
    const body = await res.json();
    if (res.status !== 400 || body.code !== 'NO_PATH_RESULTS') {
      fail('판정 결과 없음 → 400', `status=${res.status} code=${body.code}`);
    } else pass('판정 결과 없음 → 400 NO_PATH_RESULTS');
  }

  // 3-1) 읽을 수 있는 행이 하나도 없으면 500이 아니라 400
  {
    const malformed: [string, unknown][] = [
      ['빈 객체', [{}]],
      ['results 원소가 빈 객체', [{ ...HUG_PATH, blockedAt: 'NONE', officialReviewCount: 0, results: [{}] }]],
      ['null 원소', [null]],
      ['문자열 원소', ['문자열']],
      ['배열 아님', { path: 'KB_STAR_HUG' }],
      [
        // 모양은 맞지만 enum 값이 틀린 경우 — 예전에는 200 + '막힌 단계: undefined' 였다
        'blockedAt 값이 틀림',
        [{ ...HUG_PATH, blockedAt: 'NOPE', officialReviewCount: 0, results: [] }],
      ],
      [
        'verdict 값이 틀림',
        [{
          ...HUG_PATH, blockedAt: 'NONE', officialReviewCount: 0,
          results: [{ ruleId: 'X', layer: 'PRODUCT', verdict: 'APPROVED', label: 'L', reason: 'R', usedValues: [], nextAction: '' }],
        }],
      ],
      [
        'usedValues 가 배열이 아님',
        [{
          ...HUG_PATH, blockedAt: 'NONE', officialReviewCount: 0,
          results: [{ ruleId: 'X', layer: 'PRODUCT', verdict: 'NO_PUBLIC_CONFLICT_FOUND', label: 'L', reason: 'R', usedValues: 'x', nextAction: '' }],
        }],
      ],
    ];
    for (const [label, bad] of malformed) {
      let res: Response;
      try {
        res = await post({ consent: true, pathResults: bad });
      } catch (e) {
        fail(`형식 오류: ${label}`, `예외로 터짐 (500) — ${(e as Error).message}`);
        continue;
      }
      const body = await res.json();
      if (res.status !== 400 || body.code !== 'INVALID_BODY') {
        fail(`형식 오류: ${label}`, `status=${res.status} code=${body.code} report=${String(body.report).slice(0, 60)}`);
      } else pass(`형식 오류 → 400 INVALID_BODY: ${label}`);
    }
  }

  // 3-1-b) 정상 행 + 깨진 행 → 깨진 행만 버리고 정상 행으로 보고서를 만든다
  {
    const res = await post({ consent: true, pathResults: [pathResults[0], {}, null] });
    const body = await res.json();
    const report: string = body.report ?? '';
    const problems: string[] = [];
    if (res.status !== 200) problems.push(`status=${res.status} code=${body.code}`);
    if (!report.includes('2층 · HUG 보증요건')) problems.push('정상 행이 보고서에 없음');
    if (!report.includes('대조 경로: 1개')) problems.push('깨진 행이 경로 수에 잡힘');
    if (/undefined/.test(report)) problems.push('깨진 행이 보고서에 섞임');
    if (problems.length > 0) fail('정상 행 + 깨진 행', problems.join(' / '));
    else pass('정상 행 + 깨진 행 → 깨진 행만 버리고 진행');
  }

  // 3-2) diagnosis 가 깨져 있어도 'undefined' 가 박힌 줄을 내보내지 않는다
  {
    const res = await post({
      consent: true,
      pathResults,
      diagnosis: {
        applicant: { age: { value: null, source: 'USER_DECLARED' }, householdHead: { value: 'BOGUS', source: 'USER_DECLARED' } },
        contract: { deposit: { value: '이억', source: 'USER_DECLARED' } },
        property: { address: { value: '서울시 어딘가', source: 'MADE_UP_SOURCE' } },
      },
    });
    const report: string = (await res.json()).report ?? '';
    if (res.status !== 200) fail('깨진 diagnosis', `status=${res.status}`);
    else if (/undefined|NaN/.test(report)) {
      const line = report.split('\n').find((l) => /undefined|NaN/.test(l));
      fail('깨진 diagnosis', `보고서에 못 읽는 값이 들어감: ${line}`);
    } else pass('깨진 diagnosis → 해당 줄만 빠지고 나머지는 정상');
  }

  // 4) Gemini 키 없음 → 템플릿 + llm:false, 그리고 템플릿 내용 검증
  {
    const res = await post({ consent: true, pathResults, diagnosis: diag, actionPlan });
    const body = await res.json();
    const problems: string[] = [];
    if (res.status !== 200) problems.push(`status=${res.status}`);
    if (body.llm !== false) problems.push(`llm=${body.llm} (기대 false)`);
    const report: string = body.report ?? '';
    const must = [
      '판정에 사용한 입력값과 출처', // 입력값 절
      '(자기신고)',                  // 출처 표기
      '(공공API)',
      '(고객확인문서)',
      '다음 행동 (F10)',             // F10 액션
      'KB 상담 질문',
      '2층 · HUG 보증요건',          // HUG 판정
      "'확인된 충돌 없음'은 승인·보증 가능을 의미하지 않습니다",
    ];
    for (const m of must) if (!report.includes(m)) problems.push(`템플릿에 '${m}' 없음`);
    if (problems.length > 0) fail('키 없음 → 템플릿 보고서', problems.join(' / '));
    else pass('키 없음 → 템플릿 보고서 + llm:false', `${report.length}자`);
  }

  // 5) Gemini 호출 실패 → 템플릿 폴백 (네트워크를 막아 결정론적으로 실패시킨다)
  {
    process.env.GEMINI_API_KEY = 'test-invalid-key';
    globalThis.fetch = (async () => {
      throw new Error('네트워크 차단 (테스트)');
    }) as typeof fetch;
    try {
      const res = await post({ consent: true, pathResults, diagnosis: diag, actionPlan });
      const body = await res.json();
      if (res.status !== 200 || body.llm !== false || !body.report?.includes('다음 행동 (F10)')) {
        fail('Gemini 실패 → 템플릿 폴백', `status=${res.status} llm=${body.llm}`);
      } else pass('Gemini 실패 → 템플릿 폴백 + llm:false');
    } finally {
      globalThis.fetch = realFetch;
      delete process.env.GEMINI_API_KEY;
    }
  }

  // 6) 클라이언트가 보낸 actionPlan 을 프롬프트·보고서에 그대로 쓰지 않는다
  {
    const res = await post({
      consent: true,
      pathResults,
      diagnosis: diag,
      actionPlan: {
        headline: '주입된 문구 — 승인 가능성이 높습니다',
        contractHoldRecommended: false,
        items: [
          {
            id: 'X', category: 'KB_QUESTION', severity: 'info',
            title: '주입된 항목', detail: '주입된 상세', sourceRuleIds: ['INJECTED'],
          },
        ],
      },
    });
    const report: string = (await res.json()).report ?? '';
    if (report.includes('주입된') || report.includes('INJECTED')) {
      fail('클라이언트 actionPlan 무시', '주입된 문구가 보고서에 들어감');
    } else pass('클라이언트 actionPlan 무시 (서버에서 재계산)');
  }

  console.log(failed === 0 ? '\n전체 통과' : `\n${failed}건 실패`);
  process.exit(failed > 0 ? 1 : 0);
}

runReportTests();
