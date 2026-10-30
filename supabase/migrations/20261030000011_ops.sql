-- Ingestion errors the desk can resolve, and a job queue the nightly run drains.

create table if not exists ingestion_errors (
  id          uuid primary key default gen_random_uuid(),
  stage       text not null,
  source_ref  text,
  message     text not null,
  raw         text,
  created_at  timestamptz not null default now(),
  dismissed_at timestamptz,
  resolved_at timestamptz
);

create table if not exists jobs (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,
  payload     jsonb not null default '{}'::jsonb,
  status      text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  attempts    integer not null default 0,
  run_after   timestamptz not null default now(),
  last_error  text,
  result      jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists jobs_due_idx on jobs (status, run_after);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated')
     and exists (select 1 from pg_namespace where nspname = 'auth') then
    alter table ingestion_errors enable row level security;
    alter table jobs enable row level security;
    drop policy if exists "team can read" on ingestion_errors;
    create policy "team can read" on ingestion_errors for select to authenticated using (true);
    drop policy if exists "team can resolve errors" on ingestion_errors;
    create policy "team can resolve errors" on ingestion_errors for update to authenticated using (true) with check (true);
    drop policy if exists "team can read jobs" on jobs;
    create policy "team can read jobs" on jobs for select to authenticated using (true);
    drop policy if exists "team can enqueue" on jobs;
    create policy "team can enqueue" on jobs for insert to authenticated with check (true);
  end if;
end $$;
