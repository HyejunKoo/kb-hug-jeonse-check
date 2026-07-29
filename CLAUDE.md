# CLAUDE.md — KB 전세 코파일럿 (이 파일의 규칙을 항상 지켜라)

## 프로젝트가 뭔지

청년이 전세 계약금을 지급하기 **전에**, 본인 조건 + 매물 조건을
**[1층] KB스타 HUG 상품요건 × [2층] HUG 보증요건** 에 대조해서
어느 경로의 어느 층에서 왜 막히는지 근거와 함께 보여주는 사전점검 서비스.

핵심 철학: **예측하지 않는다. 공개요건과 입력값을 결정론적으로 대조만 한다.**

- 같은 입력 + 같은 규칙팩 버전 → 항상 같은 결과
- 모든 판정에 근거(usedValues)·출처 URL·기준일이 붙는다
- `확인된 충돌 없음(NO_PUBLIC_CONFLICT_FOUND)` ≠ 승인. UI/문구에서 절대 승인 가능성처럼 표현 금지

## 기술 스택 (고정 — 바꾸지 마라)

- Next.js 14 App Router + TypeScript (Next 15 업그레이드 금지)
- Tailwind CSS. UI 라이브러리 추가 금지 (shadcn은 팀 합의 시에만)
- 백엔드: `app/api/*/route.ts` Route Handler로만. 별도 서버·Express 금지
- DB: Supabase(Postgres), `@supabase/supabase-js`. 접근은 `lib/supabase.ts`의 `getSupabase()`로만
- LLM: Google Gemini (`@google/generative-ai`). 호출은 `app/api/report/route.ts` 안에서만
- 배포: Vercel. 도커·AWS 금지. 각 route에 `export const maxDuration` 유지

## 폴더 구조 (이 구조를 유지하라. 새 최상위 폴더 만들지 마라)

```
src/app/page.tsx                  랜딩
src/app/diagnosis/page.tsx        진단 플로우 4단계 (결과 인라인 표시)
src/app/diagnosis/result/         저장된 진단 이력 목록·상세 (2번, 로그인 필요)
src/app/login/                    Supabase Auth 이메일 매직링크/OTP 로그인 (2번)
src/app/auth/confirm, /auth/signout  Auth 콜백·로그아웃 라우트 (2번)
src/app/api/check/route.ts        판정 실행 + 저장 (후속 에이전트)
src/app/api/building/route.ts     건축HUB 조회 — TODO 실제 호출 (1번)
src/app/api/ocr/route.ts          등기부 추출 — 현재 샘플 (2번)
src/app/api/rules/route.ts        적용 중 규칙팩 조회 (3번, 검수용)
src/app/api/report/route.ts       상담 리포트 (후속 에이전트)
src/features/intake/              F01 입력 schema·mapper·components (1번)
src/features/building/            건축HUB client·mapper (1번)
src/features/registry/            등기부 parser·확인 UI (2번)
src/features/result/              formatter·ResultCard (후속 에이전트)
src/lib/rule-engine/              index=엔진, evaluator=체크 함수 (3번), sufficiency=F04 자료 충분성 검사
src/lib/crawlers/                 KB·HUG 검증형 크롤러 + HTTP·DB 우선 provider(3번)
src/lib/supabase/                 server(getSupabaseAdmin=service_role, getServerSupabase=요청자 세션)·client(브라우저 anon)
src/middleware.ts                 Supabase 세션 쿠키 갱신
src/lib/gemini/client.ts          Gemini 초기화
src/types/                        case·rule·api + index 배럴. `@/types`로 import
src/rules/*.json                  KB스타 HUG 상품·HUG 보증 규칙팩 폴백
supabase/schema.sql               DB 스키마
```

담당별 수정 범위 (다른 사람 영역을 건드릴 땐 반드시 확인받아라):

- 1번(세팅·F01·F02): features/intake, features/building, app/api/building, 루트 설정
- 2번(OCR·로그인): features/registry, app/api/ocr, lib/supabase, app/login
- 3번(KB·HUG): lib/crawlers, lib/rule-engine, src/rules, app/api/rules
- 후속 에이전트: features/result, app/api/check, app/api/report

## 절대 규칙 (위반 금지)

1. **판정은 `src/lib/rule-engine/` 순수 함수만 한다.** Gemini/LLM에게 판정·수치 생성 절대 금지
2. Gemini는 `lib/gemini/client.ts` 를 통해 `report/route.ts` 안에서만 문장 다듬기만. 템플릿에 없는 판정·수치·확률·승인 가능성 언급을 추가하면 안 됨. Gemini 실패 시 템플릿으로 폴백하는 현재 구조 유지
3. API 키는 `process.env` 로만. 하드코딩 금지. `.env*` 는 `.gitignore` 유지
4. Gemini 호출·DB 접근은 `app/api/` 서버 코드 안에서만. 클라이언트 컴포넌트에서 직접 금지
5. 타입은 `src/types/` 에 정의된 것만 사용(`@/types` 배럴로 import). 새 타입은 case/rule/api 중 맞는 파일에 추가
6. 데모는 샘플 데이터만. 실명·주민번호 등 실제 개인정보 수집·저장 금지
7. 규칙 추가/수정 시: 해당 상품/기관 JSON에 규칙 추가 + `rule-engine/evaluator.ts` CHECKERS에 함수 추가. 수치(params)를 임의로 지어내지 말고, 모르면 주석으로 "검수 필요" 표시하고 나에게 물어라
8. env 키가 하나도 없어도 전체 플로우가 돌아가야 한다 (키 없음 → 자료 부족 판정 / 템플릿 리포트 / DB 저장 생략). 이 폴백을 깨는 변경 금지
9. 파괴적 작업(파일 대량 삭제, 의존성 메이저 업그레이드, force push) 전에 반드시 나에게 확인

## 핵심 타입 (src/types/ 요약 — 실제 정의는 파일 참조. import는 `@/types` 배럴로)

- `SourceCode`: USER_DECLARED | USER_CONFIRMED_DOCUMENT | PUBLIC_API | INTERNAL_REQUIRED
- `Verdict`: PUBLIC_REQUIREMENT_UNMET(공개요건 미충족) | NO_PUBLIC_CONFLICT_FOUND(확인된 충돌 없음) | MISSING_INFORMATION(자료 부족) | POST_CONTRACT_REQUIREMENT(계약 후 충족) | OFFICIAL_REVIEW_REQUIRED(공식 심사 필요)
- `DiagnosisCase` = { applicant, contract, property, registry? }
- **판정에 들어가는 값은 예외 없이 `Field<T> = { value, source }` 다.** 화면 입력은 raw 타입
  (`ApplicantInput`·`PlannedContractInput`)으로 다루고, 출처를 붙이는 곳은 `features/intake/mapper.ts`
  의 `toDiagnosisCase()` 한 군데뿐이다. 화면 여기저기서 source를 지어내면 F04 검사가 무의미해진다
- **항목마다 허용되는 출처가 정해져 있다** (F04가 강제). 다른 출처로 오면 자료 부족 처리된다:
  신청인·계약 = `USER_DECLARED` / 주소·지역·주택유형·다가구 = `PUBLIC_API` /
  위반건축물·등기부 전 항목 = `USER_CONFIRMED_DOCUMENT`. `INTERNAL_REQUIRED`는 어디에도 허용되지 않는다
  (확보된 값이 아니라 "기관 내부정보가 필요하다"는 표시이므로)
- `Rule` = { ruleId, layer, checkId, params?, sourceUrl, effectiveFrom }. `RuleLayer`는 SUFFICIENCY|PRODUCT|GUARANTEE 지만 **SUFFICIENCY는 규칙팩에 넣지 마라** — F04가 자체 생성하는 층이다
- `RuleSource`: CRAWLED | SUPABASE_SNAPSHOT | FALLBACK_JSON
- `PathResult` = { blockedAt: 'NONE'|'PRODUCT'|'GUARANTEE'|'INSUFFICIENT'|'ACTION_REQUIRED', results: CheckResult[], officialReviewCount }

## API 계약 (프론트-백 이 형태 유지)

- `POST /api/check`  body: DiagnosisCase → `{ pathResults, ruleVersion, ruleSource, caseId? }` (MVP에서는 HUG 한 경로, caseId는 로그인 사용자만)
  - 내부 순서: **F04 충분성 검사 → (통과했을 때만) 규칙팩 실행**. 자료가 부족·상충하면 `runRulePack()`도
    `getRulePack()`도 호출하지 않고(= 크롤링 비용 없음) SUFFICIENCY 층 결과만 담긴
    `blockedAt: 'INSUFFICIENT'`를 돌려준다. 이때 `ruleVersion`은 적용된 규칙이 없다는 뜻으로
    `getFallbackRuleVersion()`의 로컬 기준값을 기록한다
- `GET /api/cases` (로그인 필수) → `{ cases: CaseSummary[] }` 본인 이력만
- `GET /api/cases/[id]` (로그인 필수) → `CaseDetailResponse` 본인 진단 1건
- `DELETE /api/cases/[id]` (로그인 필수) → `{ ok: true }` 본인 진단 1건 삭제
- `GET /api/rules` → 현재 적용 규칙팩 (version·source·rules[]·crawl)
- `POST /api/building` body: `{ address }` → `{ property: Property, ... }`
- `POST /api/ocr` (추후 FormData PDF) → `{ registry: RegistryInfo }` — 추출값은 고객 확인 후에만 판정에 사용
- `POST /api/report` body: `{ pathResults }` → `{ report: string, llm: boolean }`

## 규칙팩 공급 흐름 (회의록 합의)

Supabase 활성 스냅샷 조회 → 없을 때만 KB·HUG 두 공시 크롤링 후 DB 저장 → DB 오류·크롤링 실패 시 HUG JSON 폴백.

- 크롤러는 `{ rules, reports }`를 반환하고 실패를 throw로 전파해 판정을 막지 마라
- `reports`에는 상태·문자셋·바이트·필수문구 evidence·본문 SHA-256을 남긴다
- 응답의 `ruleSource`(CRAWLED/SUPABASE_SNAPSHOT/FALLBACK_JSON)를 없애지 마라 — 결과 신뢰도 표시에 사용
- GET /api/rules 로 현재 적용 규칙팩 확인 가능 (검수용)

## 도메인 주의사항

- 소득은 **한도 계산이 아니라 상한 O/X 판정용**. 구간 선택 + '모름'(→ 자료 부족)
- 주택 유형은 자기신고 경로를 만들지 마라. 건축HUB 조회 실패 시 유형 의존 규칙은 전부 자료 부족
- KB 상품 규정과 HUG/HF/SGI 보증 규정은 다르다. 두 층 또는 기관별 결과를 합쳐서 하나로 판정하지 마라
- 선순위채권 비율은 공식 시세가 필요해 계약 전 판단 불가 → OFFICIAL_REVIEW_REQUIRED 처리 유지
- 순위·유불리·추천 점수를 만들지 마라. 판정만 나열한다

## 현재 상태 / TODO

- [완료-2번] Supabase Auth 이메일+비밀번호 로그인(가입 시 1회만 이메일 인증), `/diagnosis/result`(+`[id]`)
  이력 조회·삭제, `diagnosis_cases`에 `user_id`+RLS 추가.
  **정책 변경**: 입력(1~3단계)은 비로그인도 가능하지만 "사전점검 실행"(판정)은 로그인 필수로 바뀜.
  비로그인 상태로 실행하면 입력값을 `sessionStorage`에 보관한 채 로그인/회원가입 팝업을 띄우고,
  로그인 완료 후 `/diagnosis`로 돌아오면 재입력 없이 그 값으로 자동 판정한다 (`src/app/diagnosis/page.tsx`).
- [완료] 빌드 통과, /api/check 판정 동작 검증됨, GitHub 원격 연결(HyejunKoo/kb-hug-jeonse-check)
- [완료-1번] `app/api/address` + `app/api/building` + `features/building/mapper.ts`: 주소검색→행정코드→건축HUB 표제부 실연동. 위반건축물은 공개 API 미제공이라 영구 자료 부족 처리
- [완료] UI 개편: 디자인 토큰(`kb-*` 팔레트)·스테퍼·결과 카드. `tailwind.config.ts` 수정 시 dev 서버 재시작 필요
- [TODO-2번] `app/api/ocr/route.ts` + `features/registry/parser.ts`: PDF 업로드 받아 소유자·근저당액·권리침해 추출 + 화면에 고객 확인·수정 단계 추가 (F03, F04)
- [완료-3번] F05/F06 KB스타 HUG 상품·보증 규칙팩, KB·HUG 공식 페이지 2개 검증형 크롤러, Supabase 활성 스냅샷 우선 조회와 JSON 폴백.
- [완료] F04 자료 충분성 검사 (`lib/rule-engine/sufficiency.ts`). 필수값·출처·enum/숫자/날짜 형식,
  등기부 소재지와 매물 주소 일치, **발급일 30일 이내**를 검사하고 하나라도 걸리면 규칙팩을 실행하지 않는다.
  결과 화면은 `진단자료 충분성 → 1층 KB 상품요건 → 2층 HUG 보증요건` 순으로 표시한다.
  - 위반건축물 표시는 여전히 공개 API에 없다. 이제 3단계에 확인 UI가 있고, 고르지 않으면 F04가 진단을 보류한다
    (= '영구 자료 부족'에서 '사용자가 확인하면 판정 가능'으로 바뀜)
  - 테스트: `npx tsx --tsconfig tsconfig.json tests/sufficiency.manual.ts` (24케이스)
  - 발급일 검사는 '오늘'에 의존해 완전한 결정론이 아니다. 재현이 필요하면 `validateDiagnosticSufficiency(diag, { today })`로 고정하라

## 작업 방식

- 작업 전 관련 파일을 먼저 읽고 시작해라
- 변경 후 `npm run build` 로 타입·빌드 확인해라
- 커밋 메시지는 한국어로 간결하게 (`feat: 건축HUB 표제부 조회 연동` 식)
- 내가 요구하지 않은 리팩토링·파일 이동·의존성 추가를 하지 마라
