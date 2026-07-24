-- Supabase SQL Editor에 붙여넣어 실행 (최소 저장 원칙: 실명·주민번호 등 저장 금지)
create table if not exists diagnosis_cases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  payload jsonb not null,        -- DiagnosisCase (샘플/자기신고 데이터만)
  result jsonb not null,         -- PathResult
  rule_version text not null
);

-- 서버(service role)만 접근. anon 접근 차단.
alter table diagnosis_cases enable row level security;
