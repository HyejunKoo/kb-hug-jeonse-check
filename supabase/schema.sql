-- Supabase SQL Editor에 붙여넣어 실행 (최소 저장 원칙: 실명·주민번호 등 저장 금지)

-- 종합 판정 상태 enum (CREATE TYPE은 IF NOT EXISTS를 지원하지 않아 DO 블록으로 감싼다)
do $$ begin
  create type overall_status as enum ('pass', 'fail', 'insufficient', 'needs_review');
exception when duplicate_object then null;
end $$;

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

-- 서버(service role)는 RLS를 우회해 항상 접근 가능.
-- anon(비로그인)은 아래에 정책이 없으므로 기본 차단 유지.
alter table diagnosis_cases enable row level security;

-- ---------- Supabase Auth 로그인 사용자별 저장/조회 ----------
-- 기존 익명 row는 user_id = null로 보존한다 (auth.uid()와 절대 일치하지 않으므로 로그인 사용자에게 노출되지 않음).
alter table diagnosis_cases add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_diagnosis_cases_user_created on diagnosis_cases (user_id, created_at desc);

-- 로그인 사용자는 본인 소유(user_id = auth.uid()) row만 select/insert/delete 가능. update는 1차 범위 밖.
drop policy if exists "diagnosis_cases_select_own" on diagnosis_cases;
create policy "diagnosis_cases_select_own" on diagnosis_cases
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "diagnosis_cases_insert_own" on diagnosis_cases;
create policy "diagnosis_cases_insert_own" on diagnosis_cases
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "diagnosis_cases_delete_own" on diagnosis_cases;
create policy "diagnosis_cases_delete_own" on diagnosis_cases
  for delete to authenticated
  using (user_id = auth.uid());