-- Supabase SQL Editor에 붙여넣어 실행 (최소 저장 원칙: 실명·주민번호 등 저장 금지)

-- 종합 판정 상태 enum
create type overall_status as enum ('pass', 'fail', 'insufficient', 'needs_review');

create table if not exists diagnosis_cases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  payload jsonb not null,           -- DiagnosisCase (샘플/자기신고 데이터만)
  result jsonb not null,            -- PathResult
  status overall_status,            -- 종합 판정 (조회·통계용, enum으로 값 제한)
  rule_version text not null
);

-- 조회용 인덱스 (상태별/최신순)
create index if not exists idx_diagnosis_cases_status on diagnosis_cases (status);
create index if not exists idx_diagnosis_cases_created_at on diagnosis_cases (created_at desc);

-- 서버(service role)만 접근. anon 접근 차단.
alter table diagnosis_cases enable row level security;