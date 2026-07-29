// F04 진단자료 충분성 검사 수동 테스트: npx tsx --tsconfig tsconfig.json tests/sufficiency.manual.ts
// 발급일 검사가 '오늘'에 의존하므로 today를 고정해서 돌린다.
import { validateDiagnosticSufficiency } from '@/lib/rule-engine/sufficiency';
import { runRulePack } from '@/lib/rule-engine';
import kbHugJson from '@/rules/kb-hug.json';
import hugGuaranteeJson from '@/rules/hug-guarantee.json';
import type { DiagnosisCase, RegistryInfo, RulePack } from '@/types';

const TODAY = '2026-08-01';
const PACK: RulePack = {
  version: 'manual-f04-hug',
  updatedAt: TODAY,
  rules: [
    ...(kbHugJson as RulePack).rules,
    ...(hugGuaranteeJson as RulePack).rules,
  ],
};

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

/** 모든 필수값과 출처가 갖춰진 기준 케이스 */
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

/** 기존 mutate 헬퍼 — 깊은 복사 후 수정 */
function tweak(fn: (d: DiagnosisCase) => void): DiagnosisCase {
  const d = base();
  fn(d);
  return d;
}

interface Case {
  name: string;
  diag: DiagnosisCase;
  /** 기대: F04 이슈 id 부분문자열들. 빈 배열 = F04 통과 */
  expectIssues: string[];
  /** F04 통과 시 규칙엔진에서 기대하는 것 (선택) */
  expectRule?: { ruleId: string; verdict: string };
}

const CASES: Case[] = [
  { name: '모든 필수값·출처 있음', diag: base(), expectIssues: [] },

  {
    name: "소득구간 '모름'",
    diag: tweak((d) => { d.applicant.incomeBand = { value: 'UNKNOWN', source: 'USER_DECLARED' }; }),
    expectIssues: ['F04-APPLICANT-INCOME-UNKNOWN'],
  },
  {
    name: '출처(source) 없는 값',
    diag: tweak((d) => { d.applicant.age = { value: 30 } as never; }),
    expectIssues: ['F04-APPLICANT-AGE'],
  },
  {
    name: 'enum 범위 밖 값',
    diag: tweak((d) => { d.applicant.householdHead = { value: 'MAYBE' as never, source: 'USER_DECLARED' }; }),
    expectIssues: ['F04-APPLICANT-HOUSEHOLD'],
  },

  // 항목별 기대 출처 — 출처 코드가 붙어 있기만 하면 통과시키면 안 된다
  {
    name: '등기부 값이 자기신고로 옴',
    diag: tweak((d) => {
      d.registry = registry({ ownerMatch: { value: 'MATCHED', source: 'USER_DECLARED' } });
    }),
    expectIssues: ['F04-REGISTRY-OWNER-MATCH'],
  },
  {
    name: '주택 유형이 자기신고로 옴 (자기신고 경로 없음)',
    diag: tweak((d) => {
      d.property.propertyType = { value: 'APT', source: 'USER_DECLARED' };
    }),
    expectIssues: ['F04-PROPERTY-TYPE'],
  },
  {
    name: '위반건축물이 공공API 출처로 옴 (공개 API 미제공)',
    diag: tweak((d) => {
      d.property.isIllegalBuilding = { value: false, source: 'PUBLIC_API' };
    }),
    expectIssues: ['F04-PROPERTY-ILLEGAL'],
  },
  {
    name: 'INTERNAL_REQUIRED 출처는 확보된 값이 아님',
    diag: tweak((d) => {
      d.registry = registry({ seniorLienTotal: { value: 0, source: 'INTERNAL_REQUIRED' } });
    }),
    expectIssues: ['F04-REGISTRY-LIEN'],
  },
  {
    name: '입주 예정일이 과거',
    diag: tweak((d) => { d.contract.moveInDate = { value: '2026-06-01', source: 'USER_DECLARED' }; }),
    expectIssues: ['F04-CONTRACT-MOVEIN-PAST'],
  },
  {
    name: '입주 예정일 형식 오류',
    diag: tweak((d) => { d.contract.moveInDate = { value: '2026-02-31', source: 'USER_DECLARED' }; }),
    expectIssues: ['F04-CONTRACT-MOVEIN'],
  },

  {
    name: '등기부 미업로드',
    diag: tweak((d) => { d.registry = undefined; }),
    expectIssues: ['F04-REGISTRY'],
  },
  {
    name: '등기부 주소 확인 안 됨',
    diag: tweak((d) => { d.registry = registry({ addressMatch: undefined }); }),
    expectIssues: ['F04-REGISTRY-ADDRESS-MATCH'],
  },
  {
    name: '등기부 주소 불일치',
    diag: tweak((d) => {
      d.registry = registry({ addressMatch: { value: 'NOT_MATCHED', source: 'USER_CONFIRMED_DOCUMENT' } });
    }),
    expectIssues: ['F04-REGISTRY-ADDRESS-CONFLICT'],
  },
  {
    name: '발급일 없음',
    diag: tweak((d) => { d.registry = registry({ issuedDate: undefined }); }),
    expectIssues: ['F04-REGISTRY-ISSUED'],
  },
  {
    name: '발급일 미래',
    diag: tweak((d) => {
      d.registry = registry({ issuedDate: { value: '2026-08-15', source: 'USER_CONFIRMED_DOCUMENT' } });
    }),
    expectIssues: ['F04-REGISTRY-ISSUED-FUTURE'],
  },
  {
    name: '발급일 30일 초과',
    diag: tweak((d) => {
      d.registry = registry({ issuedDate: { value: '2026-06-25', source: 'USER_CONFIRMED_DOCUMENT' } });
    }),
    expectIssues: ['F04-REGISTRY-ISSUED-STALE'],
  },
  {
    name: '발급일 정확히 30일 전 (경계 — 통과)',
    diag: tweak((d) => {
      d.registry = registry({ issuedDate: { value: '2026-07-02', source: 'USER_CONFIRMED_DOCUMENT' } });
    }),
    expectIssues: [],
  },
  {
    name: '근저당 미확인',
    diag: tweak((d) => { d.registry = registry({ seniorLienTotal: undefined }); }),
    expectIssues: ['F04-REGISTRY-LIEN'],
  },
  {
    name: '근저당 0원 확인됨 (통과)',
    diag: tweak((d) => {
      d.registry = registry({ seniorLienTotal: { value: 0, source: 'USER_CONFIRMED_DOCUMENT' } });
    }),
    expectIssues: [],
  },

  {
    name: '위반건축물 여부 미확인',
    diag: tweak((d) => { d.property.isIllegalBuilding = undefined; }),
    expectIssues: ['F04-PROPERTY-ILLEGAL'],
  },
  {
    name: '위반건축물 있음 → F04 통과 후 HUG 룰이 미충족',
    diag: tweak((d) => {
      d.property.isIllegalBuilding = { value: true, source: 'USER_CONFIRMED_DOCUMENT' };
    }),
    expectIssues: [],
    expectRule: { ruleId: 'HUG-NOT-ILLEGAL-BUILDING', verdict: 'PUBLIC_REQUIREMENT_UNMET' },
  },
  {
    name: '만 19세 미만 → F04 아니라 HUG 상품 룰이 미충족',
    diag: tweak((d) => { d.applicant.age = { value: 18, source: 'USER_DECLARED' }; }),
    expectIssues: [],
    expectRule: { ruleId: 'KB-HUG-AGE', verdict: 'PUBLIC_REQUIREMENT_UNMET' },
  },
  {
    name: '직거래 → F04 아니라 기존 룰이 미충족',
    diag: tweak((d) => { d.contract.brokered = { value: false, source: 'USER_DECLARED' }; }),
    expectIssues: [],
    expectRule: { ruleId: 'KB-HUG-BROKERED', verdict: 'PUBLIC_REQUIREMENT_UNMET' },
  },
  {
    name: '건축물대장 조회 실패 (주택 유형 없음)',
    diag: tweak((d) => { d.property.propertyType = undefined; d.property.isMultiFamily = undefined; }),
    expectIssues: ['F04-PROPERTY-TYPE', 'F04-PROPERTY-MULTIFAMILY'],
  },
];

let failed = 0;

for (const c of CASES) {
  const issues = validateDiagnosticSufficiency(c.diag, { today: TODAY });
  const ids = issues.map((i) => i.id);

  const missing = c.expectIssues.filter((e) => !ids.some((id) => id.includes(e)));
  const unexpected = c.expectIssues.length === 0 && ids.length > 0;
  let problem = '';
  if (missing.length > 0) problem = `기대한 이슈 없음: ${missing.join(', ')}`;
  else if (unexpected) problem = `통과해야 하는데 이슈 발생: ${ids.join(', ')}`;

  // F04를 통과한 케이스만 규칙엔진이 돈다 (/api/check 와 같은 순서)
  let ruleNote = '';
  if (issues.length === 0) {
    const pathResult = runRulePack(c.diag, PACK);
    if (c.expectRule) {
      const hit = pathResult.results.find((r) => r.ruleId === c.expectRule!.ruleId);
      if (!hit) problem ||= `규칙 ${c.expectRule.ruleId} 결과 없음`;
      else if (hit.verdict !== c.expectRule.verdict) {
        problem ||= `규칙 ${c.expectRule.ruleId} 판정 ${hit.verdict} (기대 ${c.expectRule.verdict})`;
      } else ruleNote = ` · ${c.expectRule.ruleId}=${hit.verdict}`;
    } else {
      ruleNote = ` · blockedAt=${pathResult.blockedAt}`;
    }
  }

  if (problem) failed += 1;
  const mark = problem ? 'FAIL' : ' OK ';
  const summary = issues.length === 0 ? 'F04 통과' : `F04 이슈 ${issues.length}건 [${ids.join(', ')}]`;
  console.log(`[${mark}] ${c.name.padEnd(34)} ${summary}${ruleNote}`);
  if (problem) console.log(`        ↳ ${problem}`);
}

console.log(`\n${CASES.length - failed}/${CASES.length} 통과`);
process.exit(failed > 0 ? 1 : 0);
