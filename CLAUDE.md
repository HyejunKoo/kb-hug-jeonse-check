# CLAUDE.md — KB 전세 코파일럿 (이 파일의 규칙을 항상 지켜라)

## 프로젝트가 뭔지

청년이 전세 계약금을 지급하기 **전에**, 본인 조건 + 매물 조건을
**[1층] KB스타 전세자금대출(HUG) 상품요건 × [2층] HUG 보증요건** 에 대조해서
어느 층에서 왜 막히는지 근거와 함께 보여주는 사전점검 서비스. MVP는 HUG 경로 1개만.

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
src/app/diagnosis/result/         [MVP 이후] 저장된 진단 조회
src/app/login/                    [MVP 이후] Supabase Auth (2번)
src/app/api/check/route.ts        판정 실행 + 저장 (후속 에이전트)
src/app/api/building/route.ts     건축HUB 조회 — TODO 실제 호출 (1번)
src/app/api/ocr/route.ts          등기부 추출 — 현재 샘플 (2번)
src/app/api/rules/route.ts        적용 중 규칙팩 조회 (3번, 검수용)
src/app/api/report/route.ts       상담 리포트 (후속 에이전트)
src/features/intake/              F01 입력 schema·mapper·components (1번)
src/features/building/            건축HUB client·mapper (1번)
src/features/registry/            등기부 parser·확인 UI (2번)
src/features/result/              formatter·ResultCard (후속 에이전트)
src/lib/rule-engine/              index=엔진, evaluator=체크 함수 (3번)
src/lib/crawlers/                 kb·hug 크롤러 + rule-provider(폴백·캐시) (3번)
src/lib/supabase/                 server(service_role)·client(anon, MVP이후)
src/lib/gemini/client.ts          Gemini 초기화
src/types/                        case·rule·api + index 배럴. `@/types`로 import
src/rules/kb-hug.json             규칙팩 폴백 (3번 검수)
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
7. 규칙 추가/수정 시: `rules/kb-hug.json`에 규칙 1건 추가 + `ruleEngine.ts` CHECKERS에 함수 추가. 수치(params)를 임의로 지어내지 말고, 모르면 주석으로 "검수 필요" 표시하고 나에게 물어라
8. env 키가 하나도 없어도 전체 플로우가 돌아가야 한다 (키 없음 → 자료 부족 판정 / 템플릿 리포트 / DB 저장 생략). 이 폴백을 깨는 변경 금지
9. 파괴적 작업(파일 대량 삭제, 의존성 메이저 업그레이드, force push) 전에 반드시 나에게 확인

## 핵심 타입 (src/types/ 요약 — 실제 정의는 파일 참조. import는 `@/types` 배럴로)

- `SourceCode`: USER_DECLARED | USER_CONFIRMED_DOCUMENT | PUBLIC_API | INTERNAL_REQUIRED
- `Verdict`: PUBLIC_REQUIREMENT_UNMET(공개요건 미충족) | NO_PUBLIC_CONFLICT_FOUND(확인된 충돌 없음) | MISSING_INFORMATION(자료 부족) | POST_CONTRACT_REQUIREMENT(계약 후 충족) | OFFICIAL_REVIEW_REQUIRED(공식 심사 필요)
- `DiagnosisCase` = { applicant, contract, property, registry? }
- `Rule` = { ruleId, layer: 'PRODUCT'|'GUARANTEE', checkId, params?, sourceUrl, effectiveFrom }\n- `RuleSource`: CRAWLED | FALLBACK_JSON
- `PathResult` = { blockedAt: 'NONE'|'PRODUCT'|'GUARANTEE'|'INSUFFICIENT', results: CheckResult[], officialReviewCount }

## API 계약 (프론트-백 이 형태 유지)

- `POST /api/check`  body: DiagnosisCase → `{ pathResult, ruleVersion, ruleSource }`\n- `GET /api/rules` → 현재 적용 규칙팩 (version·source·rules[])
- `POST /api/building` body: `{ address }` → `{ property: Property, ... }`
- `POST /api/ocr` (추후 FormData PDF) → `{ registry: RegistryInfo }` — 추출값은 고객 확인 후에만 판정에 사용
- `POST /api/report` body: `{ pathResult }` → `{ report: string, llm: boolean }`

## 규칙팩 공급 흐름 (회의록 합의)

크롤링 시도 → 성공 시 1시간 캐시 사용 → 실패/미구현 시 `src/rules/*.json` 폴백.
- 크롤러(kb.ts/hug.ts)는 실패 시 null 반환. throw로 판정을 막지 마라
- 응답의 `ruleSource`(CRAWLED/FALLBACK_JSON)를 없애지 마라 — 결과 신뢰도 표시에 사용
- GET /api/rules 로 현재 적용 규칙팩 확인 가능 (검수용)

## 도메인 주의사항

- 소득은 **한도 계산이 아니라 상한 O/X 판정용**. 구간 선택 + '모름'(→ 자료 부족)
- 주택 유형은 자기신고 경로를 만들지 마라. 건축HUB 조회 실패 시 유형 의존 규칙은 전부 자료 부족
- KB 상품 규정과 HUG 보증 규정은 다르다 (예: KB는 1주택 이내, HUG 보증은 무주택). 두 층을 합쳐서 하나로 판정하지 마라
- 선순위채권 비율은 공식 시세가 필요해 계약 전 판단 불가 → OFFICIAL_REVIEW_REQUIRED 처리 유지
- 순위·유불리·추천 점수를 만들지 마라. 판정만 나열한다

## 현재 상태 / TODO

- [완료] 빌드 통과, /api/check 판정 동작 검증됨, GitHub 원격 연결(HyejunKoo/kb-hug-jeonse-check)
- [완료-1번] `app/api/address` + `app/api/building` + `features/building/mapper.ts`: 주소검색→행정코드→건축HUB 표제부 실연동. 위반건축물은 공개 API 미제공이라 영구 자료 부족 처리
- [완료] UI 개편: 디자인 토큰(`kb-*` 팔레트)·스테퍼·결과 카드. `tailwind.config.ts` 수정 시 dev 서버 재시작 필요
- [TODO-2번] `app/api/ocr/route.ts` + `features/registry/parser.ts`: PDF 업로드 받아 소유자·근저당액·권리침해 추출 + 화면에 고객 확인·수정 단계 추가 (F03, F04)
- [TODO-3번] `src/rules/kb-hug.json` 검수 + `lib/crawlers/` 크롤러 구현: params·sourceUrl·effectiveFrom 을 KB 상품공시·HUG 공식 문서로 검수 (현재 수치는 골격용 예시값)
- [TODO] F04 자료 충분성 검사: check 실행 전 주소 일치·필수값·등기부 발급일 검사, 부족하면 판정 중단하고 필요한 것 안내

## 작업 방식

- 작업 전 관련 파일을 먼저 읽고 시작해라
- 변경 후 `npm run build` 로 타입·빌드 확인해라
- 커밋 메시지는 한국어로 간결하게 (`feat: 건축HUB 표제부 조회 연동` 식)
- 내가 요구하지 않은 리팩토링·파일 이동·의존성 추가를 하지 마라
