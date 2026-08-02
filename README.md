# KB 전세 코파일럿

계약금 지급 전 신청인, 예정 계약, 매물, 등기부 정보를 공개 요건과 대조해
**KB스타 전세자금대출(HUG) 상품요건과 HUG 보증요건 중 어디에서 확인이 필요한지** 보여주는 사전점검 서비스입니다.

현재 MVP가 실제로 판정하고 화면에 노출하는 경로는 `KB_STAR_HUG` 하나입니다. HF, SGI, 청년 HF용 타입과 정적 규칙팩은 이후 확장을 위해 저장소에 남아 있지만 현재 판정에는 사용하지 않습니다.

판정은 `src/lib/rule-engine/`의 순수 함수가 수행합니다. Gemini는 사용자가 동의한 경우 상담용 요약 문장을 다듬는 데만 사용하며, 판정이나 수치를 만들지 않습니다.

> `확인된 충돌 없음(NO_PUBLIC_CONFLICT_FOUND)`은 대출 승인이나 보증 가능을 의미하지 않습니다.

## 주요 기능

- 신청인 정보, 예정 계약, 주소·건축물대장, 등기부 확인의 4단계 진단
- 도로명주소 검색 후 건축HUB 표제부 조회 및 주택 유형 매핑
- PDF/JPG/PNG 등기사항전부증명서 OCR 초안 추출과 사용자 확인
- 판정 전 자료 충분성·상충 검사(F04)
- KB 상품요건과 HUG 보증요건의 결정론적 판정 및 공식 근거 표시
- 판정 결과 기반 다음 행동 목록과 상담용 1페이지 요약
- Supabase 이메일 인증, 로그인 사용자 진단 저장·조회·삭제
- 활성 규칙 스냅샷 우선 적용과 최초 부트스트랩 크롤링

## 기술 스택

- Next.js 14 App Router, React 18, TypeScript 5
- Tailwind CSS 3
- Supabase Auth/Postgres/RLS
- NAVER CLOVA General OCR
- Google Gemini(선택 사항)
- Playwright(수동 UI 흐름 검사)

## 빠른 시작

Node.js 22가 필요합니다. `.nvmrc`와 `package.json#engines`도 `22.x`로 고정되어 있습니다.

```bash
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

Windows PowerShell에서는 환경 파일을 다음처럼 복사할 수 있습니다.

```powershell
Copy-Item .env.example .env.local
```

개발 서버는 기본적으로 `http://localhost:3000`에서 실행됩니다.

```bash
npm run typecheck
npm run lint
npm run build
```

`tailwind.config.ts`나 `next.config.mjs`를 수정했다면 개발 서버를 재시작해야 합니다.

## 환경변수

| 변수                                   | 용도                          | 없을 때 동작                       |
| -------------------------------------- | ----------------------------- | ---------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase 프로젝트 URL         | 인증·저장·규칙 스냅샷 기능 비활성  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 브라우저/서버 인증 클라이언트 | 인증·진단 이력 기능 비활성         |
| `SUPABASE_SERVICE_ROLE_KEY`            | 서버의 규칙 스냅샷 조회·저장  | 정적 HUG 규칙 JSON으로 폴백        |
| `JUSO_API_KEY`                         | 도로명주소 검색               | 저장된 주소 픽스처 반환            |
| `BUILDING_API_KEY`                     | 건축HUB 표제부 조회           | 저장된 건축물 픽스처 반환          |
| `NAVER_CLOVA_OCR_INVOKE_URL`           | CLOVA OCR 엔드포인트          | OCR API가 `503` 반환               |
| `NAVER_CLOVA_OCR_SECRET`               | CLOVA OCR 인증                | OCR API가 `503` 반환               |
| `OCR_RATE_LIMIT_PER_IP_PER_HOUR`       | IP별 시간당 OCR 제한          | 기본값 `5`                         |
| `OCR_RATE_LIMIT_DAILY_TOTAL`           | 프로세스별 일일 OCR 제한      | 기본값 `30`                        |
| `GEMINI_API_KEY`                       | 상담용 요약 문장 정리         | 결정론적 템플릿 보고서 반환        |
| `USE_FIXTURES=1`                       | 주소·건축물 API 픽스처 강제   | 설정하지 않으면 API 키 유무로 결정 |

`JUSO_API_KEY` 또는 `BUILDING_API_KEY` 없이 조회하면 검색어와 무관한 고정 샘플이 반환됩니다. UI와 판정 로직 개발에는 쓸 수 있지만 실제 매물 검증이나 QA에는 반드시 실 API 키를 사용해야 합니다. API 응답의 `fixtures` 값으로 픽스처 사용 여부를 확인할 수 있습니다.

`.env.local`은 커밋하지 않습니다.

## 판정 흐름

1. `/api/address`와 `/api/building`이 주소와 건축물 정보를 구성합니다.
2. 등기부는 직접 입력하거나 `/api/ocr`이 만든 초안을 사용자가 확인·수정합니다. 원본 파일과 OCR 원문은 저장하지 않습니다.
3. `/api/check`가 먼저 진단자료 충분성 검사를 수행합니다.
4. 자료가 부족하거나 서로 맞지 않으면 상품·보증 판정을 실행하지 않고 `INSUFFICIENT`를 반환합니다.
5. 자료가 충분하면 활성 HUG 규칙팩으로 `KB_STAR_HUG` 경로를 판정합니다.
6. 로그인 사용자의 입력과 결과만 `diagnosis_cases`에 저장합니다.
7. 다음 행동은 결과에서 순수 계산하며, 상담 요약은 명시적 동의 후에만 생성합니다.

응답은 과거 다중 경로 형식과의 호환을 위해 `pathResults` 배열을 유지하지만 현재 원소는 HUG 경로 하나입니다.

### 규칙팩 선택 순서

1. Supabase의 활성 스냅샷: `SUPABASE_SNAPSHOT`
2. DB 조회는 성공했지만 활성 행이 없는 최초 실행에서 KB/HUG 공식 페이지 크롤링: `CRAWLED`
3. DB 오류 또는 크롤링 실패 시 `src/rules/kb-hug.json` + `src/rules/hug-guarantee.json`: `FALLBACK_JSON`

성공적으로 크롤링한 규칙은 `save_rule_snapshot` RPC로 원자적으로 활성화합니다. 이전 스냅샷은 감사 이력으로 남고 최신 한 건만 `active=true`가 됩니다. 자료 충분성 단계에서 판정을 중단한 요청은 외부 크롤링을 실행하지 않습니다.

## API

| 메서드·경로             | 요청                                         | 주요 응답/동작                                                  |
| ----------------------- | -------------------------------------------- | --------------------------------------------------------------- |
| `POST /api/address`     | `{ address }`                                | `{ candidates, notes, fixtures }`                               |
| `POST /api/building`    | `{ juso }`                                   | `{ property, lot, housing, notes, fixtures }`                   |
| `POST /api/ocr`         | `multipart/form-data`의 `file`               | `{ draft }`, 최대 10MB PDF/JPG/PNG                              |
| `POST /api/check`       | `CheckRequest` (`DiagnosisCase`)             | `{ pathResults, ruleVersion, ruleSource, actionPlan, caseId? }` |
| `POST /api/report`      | `{ pathResults, diagnosis?, consent: true }` | `{ report, llm }`; 동의 필수                                    |
| `GET /api/rules`        | 없음                                         | 현재 HUG 규칙팩과 크롤링 검증 정보                              |
| `GET /api/cases`        | 로그인 세션                                  | 로그인 사용자의 진단 이력                                       |
| `GET /api/cases/:id`    | 로그인 세션                                  | 본인 진단 상세                                                  |
| `DELETE /api/cases/:id` | 로그인 세션                                  | 본인 진단 삭제                                                  |

인증 확인과 데이터 소유권은 서버와 Supabase RLS에서 함께 검사합니다. `/auth/confirm`과 `/auth/signout`은 이메일 인증 완료 및 로그아웃 흐름에 사용됩니다.

## 프로젝트 구조

```text
src/app/                 페이지, 인증 콜백, Route Handlers
src/features/intake/     입력 스키마·매핑·폼 필드
src/features/building/   주소/건축물 매핑과 개발용 픽스처
src/features/registry/   등기부 OCR 파싱과 사용자 확인 UI
src/features/result/     결과 정규화·표시·다음 행동·보고서 포맷
src/lib/rule-engine/     자료 충분성 검사와 결정론적 규칙 엔진
src/lib/crawlers/        공식 페이지 크롤러와 규칙 스냅샷 공급자
src/lib/supabase/        서버/브라우저 Supabase 클라이언트
src/lib/gemini/          선택적 상담 요약 클라이언트
src/rules/               정적 규칙팩 JSON
src/types/               도메인·규칙·API 타입
supabase/                전체 스키마와 증분 마이그레이션
tests/                   TypeScript/Playwright 수동 검사 스크립트
```

세부 코드 규칙과 규칙 추가 절차는 [CLAUDE.md](CLAUDE.md), 영역별 구현 메모는 [TEAM_GUIDE.md](TEAM_GUIDE.md)를 참고하세요. 두 문서의 진행 상태 표보다 실행 코드와 이 README의 현재 범위를 우선합니다.

## Supabase 설정

새 프로젝트는 SQL Editor에서 `supabase/schema.sql`을 실행한 뒤 URL, publishable key, service role key를 `.env.local`에 설정합니다. 기존 프로젝트는 `supabase/migrations/`의 변경을 순서대로 적용합니다.

- `diagnosis_cases`: RLS로 로그인 사용자가 본인 행만 조회·삭제
- `rule_snapshots`: 공개 클라이언트에서 차단하고 서버의 service role만 조회·저장
- 상담용 보고서 텍스트, 업로드한 등기부 원본, OCR 원문은 저장하지 않음

## 수동 검사

수동 TypeScript 검사는 `tsx`로 실행합니다(`tsx`는 현재 devDependency가 아니므로 필요 시 별도 준비).

```bash
npx tsx --tsconfig tsconfig.json tests/mapper.manual.ts
npx tsx --tsconfig tsconfig.json tests/sufficiency.manual.ts
npx tsx --tsconfig tsconfig.json tests/f10-f11.manual.ts
```

UI 흐름 검사는 개발 서버와 테스트용 Supabase 계정이 필요합니다.

```bash
npx playwright install chromium
UI_TEST_EMAIL=... UI_TEST_PASSWORD=... npx tsx --tsconfig tsconfig.json tests/ui-flow.manual.ts
```

PowerShell에서는 환경변수를 `$env:UI_TEST_EMAIL`, `$env:UI_TEST_PASSWORD`로 설정합니다.

## Vercel 배포

Vercel에서 저장소를 Next.js 프로젝트로 가져오고 위 환경변수를 등록합니다. `NEXT_PUBLIC_` 변수는 빌드 시 포함되므로 변경 후 재배포해야 합니다.

- 운영 환경에는 `USE_FIXTURES`를 설정하지 않습니다.
- 주소·공공데이터 API 키의 도메인/IP 제한에 배포 도메인이 허용되어야 합니다.
- OCR과 규칙 조회 라우트는 외부 호출 때문에 최대 실행 시간이 60초로 설정되어 있습니다.
- `main` 배포와 PR 프리뷰 정책은 연결한 Vercel 프로젝트 설정을 따릅니다.

저장소: https://github.com/HyejunKoo/kb-hug-jeonse-check
