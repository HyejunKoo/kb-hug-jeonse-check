-- KB/HUG 공시에서 추출한 규칙팩의 영구 스냅샷.
-- 원본 HTML은 현재 저장하지 않으며, 규칙·증거·응답 해시와 활성 버전만 DB에 저장한다.

create table if not exists public.rule_snapshots (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  source text not null check (source = 'CRAWLED'),
  rules jsonb not null check (jsonb_typeof(rules) = 'array'),
  crawl jsonb not null check (jsonb_typeof(crawl) = 'object'),
  fetched_at timestamptz not null,
  parser_version text not null,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_rule_snapshots_fetched_at
  on public.rule_snapshots (fetched_at desc);

create unique index if not exists idx_rule_snapshots_one_active
  on public.rule_snapshots (active)
  where active;

alter table public.rule_snapshots enable row level security;

-- 공개 클라이언트에는 규칙 스냅샷 테이블을 직접 노출하지 않는다.
revoke all on table public.rule_snapshots from anon, authenticated;
grant select, insert, update on table public.rule_snapshots to service_role;

-- 활성 버전 전환은 반드시 한 트랜잭션에서 처리한다.
create or replace function public.save_rule_snapshot(
  p_version text,
  p_rules jsonb,
  p_crawl jsonb,
  p_fetched_at timestamptz,
  p_parser_version text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot_id uuid;
begin
  if jsonb_typeof(p_rules) <> 'array' or jsonb_array_length(p_rules) = 0 then
    raise exception 'rules must be a non-empty JSON array';
  end if;
  if coalesce((p_crawl ->> 'success')::boolean, false) is not true then
    raise exception 'only a successful crawl can be activated';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.rule_snapshots.active'));
  update public.rule_snapshots set active = false where active;

  insert into public.rule_snapshots (
    version,
    source,
    rules,
    crawl,
    fetched_at,
    parser_version,
    active
  ) values (
    p_version,
    'CRAWLED',
    p_rules,
    p_crawl,
    p_fetched_at,
    p_parser_version,
    true
  )
  returning id into snapshot_id;

  return snapshot_id;
end;
$$;

revoke all on function public.save_rule_snapshot(text, jsonb, jsonb, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.save_rule_snapshot(text, jsonb, jsonb, timestamptz, text)
  to service_role;

notify pgrst, 'reload schema';
