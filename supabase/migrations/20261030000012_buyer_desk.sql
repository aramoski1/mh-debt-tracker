-- Tables for the buyer desk: saved views, contacts, watches, documents, and one firm.

create table if not exists saved_views (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,
  name       text not null,
  params     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists user_settings (
  user_id    uuid primary key,
  dashboard  jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists buy_boxes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid,
  name          text not null,
  min_sites     integer,
  max_sites     integer,
  states        text[] not null default '{AZ}',
  kinds         text[] not null default '{mhp,rv,mixed}',
  counties      text[] not null default '{}',
  max_miles     numeric,
  min_years_held integer,
  created_at    timestamptz not null default now()
);

create table if not exists contacts (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid,
  park_id    uuid,
  name       text,
  role       text not null default 'owner',
  phone      text,
  email      text,
  mailing    text,
  source     text not null default 'manual',
  verified   boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists watches (
  park_id         uuid primary key references parks(id) on delete cascade,
  last_checked_at timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists watch_findings (
  id            uuid primary key default gen_random_uuid(),
  park_id       uuid not null references parks(id) on delete cascade,
  kind          text not null,
  summary       text not null,
  proposed      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  reconciled_at timestamptz
);

create table if not exists park_documents (
  id         uuid primary key default gen_random_uuid(),
  park_id    uuid references parks(id) on delete cascade,
  title      text not null,
  url        text,
  page       integer,
  field      text,
  value      text,
  quote      text,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists rent_comps (
  id          uuid primary key default gen_random_uuid(),
  submarket   text not null,
  lot_rent    numeric,
  source      text not null,
  observed_on date,
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists field_definitions (
  id      uuid primary key default gen_random_uuid(),
  entity  text not null check (entity in ('park', 'owner', 'loan', 'deal')),
  slug    text not null,
  label   text not null,
  kind    text not null default 'text' check (kind in ('text', 'number', 'date', 'select')),
  unique (entity, slug)
);

alter table parks add column if not exists custom_fields jsonb not null default '{}'::jsonb;

alter table deals add column if not exists price numeric;
alter table deals add column if not exists price_per_site numeric;
alter table deals add column if not exists cap_rate numeric;
alter table deals add column if not exists financing text;
alter table deals add column if not exists earnest numeric;
alter table deals add column if not exists diligence_date date;
alter table deals add column if not exists close_date date;
alter table deals add column if not exists lost_reason text;
alter table deals add column if not exists stage_changed_at timestamptz;

create table if not exists firms (
  id   uuid primary key default gen_random_uuid(),
  name text not null
);
create table if not exists firm_members (
  firm_id uuid not null references firms(id) on delete cascade,
  user_id uuid not null,
  role    text not null default 'member' check (role in ('owner', 'admin', 'member')),
  primary key (firm_id, user_id)
);
insert into firms (id, name)
select '00000000-0000-0000-0000-0000000000cc', 'Cooper Cardinal'
where not exists (select 1 from firms where name = 'Cooper Cardinal');

create table if not exists copilot_threads (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,
  page       text,
  question   text not null,
  reply      text not null,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated')
     and exists (select 1 from pg_namespace where nspname = 'auth') then
    foreach t in array array['saved_views','user_settings','buy_boxes','contacts','watches','watch_findings','park_documents','rent_comps','field_definitions','firms','firm_members','copilot_threads'] loop
      execute format('alter table %I enable row level security', t);
      execute format('drop policy if exists "team can read" on %I', t);
      execute format('create policy "team can read" on %I for select to authenticated using (true)', t);
      execute format('drop policy if exists "team can write" on %I', t);
      execute format('create policy "team can write" on %I for all to authenticated using (true) with check (true)', t);
    end loop;
  end if;
end $$;
