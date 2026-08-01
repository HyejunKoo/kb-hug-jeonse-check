---
name: run-kb-hug-jeonse-check
description: KB 전세 코파일럿(Next.js 14)을 빌드·실행·검증한다. dev 서버 기동, /api 스모크, 헤드리스 Chromium 으로 진단 플로우 드라이브, 스크린샷. run/start/build/test/screenshot the app, 앱 실행, 화면 확인, UI 검증 요청에 사용.
---

계약 전 전세 사전점검 웹앱. Next.js 14 App Router + Supabase + 외부 공공 API(주소검색·건축HUB).
**Windows 11 / PowerShell + Git Bash 에서 검증했다.** 아래 명령은 전부 그 환경에서 실제로 돌린 것이다.

경로는 모두 레포 루트(`kb-hug-jeonse-check/`) 기준.

세 가지 진입점이 있고, **변경한 층에 맞는 것을 골라라**:

| 무엇을 바꿨나 | 쓸 것 |
|---|---|
| 규칙·판정 로직 (`lib/rule-engine`, `src/rules`, `features/result`) — **대부분의 PR** | `tests/*.manual.ts` 직접 호출 |
| API 라우트·미들웨어 | `smoke.mjs` (실제 HTTP) |
| 화면 (`app/`, `features/*/components`) | `tests/ui-flow.manual.ts` (헤드리스 Chromium) |

## Prerequisites

Node 22 (`node v22.23.1` 로 검증). 그 외 OS 패키지 불필요 — 데스크톱 GUI 가 아니라 헤드리스 브라우저다.

```bash
npm ci
npx playwright install chromium     # 최초 1회. 브라우저는 사용자 전역 캐시(~150MB)
```

`.env.local` 이 있으면 주소검색·건축HUB·Supabase·Gemini 를 실제로 친다. 키 없이도 전체 플로우가
돌아가야 한다는 것이 프로젝트 절대 규칙 8 이다 (키 없음 → fixture / 템플릿 리포트 / 저장 생략).

## 1. 판정 로직 — 직접 호출 (서버 불필요, 가장 빠름)

가장 많이 쓰게 될 경로다. 순수 함수와 route handler 를 in-process 로 부른다.

```bash
npx tsx --tsconfig tsconfig.json tests/sufficiency.manual.ts   # F04 자료 충분성 → "24/24 통과"
npx tsx --tsconfig tsconfig.json tests/f10-f11.manual.ts       # F10 액션 + /api/report → "전체 통과"
npx tsx --tsconfig tsconfig.json tests/mapper.manual.ts        # 건축HUB 매핑
```

앞의 둘은 `[ OK ]` / `[FAIL]` 을 찍고 실패 시 exit 1 이다. **`mapper.manual.ts` 는 자기검증을 하지
않는다** — 매핑 결과를 표로 출력만 하고 항상 exit 0 이므로, 눈으로 읽어야 한다.

## 2. dev 서버

```bash
npm run dev &
timeout 90 bash -c 'until curl -sf http://localhost:3000 >/dev/null 2>&1; do sleep 1; done'
```

**중지는 반드시 PowerShell 로.** Git Bash 의 `lsof -ti:3000 | xargs kill` 은 이 환경에서
프로세스를 죽이지 못한다(실행해도 포트가 계속 LISTEN 상태로 남는다):

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force }
```

## 3. API 스모크 — 실제 HTTP

`tests/*.manual.ts` 는 route handler 를 import 해서 부르므로 Next 라우팅·middleware·직렬화를
건너뛴다. 소켓 너머를 확인하려면:

```bash
node .claude/skills/run-kb-hug-jeonse-check/smoke.mjs
```

인증 없이 돈다. 실제 출력:

```
[ OK ] GET /                                 200
[ OK ] GET /api/rules                        21개 · SUPABASE_SNAPSHOT · crawled-hug-144bcd14399b
[ OK ] POST /api/check                       blockedAt=NONE · 항목 22개 · SUPABASE_SNAPSHOT
[ OK ] 규칙팩 2층 실행                             SUFFICIENCY, PRODUCT, GUARANTEE
[ OK ] F10 actionPlan 동봉                     5건 · 보류=false
[ OK ] POST /api/report 동의 없음                400 CONSENT_REQUIRED
[ OK ] POST /api/report 형식 오류                400 INVALID_BODY
[ OK ] POST /api/report 동의함                  3201자 · llm=false
[ OK ] 보고서 구성                                판정에 사용한 입력값과 출처 / 다음 행동
[ OK ] GET /api/cases 비로그인 차단                401
```

## 4. UI — 헤드리스 Chromium

`chromium-cli` 는 이 환경에 없다. Playwright(devDependency)로 몬다.

```bash
UI_TEST_EMAIL=<계정> UI_TEST_PASSWORD=<비번> \
  npx tsx --tsconfig tsconfig.json tests/ui-flow.manual.ts
```

dev 서버가 떠 있어야 한다. **계정이 필요하다** — 판정 실행이 로그인 필수고, 회원가입은 이메일
인증이 걸려 자동화되지 않는다. 계정은 코드·문서에 적지 말고 환경변수로만 넘겨라.

로그인 → 1~3단계 입력(주소검색·건축HUB 실호출) → 판정 → F10 패널 → 동의 게이트 → 보고서 →
이력 상세까지 몰고 가며 10개 항목을 검사한다. 스크린샷은 `tests/.ui-shots/` (gitignore).

**스크린샷을 실제로 열어봐라.** 빈 화면이면 통과 로그와 무관하게 실패다.

새 화면을 검증하려면 이 파일에 단계를 추가해라 — 별도 드라이버를 만들지 말 것.

## 5. 배포 전 체크

```bash
npm run lint && npm run typecheck && npm run build
```

`tsconfig.json` 의 `include` 가 `**/*.ts` 라 `tests/` 도 타입체크·빌드 대상이다. 테스트 파일의
타입 오류가 `npm run build` 를 깨뜨린다.

## Gotchas

- **주소 `월드컵로 240` 으로 UI 를 돌리면 결과가 "자료 부족"으로 나온다. 정상이다.** 건축HUB 가
  부속건축물만 돌려줘서 `propertyType`·`isMultiFamily` 가 안 채워지고 F04 가 진단을 보류한다.
  버그가 아니라 설계된 동작이다. 규칙팩 2층까지 실행되는 모습을 보려면 `smoke.mjs` 를 써라
  (fixture 로 매물 정보를 직접 채운다).
- **로그인 완료를 URL 로 기다리면 안 된다.** `page.waitForURL(/diagnosis/)` 는
  `/login?next=/diagnosis` 에 이미 매칭돼 즉시 통과하고, 세션 쿠키가 써지기 전에 다음 단계로
  넘어가 로그인 게이트에 다시 막힌다. 헤더의 `로그아웃` 이 뜨는 것을 기다려라.
- **F04 는 '오늘' 에 의존한다.** 픽스처의 `moveInDate` 는 미래여야 하고 등기부 `issuedDate` 는
  30일 이내여야 한다. 날짜를 하드코딩하면 시간이 지나 테스트가 썩는다 — `smoke.mjs` 는 상대
  날짜로 만들고, `tests/*.manual.ts` 는 `validateDiagnosticSufficiency(diag, { today })` 로 고정한다.
- **`/api/check` 는 비로그인도 200 이다.** 판정을 돌려주고 저장(`caseId`)만 생략한다. 로그인
  요구는 화면 쪽 정책이다. 그래서 `smoke.mjs` 가 인증 없이 돈다.
- **규칙팩이 Supabase 스냅샷에서 온다** (`SUPABASE_SNAPSHOT`). 판정 결과는 `src/rules/*.json`
  만 보고 예측할 수 없다. 응답의 `ruleSource` 와 `ruleVersion` 을 항상 같이 봐라 — DB 가 죽으면
  `FALLBACK_JSON` 으로 바뀌면서 결과가 달라질 수 있다.
- **보고서의 `llm:false` 는 실패가 아니다.** Gemini 실패·미설정이면 결정론적 템플릿으로 폴백한다.
  현재 API 키 프로젝트가 `generateContent` 에서 403 Forbidden 이라 항상 템플릿이 나온다.
  `llm:true` 를 보려면 키 문제부터 풀어야 한다.
- **콘솔의 `_rsc` `ERR_ABORTED` 는 무시해도 된다.** Next 의 RSC prefetch 가 취소된 것으로,
  `page.on('console')` 의 error 로는 잡히지 않는다(`requestfailed` 로만 보인다).

## Troubleshooting

| 증상 | 원인 / 조치 |
|---|---|
| `Cannot find package 'playwright'` | 스크립트를 레포 밖에 뒀다. ESM 은 importing module 기준으로 해석한다 — 레포 안에 두거나 절대경로 `file:///…/node_modules/playwright/index.mjs` 로 import |
| `npm run dev` 가 `EADDRINUSE` | 이전 서버가 안 죽었다. 위 PowerShell `Get-NetTCPConnection` 블록으로 죽여라 |
| UI 테스트가 `로그인 게이트에 막힘` | 세션이 안 붙었다. 계정·비번 확인, 그리고 로그인 대기 조건이 URL 이 아닌 `로그아웃` 인지 확인 |
| `npm ci` 후 Playwright 가 사라짐 | 예전엔 `extraneous` 였다. 지금은 devDependency 라 괜찮지만, 브라우저 바이너리는 별도다 — `npx playwright install chromium` |
| 첫 `nav` 가 10초+ | Next 가 라우트를 on-demand 컴파일한다. `sleep` 말고 `waitForSelector` 로 기다려라 |
