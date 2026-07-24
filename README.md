# KB 전세 코파일럿 (MVP · HUG 경로)

계약금 지급 전, 신청인·계약·매물 조건을 **KB 상품요건(1층) × HUG 보증요건(2층)** 에 대조해
**어느 층에서 왜 막히는지** 근거와 함께 보여주는 사전점검 서비스.

예측하지 않는다. 공개요건과 입력값을 결정론적으로 대조만 한다.
판정은 `src/lib/rule-engine/` 순수 함수만 수행하고, Gemini는 상담 요약 문장을 다듬는 역할만 한다.

> `확인된 충돌 없음(NO_PUBLIC_CONFLICT_FOUND)` 은 승인·보증 가능을 의미하지 않는다.

## 빠른 시작

**Node 22 필요** (`.nvmrc` 있음 — nvm 쓰면 `nvm use`). 다른 버전이면 `npm ci`가 `EBADENGINE`으로 실패한다.

```bash
nvm use                      # 또는 node -v 로 v22.x 확인
npm ci                       # install 말고 ci (lock 그대로 설치)
cp .env.example .env.local   # 키는 노션에서 복사 — 아래 참고
npm run dev                  # http://localhost:3000
```

**실제 조회를 하려면 키가 필요하다.** 키가 없어도 앱이 죽지는 않지만, 공공 API 호출이
저장해둔 샘플 응답(픽스처)으로 대체된다 — 뭘 검색하든 같은 결과가 나온다.

| 없는 키 | 실제로 벌어지는 일 |
|---|---|
| `JUSO_API_KEY` | 주소 검색이 **항상** `서울 서초구 강남대로12길 11 (양재동)` 1건만 반환. 검색어와 무관 |
| `BUILDING_API_KEY` | 건축물대장이 **항상** 같은 샘플 건물로 반환 |
| `GEMINI_API_KEY` | 결정론적 템플릿 리포트로 폴백 (품질만 다름, 내용은 정상) — **현재 상태** |
| Supabase 키 | 저장만 생략, 판정은 정상 반환 |

앞의 두 개는 **결과가 틀린다.** 화면에 픽스처라는 표시가 나오지 않으니 주의.
UI·판정 로직만 건드리는 작업이면 키 없이 개발해도 되지만, 데모·QA 전에는 반드시 넣을 것.

**키는 노션에 정리해뒀다. 각자 발급받지 말고 거기서 복사해 `.env.local`에 붙여넣으면 된다.**

`GEMINI_API_KEY`는 **아직 미발급**이다. 없어도 동작에 문제 없고, 상담 요약이 템플릿으로 생성된다.
발급되면 노션에 추가된다.

`.env.local`은 절대 커밋 금지 (`.gitignore`에 있음).

```bash
npm run typecheck   # 커밋 전 (빌드보다 빠름)
npm run build       # 배포 전 최종 확인
```

`tailwind.config.ts` · `next.config.mjs` 를 수정했다면 dev 서버를 재시작해야 반영된다.

## 구조

```
src/app/         화면(랜딩·진단 4단계) + api/ 라우트 6개
src/features/    intake(F01) · building(F02) · registry(F03) · result
src/lib/         rule-engine · crawlers · supabase · gemini
src/types/       case · rule · api — 전원 `@/types` 배럴로 import
src/rules/       규칙팩 JSON (폴백)
supabase/        DB 스키마
```

폴더별 담당·규칙 추가법·API 실호출 주의사항은 **[TEAM_GUIDE.md](TEAM_GUIDE.md)** 참조.
코딩 규칙(고정 스택·절대 규칙)은 **[CLAUDE.md](CLAUDE.md)** 참조.

## API 계약

| 라우트 | body → 응답 |
|---|---|
| `POST /api/address` | `{ address }` → `{ candidates: JusoItem[], notes }` |
| `POST /api/building` | `{ juso }` → `{ property, housing, notes }` |
| `POST /api/check` | `DiagnosisCase` → `{ pathResult, ruleVersion, ruleSource }` |
| `POST /api/ocr` | (추후 FormData PDF) → `{ registry }` |
| `POST /api/report` | `{ pathResult }` → `{ report, llm }` |
| `GET /api/rules` | 현재 적용 중인 규칙팩 (검수용) |

## Vercel 배포

저장소: https://github.com/HyejunKoo/kb-hug-jeonse-check

1. vercel.com → Add New Project → repo import (Next.js 자동 감지, `vercel.json` 불필요)
2. Settings → Environment Variables 에 아래 입력

   | 키 | 필수 |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | 저장 쓸 때 |
   | `SUPABASE_SERVICE_ROLE_KEY` | 저장 쓸 때 |
   | `JUSO_API_KEY` | 주소 검색 |
   | `BUILDING_API_KEY` | 건축물대장 조회 |
   | `GEMINI_API_KEY` | 미발급 — 넣지 않아도 됨 (템플릿 리포트로 동작) |

3. `main` push = 자동 배포, PR 브랜치 = 프리뷰 URL (QA 링크로 사용)

**주의**

- `USE_FIXTURES` 는 Vercel에 넣지 말 것. 값이 있으면 어떤 주소를 검색해도 고정 샘플이 나온다
- `NEXT_PUBLIC_` 키는 빌드 타임에 인라인된다. env 추가 후 **재배포** 필요
- 공공 API 키에 **IP·도메인 제한**이 걸려 있으면 Vercel에서 실패한다.
  juso.go.kr 승인키에 배포 도메인을 등록하고, data.go.kr 활용신청의 IP 제한 여부를 확인할 것
- 각 route에 `export const maxDuration` 설정됨 (Hobby 플랜 기본 10초 타임아웃 대비)

## Supabase 세팅

1. supabase.com 프로젝트 생성
2. SQL Editor에 `supabase/schema.sql` 실행
3. Project Settings → API 에서 URL·service_role 키 복사 → env에 입력

RLS 활성화 상태이며 서버(service_role)만 접근한다. anon 접근은 차단.

## 현재 상태

기능별 완료 현황과 남은 작업은 [TEAM_GUIDE.md §10](TEAM_GUIDE.md#10-지금-상태) 에 정리돼 있다.

가장 급한 것: **`src/rules/kb-hug.json` 의 수치가 아직 공식 원문으로 검수되지 않았다.**
화면에는 출처 URL과 기준일이 표시되므로, 발표 전 KB 상품공시·HUG 공시 대조가 반드시 필요하다.
