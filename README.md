# KB 전세 코파일럿 (MVP · HUG 경로)

계약금 지급 전, 신청인·매물·계약 조건을 **KB 상품요건(1층) × HUG 보증요건(2층)** 에 대조하는 사전점검 서비스.
판정은 `lib/ruleEngine.ts` 순수 함수만 수행하며, LLM(Gemini)은 상담 리포트 문장 생성만 담당한다.

## 빠른 시작

```bash
npm install
cp .env.example .env.local   # 키 채우기 (없어도 데모 모드로 동작)
npm run dev                  # http://localhost:3000
```

키가 하나도 없어도 전체 플로우가 돌아간다:
- 건축HUB 키 없음 → 매물 공부정보 없이 반환 → 관련 규칙은 `자료 부족` 판정
- Gemini 키 없음 → 결정론적 템플릿 리포트로 대체
- Supabase 없음 → 저장 생략, 판정은 정상 반환

## 폴더 구조 / 담당

```
app/page.tsx              화면·결과 카드 (A)
app/api/check/route.ts    규칙엔진 판정 (B와 연결)
app/api/building/route.ts 건축HUB 조회 (C / 1번) ← TODO 주석 참조
app/api/ocr/route.ts      등기부 추출, 현재 샘플 (2번)
app/api/report/route.ts   Gemini 상담 리포트 (2번)
lib/types.ts              공통 타입 — 전원 이것만 import
lib/ruleEngine.ts         판정 순수 함수 (B / 3번)
rules/kb-hug.json         규칙팩 — 3번이 공식 출처로 검수
supabase/schema.sql       DB 스키마 (Supabase SQL Editor에서 실행)
```

## 절대 규칙 (합칠 때 깨지지 않기 위한 약속)

1. 판정은 `lib/ruleEngine.ts` 에서만. Gemini에게 판정 금지
2. Gemini는 문장 변환·리포트만. 새 판정·수치 생성 금지
3. API 키는 `process.env` 로만. `.env*` 는 `.gitignore` 에
4. Gemini·DB 접근은 `app/api/` 서버 안에서만
5. 타입은 `lib/types.ts` 정의만 사용, 추가 시 공유
6. 데모는 샘플 데이터만. 실제 개인정보 수집 금지
7. `확인된 충돌 없음` ≠ 승인. UI에서 항상 공식심사필요 건수와 함께 표시

## 회사 노트북 → 개인 노트북 이송 (노션 경유)

회사 노트북에서 (push만 안 될 뿐 commit은 되므로 git은 계속 쓴다):

```bash
git add -A && git commit -m "작업 내용"
rm -rf node_modules .next
zip -r kb-jeonse-check.zip . -x "*.env*"
```

zip을 노션에 업로드 → 개인 노트북에서 다운로드 후:

```bash
unzip kb-jeonse-check.zip -d kb-jeonse-check && cd kb-jeonse-check
npm install
npm run dev        # 동작 확인
git push origin main   # (.git 폴더가 zip에 포함되어 히스토리 유지됨)
```

주의: `.env.local` 은 zip에 넣지 않는다. 키는 발급처·Vercel 대시보드에서 관리.

## Vercel 배포

1. GitHub repo 생성 → push
2. vercel.com → Add New Project → repo import (Next.js 자동 감지)
3. Settings → Environment Variables 에 `.env.example` 의 4개 키 입력
   - `NEXT_PUBLIC_` 접두사는 `NEXT_PUBLIC_SUPABASE_URL` 하나뿐. 나머지는 서버 전용
4. main push = 자동 배포, PR 브랜치 = 프리뷰 URL (QA 링크로 사용)

각 route에 `export const maxDuration` 설정됨 (Hobby 플랜 기본 10초 타임아웃 대비).

## Supabase 세팅

1. supabase.com 프로젝트 생성
2. SQL Editor에 `supabase/schema.sql` 실행
3. Project Settings → API 에서 URL·service_role 키 복사 → env에 입력

## shadcn/ui 추가 (선택)

현재는 순수 Tailwind 컴포넌트. shadcn을 붙이려면:

```bash
npx shadcn@2.3.0 init -d
npx shadcn@2.3.0 add button card input label select radio-group alert badge
```

## 다음 작업 (TODO)

- [ ] 1번: `app/api/building/route.ts` 건축HUB 실제 호출 (활용신청 승인 필요 — 오늘 신청할 것)
- [ ] 2번: `app/api/ocr/route.ts` PDF 업로드 + 추출 + 고객 확인 화면
- [ ] 3번: `rules/kb-hug.json` 수치·출처·기준일을 공식 문서로 검수 (현재는 골격용 예시값)
- [ ] F04 자료 충분성 검사 (주소 일치·발급일 검사) — check route 앞단에 추가
