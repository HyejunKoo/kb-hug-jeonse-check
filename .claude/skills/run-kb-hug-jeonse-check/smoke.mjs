// 실행 중인 dev/prod 서버에 실제 HTTP 로 붙는 스모크.
//
//   node .claude/skills/run-kb-hug-jeonse-check/smoke.mjs [baseUrl]
//
// tests/*.manual.ts 는 route handler 를 in-process 로 import 해서 부른다. 그건 빠르지만
// Next 라우팅·middleware·직렬화를 건너뛴다. 이 스크립트는 소켓 너머로 친다 — 판정 로직이 아니라
// "서버가 실제로 서비스되고 있는가"를 본다.
//
// 인증 없이 돈다: /api/check 는 비로그인도 판정을 돌려주고 저장만 생략한다(caseId 없음).
// 로그인이 필요한 화면 흐름은 tests/ui-flow.manual.ts 담당.

const BASE = process.argv[2] ?? 'http://localhost:3000';

let failed = 0;
const pass = (n, note = '') => console.log(`[ OK ] ${n.padEnd(38)}${note}`);
const fail = (n, why) => { failed += 1; console.log(`[FAIL] ${n}\n        ↳ ${why}`); };

const post = (p, body) =>
  fetch(`${BASE}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/** 모든 필수값·출처가 갖춰진 진단 1건 (F04 를 통과해 규칙팩까지 도달한다) */
const diagnosis = () => {
  const d = new Date();
  const iso = (offsetDays) =>
    new Date(d.getTime() + offsetDays * 86_400_000).toISOString().slice(0, 10);
  return {
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
      moveInDate: { value: iso(30), source: 'USER_DECLARED' }, // 미래여야 한다 (F04)
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
    registry: {
      documentAddress: { value: '서울특별시 마포구 성산동 515-1', source: 'USER_CONFIRMED_DOCUMENT' },
      addressMatch: { value: 'MATCHED', source: 'USER_CONFIRMED_DOCUMENT' },
      ownerMatch: { value: 'MATCHED', source: 'USER_CONFIRMED_DOCUMENT' },
      ownerType: { value: 'INDIVIDUAL', source: 'USER_CONFIRMED_DOCUMENT' },
      hasRightsViolation: { value: false, source: 'USER_CONFIRMED_DOCUMENT' },
      existingLeaseholdRights: { value: false, source: 'USER_CONFIRMED_DOCUMENT' },
      seniorLienTotal: { value: 120000000, source: 'USER_CONFIRMED_DOCUMENT' },
      issuedDate: { value: iso(-3), source: 'USER_CONFIRMED_DOCUMENT' }, // 30일 이내여야 한다 (F04)
    },
  };
};

async function main() {
  if (!(await fetch(BASE).then((r) => r.ok).catch(() => false))) {
    console.error(`${BASE} 에 서버가 없습니다. npm run dev 를 먼저 띄우세요.`);
    process.exit(2);
  }

  // ---- 랜딩 ----
  const home = await fetch(BASE);
  home.ok ? pass('GET /', `${home.status}`) : fail('GET /', `status=${home.status}`);

  // ---- 규칙팩 (크롤링·DB·폴백 중 어디서 왔는지) ----
  const rules = await fetch(`${BASE}/api/rules`).then((r) => r.json()).catch(() => null);
  if (!rules?.rules?.length) fail('GET /api/rules', '규칙이 비었다');
  else pass('GET /api/rules', `${rules.rules.length}개 · ${rules.source} · ${rules.version}`);

  // ---- 판정 ----
  const diag = diagnosis();
  const checkRes = await post('/api/check', diag);
  const check = await checkRes.json();
  const path = check.pathResults?.[0];
  if (!checkRes.ok || !path) {
    fail('POST /api/check', `status=${checkRes.status} ${JSON.stringify(check).slice(0, 160)}`);
  } else {
    pass('POST /api/check', `blockedAt=${path.blockedAt} · 항목 ${path.results.length}개 · ${check.ruleSource}`);
    // F04 를 통과했다면 SUFFICIENCY 만 있을 리 없다 — 규칙팩까지 갔는지 본다
    const layers = [...new Set(path.results.map((r) => r.layer))];
    if (path.blockedAt === 'INSUFFICIENT') {
      fail('F04 통과', `자료 부족으로 막힘: ${path.results.map((r) => r.ruleId).join(', ')}`);
    } else if (!layers.includes('PRODUCT') || !layers.includes('GUARANTEE')) {
      fail('규칙팩 2층 실행', `층: ${layers.join(', ')}`);
    } else pass('규칙팩 2층 실행', layers.join(', '));

    if (!check.actionPlan) fail('F10 actionPlan 동봉', '응답에 없다');
    else pass('F10 actionPlan 동봉', `${check.actionPlan.items.length}건 · 보류=${check.actionPlan.contractHoldRecommended}`);
  }

  // ---- 동의 게이트 ----
  const noConsent = await post('/api/report', { pathResults: check.pathResults });
  const nc = await noConsent.json();
  if (noConsent.status !== 400 || nc.code !== 'CONSENT_REQUIRED') {
    fail('POST /api/report 동의 없음', `status=${noConsent.status} code=${nc.code}`);
  } else pass('POST /api/report 동의 없음', '400 CONSENT_REQUIRED');

  const bad = await post('/api/report', { consent: true, pathResults: [{}] });
  const bd = await bad.json();
  if (bad.status !== 400 || bd.code !== 'INVALID_BODY') {
    fail('POST /api/report 형식 오류', `status=${bad.status} code=${bd.code}`);
  } else pass('POST /api/report 형식 오류', '400 INVALID_BODY');

  const ok = await post('/api/report', {
    consent: true,
    pathResults: check.pathResults,
    diagnosis: diag,
    actionPlan: check.actionPlan,
  });
  const rp = await ok.json();
  if (!ok.ok || typeof rp.report !== 'string' || rp.report.length < 500) {
    fail('POST /api/report 동의함', `status=${ok.status} len=${rp.report?.length}`);
  } else {
    // llm:false 는 정상일 수 있다 — 키가 없거나 막혀 있으면 템플릿으로 폴백한다
    pass('POST /api/report 동의함', `${rp.report.length}자 · llm=${rp.llm}`);
    const need = ['판정에 사용한 입력값과 출처', '다음 행동'];
    const miss = need.filter((s) => !rp.report.includes(s));
    miss.length ? fail('보고서 구성', `빠진 절: ${miss}`) : pass('보고서 구성', need.join(' / '));
  }

  // ---- 로그인 필요 라우트는 비로그인이면 막혀야 한다 ----
  const cases = await fetch(`${BASE}/api/cases`, { redirect: 'manual' });
  [401, 403, 302, 307].includes(cases.status)
    ? pass('GET /api/cases 비로그인 차단', `${cases.status}`)
    : fail('GET /api/cases 비로그인 차단', `status=${cases.status} (인증 없이 통과했다)`);

  console.log(failed === 0 ? '\n전체 통과' : `\n${failed}건 실패`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
