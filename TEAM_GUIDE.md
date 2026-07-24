# 팀 가이드 — kb-jeonse-check

세팅 담당(1번)이 만들어 둔 것과, 각자 어디서 뭘 작업하면 되는지 정리한 문서.
읽는 순서: **이 문서 → `CLAUDE.md`(바이브코딩 규칙) → 본인 담당 폴더**

---

## 1. 5분 안에 띄우기

```bash
node -v                # v22.x 여야 한다. 아니면 아래 "Node 버전" 참고
npm ci                 # npm install 말고 ci. lock 파일 그대로 설치돼서 버전이 안 흔들림
cp .env.example .env.local
npm run dev            # http://localhost:3000
```

**`.env.local`은 각자 만들되, 키는 노션 페이지에 정리해뒀으니 거기서 복사해 쓴다.** 아래 §6 참고.

키가 없어도 앱이 죽지는 않는다. 다만 공공 API 호출이 픽스처(저장해둔 샘플 응답)로 대체돼서
**뭘 검색하든 같은 결과가 나온다.** UI·판정 로직만 만지는 작업이면 그대로 개발해도 되지만,
주소·건물 조회를 확인해야 하는 작업이면 노션에서 키부터 가져올 것.

### Node 버전 — 전원 22로 통일

Vercel 빌드도 22로 돌기 때문에 로컬이 다르면 "내 컴에선 되는데" 상황이 생긴다.

```bash
nvm install 22 && nvm use 22    # nvm 쓰면 .nvmrc 보고 알아서 잡힌다: nvm use
```

`engine-strict=true`가 걸려 있어서 **다른 메이저 버전이면 `npm ci`가 아예 실패한다.**
`EBADENGINE` 에러가 나면 Node를 22로 올리라는 뜻이지 코드 문제가 아니다.

```bash
npm run typecheck      # 커밋 전에 이거 한 번 (빌드보다 빠름)
npm run build          # 배포 전 최종 확인
```

---

## 2. 이 서비스가 뭘 하는지 (30초)

계약금 걸기 **전에**, 신청인·매물 조건을 공개요건에 대조해서 **어느 층에서 왜 막히는지** 알려준다.

```
[1층] KB 상품요건  — 이 사람이 신청 자격에 해당하는가
        ↓
[2층] HUG 보증요건 — 그 보증이 이 매물에 가능한가
```

두 층을 합쳐서 판정하면 안 된다. KB는 1주택 허용인데 HUG 보증은 무주택이라 기준이 다르다.
**어디서 막혔는지**(`blockedAt`)가 이 서비스의 핵심 출력물이다. 상품에서 막혔으면 다른 상품을,
보증에서 막혔으면 다른 매물을 알아봐야 하니까.

### 절대 하지 않는 것

- 대출 승인 여부 **예측 금지** (신용평가는 은행 영역)
- 접근 불가 데이터 **추정 금지** (시세, 신용평가 → `OFFICIAL_REVIEW_REQUIRED`)
- 경로 간 **순위·추천 금지**
- LLM에게 판정 시키기 금지 (Gemini는 문장 다듬기만)

---

## 3. 폴더 구조와 담당

```
src/
├─ app/
│  ├─ page.tsx                  랜딩
│  ├─ diagnosis/page.tsx        진단 플로우 4단계   ← 공용. 수정 시 아래 "충돌 주의" 참고
│  ├─ diagnosis/result/         [MVP 이후] 저장된 진단 조회
│  ├─ login/                    [MVP 이후] Supabase Auth        · 2번
│  └─ api/
│     ├─ address/route.ts       주소 후보 검색                   · 1번 ✅
│     ├─ building/route.ts      건축HUB 표제부 조회              · 1번 ✅
│     ├─ ocr/route.ts           등기부 추출 (현재 샘플 반환)      · 2번 ⬜
│     ├─ check/route.ts         규칙엔진 실행 + 저장             · 후속
│     ├─ rules/route.ts         적용 중 규칙팩 조회 (검수용)      · 3번
│     └─ report/route.ts        상담 요약 생성                   · 후속
├─ features/
│  ├─ intake/                   F01 입력 폼·검증·매핑            · 1번 ✅
│  ├─ building/                 F02 주소→코드→건축HUB 매핑        · 1번 ✅
│  │  └─ __fixtures__/          실제 API 응답 3종 (키 없이 개발용)
│  ├─ registry/                 F03 등기부 파서·확인 UI           · 2번 ⬜
│  └─ result/                   결과 카드·리포트 템플릿           · 후속
├─ lib/
│  ├─ rule-engine/
│  │  ├─ index.ts               엔진 본체 (규칙팩 순회 → PathResult)
│  │  └─ evaluator.ts           개별 체크 함수 + CHECKERS 레지스트리 · 3번
│  ├─ crawlers/                 KB·HUG 크롤러 + 폴백 provider      · 3번 ⬜
│  ├─ supabase/                 server(service_role) / client(anon) · 2번
│  └─ gemini/client.ts          Gemini 초기화
├─ types/                       case.ts / rule.ts / api.ts + 배럴  ← 전원 `@/types`로 import
└─ rules/
   ├─ kb-hug.json               규칙팩 (현재 15개)                · 3번 ⬜ 수치 검수 필요
   └─ hug-guarantee.json        빈 껍데기. 분리할지는 3번이 판단
```

✅ 완료 · ⬜ 작업 필요

---

## 4. 규칙 추가하는 법 (3번 필독)

규칙 하나 추가 = **JSON 한 줄 + 함수 하나.** 이미 15번 반복된 패턴이라 따라 하면 된다.

**① `src/rules/kb-hug.json`에 규칙 추가**

```json
{
  "ruleId": "HUG-DEPOSIT-CAP",
  "layer": "GUARANTEE",              // PRODUCT(KB 상품) | GUARANTEE(보증기관)
  "path": "KB_STAR_HUG",
  "label": "보증금 한도 (수도권 7억 / 비수도권 5억)",
  "checkId": "checkDepositCap",      // ↓ 아래 함수 이름과 일치해야 함
  "params": { "capitalCap": 700000000, "nonCapitalCap": 500000000 },
  "sourceUrl": "https://www.khug.or.kr",
  "effectiveFrom": "2026-07-01"
}
```

**② `src/lib/rule-engine/evaluator.ts`에 체크 함수 추가**

```ts
const checkDepositCap: Checker = (c, p) => {
  const cap = c.property.region === 'CAPITAL' ? Number(p?.capitalCap) : Number(p?.nonCapitalCap);
  const ok = c.contract.deposit <= cap;
  return {
    verdict: ok ? 'NO_PUBLIC_CONFLICT_FOUND' : 'PUBLIC_REQUIREMENT_UNMET',
    reason: `보증금 ${won(c.contract.deposit)} — 한도 ${won(cap)}`,  // 어떤 값에 어떤 기준을 적용했는지
    usedValues: [`보증금 ${won(c.contract.deposit)} (자기신고)`],     // 화면에 "근거"로 표시됨
    nextAction: ok ? '' : '보증금이 한도를 초과합니다. 다른 매물을 검토하세요.',
  };
};
```

**③ 맨 아래 `CHECKERS`에 등록**

```ts
const CHECKERS: Record<string, Checker> = {
  ...,
  checkDepositCap,
};
```

끝. `GET /api/rules`로 현재 적용 중인 규칙팩을 확인할 수 있다.

### 판정은 이 5개 중 하나만

| 코드 | 언제 쓰나 | 예 |
|---|---|---|
| `PUBLIC_REQUIREMENT_UNMET` | 공개 규칙과 명확히 충돌 | 보증금이 한도 초과 |
| `NO_PUBLIC_CONFLICT_FOUND` | 결격을 못 찾음 (**승인 아님**) | 계약기간 24개월 |
| `MISSING_INFORMATION` | 판정할 값이 없음 | 등기부 미제출 |
| `POST_CONTRACT_REQUIREMENT` | 계약 후에 생기는 조건 | 계약금 5% 지급 |
| `OFFICIAL_REVIEW_REQUIRED` | 우리가 원천적으로 못 함 | 시세, 신용평가, DSR |

**모르는 걸 `UNMET`으로 처리하지 마라.** `MISSING_INFORMATION`과 `INTERNAL_REQUIRED`를 구분하는 게
이 서비스의 정체성이다.

---

## 5. 등기부 붙이는 법 (2번 필독)

`/api/ocr`이 이 형태로 반환하면 화면·엔진이 자동으로 받는다. **이미 연결돼 있다.**

```ts
{
  registry: {
    ownerName?:          { value: string,  source: 'USER_CONFIRMED_DOCUMENT' },
    ownerType?:          { value: 'INDIVIDUAL' | 'CORPORATION', source: ... },
    seniorLienTotal?:    { value: number,  source: ... },   // 근저당 설정액 합계 (원)
    hasRightsViolation?: { value: boolean, source: ... },   // 압류·가압류·경매·가처분·가등기
    issuedDate?: '2026-07-20',
  }
}
```

**지켜야 할 것 (명세 F-03 완료조건)**

- 추출값은 **고객이 확인·수정한 뒤에만** 판정에 전달. `source`가 `USER_CONFIRMED_DOCUMENT`인 이유
- 못 읽은 값을 `0`이나 `false`로 채우지 말 것 → 필드를 아예 비워두면 엔진이 `자료 부족`으로 판정함
- 소유자 실명은 마스킹 또는 미저장

**충돌 주의**: 등기부 확인 UI는 `src/features/registry/components/`에 컴포넌트로 만들고,
`diagnosis/page.tsx`에는 **import 한 줄만** 추가할 것. 그 파일을 여러 명이 동시에 고치면 머지가 깨진다.

---

## 6. 환경변수

### 각자 해야 할 것

```bash
cp .env.example .env.local     # 그리고 키 채우기
```

**키는 노션에 정리돼 있다. 각자 발급받지 말고 노션에서 복사해 붙여넣을 것.**

| 키 | 용도 | 상태 |
|---|---|---|
| `JUSO_API_KEY` | 주소 검색 | 노션 |
| `BUILDING_API_KEY` | 건축HUB 건축물대장 조회 | 노션 |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | 진단 결과 저장 | 노션 |
| `GEMINI_API_KEY` | 상담 요약 문장 다듬기 | ⬜ **미발급** — 없어도 동작함 |

`GEMINI_API_KEY`는 아직 발급 전이라 `.env.local`에 비워두면 된다.
리포트가 템플릿으로 생성될 뿐 판정·화면에는 영향이 없다. 발급되면 노션에 추가된다.

### 키가 없으면 어떻게 되나

| 없는 키 | 실제로 벌어지는 일 |
|---|---|
| `JUSO_API_KEY` | 주소 검색이 **항상** `서울 서초구 강남대로12길 11 (양재동, 현대아트빌라)` 1건만 반환. **검색어와 무관** |
| `BUILDING_API_KEY` | 건축물대장이 **항상** 같은 샘플 건물로 반환 |
| `GEMINI_API_KEY` | 리포트가 템플릿으로 생성됨 (품질만 다름, 내용은 정상) — **현재 상태** |
| Supabase 키 | 저장만 건너뜀, 판정은 정상 |
| `USE_FIXTURES=1` | 키가 **있어도** 픽스처 강제. `.env.example`엔 없으니 필요할 때만 직접 추가 |

앞의 두 개는 **결과가 틀린다.** 화면에 "지금 샘플 데이터입니다" 표시가 안 나오니,
주소 검색이 계속 양재동만 나오면 버그를 의심하기 전에 `.env.local`부터 확인할 것.

**`.env.local`은 절대 커밋 금지.** (`.gitignore`에 있음)
노션 페이지도 외부 공유하지 말 것 — 특히 `SUPABASE_SERVICE_ROLE_KEY`는 RLS를 우회하는
관리자 권한 키라 유출되면 DB 전체가 열린다.

---

## 7. 협업 규칙

- 브랜치: `main`은 배포용. 각자 `feat/이름-기능`에서 작업 후 PR
- 설치는 `npm ci`. 새 라이브러리 추가할 때만 `npm install 패키지명` + **단톡 공유**
- 타입은 `src/types/`에 정의된 것만. 추가 필요하면 `case.ts`/`rule.ts`/`api.ts` 중 맞는 데 넣고 공유
- 커밋 전 `npm run typecheck`
- 남의 담당 폴더를 건드려야 하면 먼저 물어볼 것

### 환경이 자동으로 맞춰지는 장치

건드리지 말 것. 이것들 때문에 "내 컴에선 되는데"가 안 생긴다.

| 파일 | 역할 |
|---|---|
| `package.json` + `package-lock.json` | 의존성 목록·정확한 버전. `npm ci`가 lock 그대로 설치 |
| `.nvmrc` (`22`) | nvm 쓰면 `nvm use`로 Node 버전 자동 전환 |
| `package.json` `engines: 22.x` | Vercel이 이 버전으로 빌드 |
| `.npmrc` `engine-strict=true` | Node 버전 다르면 `npm ci` 실패시켜 강제 |
| `.npmrc` `save-exact=true` | 새 패키지 설치 시 `^` 없이 고정 버전으로 기록 |
| `.gitattributes` | 줄바꿈 LF 통일. Windows/Mac 섞여도 diff 안 깨짐 |
| `tsconfig.json` / `.eslintrc.json` | 타입·린트 기준 통일 |

**`package-lock.json`은 반드시 커밋한다.** 이게 requirements.txt 역할이라 빼면 통일이 깨진다.
머지 충돌 나면 직접 편집하지 말고 `git checkout --theirs package-lock.json && npm install` 로 재생성.

---

## 8. 알려진 한계 (설계상 확정. 고치려 하지 말 것)

| 항목 | 왜 | 처리 |
|---|---|---|
| **위반건축물** | 건축HUB 표제부·기본개요 어디에도 필드가 없음 (2026-07 실호출 확인) | 영구 `자료 부족` + "정부24·세움터에서 열람하세요" |
| **전용면적** | 표제부(getBrTitleInfo)에는 호별 전용면적이 없음. 전유부(getBrExposInfo) 추가 호출 필요 | 미수집. 현재 면적을 쓰는 규칙이 없어 판정 영향 없음 — 면적 규칙 추가 시 전유부 연동부터 |
| **주택가격/시세** | KB시세·부동산테크 접근 불가. 참고 시세는 기관 불인정 | 영구 `공식 심사 필요` |
| **선순위채권 비율** | 시세가 없으니 비율 계산 자체가 불가 | 금액만 표시하고 `공식 심사 필요` |
| **다가구 선순위 임차보증금** | 등기부에 안 나옴. 다른 세입자 정보라 접근 불가 | `공식 심사 필요` + 임대인에게 확인서 요청 안내 |
| **타세대 전입** | 전입세대열람내역 필요. 계약 전 확보 불가 | `공식 심사 필요` |

이걸 자체 추정으로 메우면 세이프홈즈·내집스캔과 똑같아진다. **비워두는 게 기능이다.**

---

## 9. 실호출로 알아낸 것 (삽질 방지)

1. **건축HUB는 도로명주소를 안 받는다.** `sigunguCd`+`bjdongCd`+`bun`+`ji` 필요.
   주소 API의 `admCd`(10자리)를 5+5로 쪼개면 된다.
2. **`bun`/`ji`는 4자리 0채움 필수.** `317` → `0317`. 안 하면 `totalCount: 0`이 나온다.
3. **`_type=json`을 안 붙이면 XML로 온다.**
4. **빈 값이 `''`가 아니라 공백 한 칸(`' '`)이다.** `if (!bldNm)`으로 체크하면 통과해버림. `.trim()` 필수.
5. **`regstrKindCdNm`이 대장구분에 따라 다르다.** 집합=`표제부`, 일반=`일반건축물`.
   이거 놓쳐서 단독·다가구가 통째로 누락되는 버그가 있었다.
6. **`mgmBldrgstPk`가 22자리**라 JS Number 정밀도를 넘는다. 쓰지 말 것.
7. **`TESTJUSOGOKR`(주소 API 테스트키)는 실제 검색을 안 한다.** 고정 샘플만 반환.
8. 주소 API 검색어에 SQL 예약어·특수문자가 들어가면 **IP가 차단될 수 있다.** 입력 정제 필수.

---

## 10. 지금 상태

| | 상태 |
|---|---|
| 프로젝트 세팅·타입·배포 설정 | ✅ |
| UI (디자인 토큰·스테퍼·결과 카드) | ✅ |
| F01 신청인·계약 입력 | ✅ |
| F02 주소검색 → 건축HUB (실연동) | ✅ |
| F03 등기부 OCR | ⬜ 샘플만 |
| F04 자료 충분성 검사 | ⬜ 없음 |
| F05·F06 규칙팩 | ⚠️ 구조는 완성, **수치 미검증** |
| F07 경로별 조합 | 🔶 `blockedAt`까지는 동작 |
| F09 근거 표시 | ✅ 판정별 출처·기준일 표시 중 |
| F10 다음 행동 | 🔶 규칙별 `nextAction` 있음, 종합 권고 없음 |
| F11 상담 요약 | 🔶 템플릿 생성됨, 동의 절차 없음 |

### 가장 급한 것

**`rules/kb-hug.json`의 수치는 아직 검증되지 않았다.** (연령 19~34, 소득 5천, 보증금 7억 등)
화면에는 출처 URL과 기준일이 표시되는데 실제 원문 대조를 안 했다.
"근거 기반 판정"이 이 서비스의 정체성이므로, 발표 전에 반드시 KB 상품공시·HUG 공시 원문으로 검수해야 한다.
