// 진단 플로우 UI 수동 테스트 (헤드리스 Chromium)
//
//   1) 다른 터미널에서  npm run dev
//   2) UI_TEST_EMAIL=... UI_TEST_PASSWORD=... npx tsx --tsconfig tsconfig.json tests/ui-flow.manual.ts
//
// 판정 로직은 tests/f10-f11.manual.ts 가 검사한다. 여기서 보는 것은 화면에서만 드러나는 것들이다:
// F10 패널이 실제로 그려지는가, 동의 전 요약 생성 버튼이 잠겨 있는가, 이력 상세에서도 같은 패널이
// 나오는가, 그리고 어느 단계에서도 콘솔 에러가 없는가.
//
// 계정은 절대 커밋하지 않는다 — 환경변수로만 받는다.
// 브라우저 바이너리는 별도다: 최초 1회 `npx playwright install chromium`
import { chromium, type Page } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.UI_TEST_BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.UI_TEST_EMAIL;
const PASSWORD = process.env.UI_TEST_PASSWORD;

/** 스크린샷은 커밋하지 않는다 (.gitignore) — 실패했을 때 눈으로 보려고 남긴다 */
const SHOTS = path.join(process.cwd(), 'tests', '.ui-shots');

let step = 0;
let failed = 0;
const consoleErrors: string[] = [];

const pass = (name: string, note = '') => console.log(`[ OK ] ${name.padEnd(40)}${note}`);
const fail = (name: string, why: string) => {
  failed += 1;
  console.log(`[FAIL] ${name}`);
  console.log(`        ↳ ${why}`);
};

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS, `${String(++step).padStart(2, '0')}-${name}.png`), fullPage: true });
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('UI_TEST_EMAIL / UI_TEST_PASSWORD 가 필요합니다 (판정 실행은 로그인 필수).');
    process.exit(2);
  }
  const alive = await fetch(BASE).then((r) => r.ok).catch(() => false);
  if (!alive) {
    console.error(`${BASE} 에 dev 서버가 없습니다. 다른 터미널에서 npm run dev 를 먼저 띄우세요.`);
    process.exit(2);
  }

  rmSync(SHOTS, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1400 } })).newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

  try {
    // ---- 로그인 ----
    await page.goto(`${BASE}/login?next=/diagnosis`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    // URL 정규식으로 기다리면 안 된다 — `/login?next=/diagnosis` 가 이미 /diagnosis/ 에 매칭돼
    // 즉시 통과하고, 세션 쿠키가 써지기 전에 다음 단계로 넘어가 로그인 게이트에 다시 막힌다.
    // 로그인이 끝났다는 실제 신호(헤더의 로그아웃)를 기다린다.
    await page.waitForSelector('text=로그아웃', { timeout: 30_000 });
    await shot(page, 'logged-in');
    pass('로그인');

    // ---- 1단계 신청인 (기본값 그대로) ----
    await page.goto(`${BASE}/diagnosis`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=1. 신청인 조건', { timeout: 30_000 });
    await page.click('button:has-text("다음")');

    // ---- 2단계 예정 계약 ----
    await page.waitForSelector('text=2. 예정 계약 내용');
    await page.fill('input[type="number"] >> nth=0', '200000000');
    await page.fill('input[type="number"] >> nth=1', '24');
    await page.fill('input[type="date"]', '2026-12-01');
    await page.click('button:has-text("다음")');

    // ---- 3단계 매물 (실제 주소검색·건축HUB 호출) ----
    await page.waitForSelector('text=3. 매물·등기 정보');
    await page.fill('input[placeholder*="월드컵로"]', '마포구 월드컵로 240');
    await page.click('button:has-text("주소 검색")');
    await page.waitForSelector('text=검색 결과', { timeout: 30_000 });
    await page.click('button:has-text("월드컵로 240") >> nth=0');
    await page.waitForSelector('text=선택한 매물', { timeout: 30_000 });
    // 위반건축물 선택은 3단계 마지막 select 다 (고르지 않으면 F04가 진단을 보류한다)
    const selects = page.locator('select');
    await selects.nth((await selects.count()) - 1).selectOption('NO');
    await shot(page, 'step3');
    pass('1~3단계 입력 (주소검색·건축HUB 실호출)');

    // ---- 판정 실행 → 결과 ----
    await page.click('button:has-text("사전점검 실행")');
    if (await page.locator('text=로그인이 필요합니다').count()) {
      throw new Error('로그인 게이트에 막힘 — 세션이 유지되지 않았다');
    }
    await page.waitForSelector('#action-plan', { timeout: 60_000 });
    await shot(page, 'result');
    pass('결과 화면 F10 패널 노출');

    const items = await page.locator('#action-plan li').count();
    if (items === 0) fail('F10 액션 항목', '패널은 떴는데 항목이 0개다');
    else pass('F10 액션 항목', `${items}건`);

    // 사용자는 규칙 목록보다 결론·다음 행동을 먼저 봐야 한다 — 세로 순서를 고정한다.
    // evaluate 에 함수를 넘기면 tsx(esbuild)가 주입한 __name 헬퍼가 브라우저에서 터진다
    // (ReferenceError: __name is not defined). 문자열 표현식으로 넘겨 변환을 피한다.
    const order = (await page.evaluate(`(function () {
      function y(sel) {
        var el = document.querySelector(sel);
        return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : -1;
      }
      return { summary: y('main section'), plan: y('#action-plan'), detail: y('details.card') };
    })()`)) as { summary: number; plan: number; detail: number };
    if (order.summary < 0 || order.plan < 0 || order.detail < 0) {
      fail('결과 화면 순서', `찾지 못한 영역: ${JSON.stringify(order)}`);
    } else if (!(order.summary < order.plan && order.plan < order.detail)) {
      fail('결과 화면 순서', `종합요약 → 다음행동 → 판정상세가 아니다: ${JSON.stringify(order)}`);
    } else pass('결과 화면 순서', '종합요약 → 다음행동 → 판정상세');

    // ---- F11 동의 게이트 ----
    const btn = page.locator('button:has-text("KB 상담 메모 만들기")');
    if (!(await btn.isDisabled())) fail('동의 전 메모 생성 차단', '동의 없이 버튼이 활성 상태다');
    else pass('동의 전 메모 생성 차단', 'disabled');

    await page.locator('input[type="checkbox"]').check();
    if (await btn.isDisabled()) fail('동의 후 메모 생성 허용', '동의했는데 버튼이 잠겨 있다');
    else pass('동의 후 메모 생성 허용', 'enabled');

    // 동의 판단에 필요한 두 가지는 접힘 안으로 숨기면 안 된다
    const consentText = await page.locator('label:has(input[type="checkbox"])').innerText();
    const hidden = ['전송', '저장하지 않'].filter((s) => !consentText.includes(s));
    if (hidden.length) fail('동의 문구 핵심 노출', `접힘에 가려짐: ${hidden.join(', ')}`);
    else pass('동의 문구 핵심 노출', '전송·미저장 명시');

    await btn.click();
    await page.waitForSelector('pre', { timeout: 60_000 });
    const report = (await page.locator('pre').first().innerText()).trim();
    await shot(page, 'report');
    // Gemini 키가 막혀 있으면 템플릿으로 폴백한다 — 어느 쪽이든 이 절들은 있어야 한다
    const missing = ['판정에 사용한 입력값과 출처', '다음 행동', '승인'].filter((s) => !report.includes(s));
    if (report.length < 500) fail('보고서 생성', `너무 짧다 (${report.length}자)`);
    else if (missing.length) fail('보고서 생성', `빠진 절: ${missing.join(', ')}`);
    else pass('보고서 생성·표시', `${report.length}자`);

    if (!(await page.locator('button:has-text("복사")').count())) fail('복사 버튼', '없다');
    else pass('복사 버튼 노출');

    // ---- 이력 상세에서도 같은 패널 (저장된 pathResults로 재계산) ----
    await page.goto(`${BASE}/diagnosis/result`, { waitUntil: 'networkidle' });
    const link = page.locator('a[href^="/diagnosis/result/"]').first();
    if (!(await link.count())) fail('이력 목록', '저장된 진단이 없다');
    else {
      await link.click();
      await page.waitForSelector('#action-plan', { timeout: 30_000 });
      await shot(page, 'history-detail');
      pass('이력 상세 F10 패널 노출');
    }
  } catch (e) {
    fail('플로우', (e as Error).message.split('\n')[0]);
    await shot(page, 'failure');
  } finally {
    if (consoleErrors.length) {
      fail('콘솔 에러 없음', `${consoleErrors.length}건`);
      consoleErrors.slice(0, 5).forEach((e) => console.log(`        ! ${e.slice(0, 160)}`));
    } else pass('콘솔 에러 없음', '0건');
    await browser.close();
  }

  console.log(failed === 0 ? `\n전체 통과 · 스크린샷 ${SHOTS}` : `\n${failed}건 실패 · 스크린샷 ${SHOTS}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
