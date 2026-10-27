-- MH Debt Tracker: core schema
-- Runs on Supabase Postgres (15+) and plain Postgres 16. No PostGIS required:
-- coordinates are stored as lat/lon and spatial matching happens in the pipeline.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type park_kind as enum ('mhp', 'rv', 'mixed', 'unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lender_kind as enum (
    'community_bank', 'regional_bank', 'national_bank', 'credit_union',
    'agency_fannie', 'agency_freddie', 'agency_lender', 'cmbs_trust', 'conduit_lender', 'life_company',
    'debt_fund', 'sba_lender', 'individual', 'government', 'unknown'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type loan_source as enum ('fannie', 'freddie', 'cmbs', 'county', 'sba', 'manual');
exception when duplicate_object then null; end $$;

do $$ begin
  -- how we know the maturity date
  create type maturity_basis as enum ('reported', 'document', 'estimated', 'unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type loan_status as enum ('active', 'released', 'refinanced', 'paid_off', 'foreclosure', 'unknown');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Owners and lenders
-- ---------------------------------------------------------------------------
create table if not exists owners (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  name_norm       text not null,
  entity_type     text not null default 'unknown',   -- individual | llc | trust | corp | partnership | reit | unknown
  mailing_address text,
  mailing_city    text,
  mailing_state   text,
  mailing_zip     text,
  phone           text,
  email           text,
  park_count      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (name_norm, mailing_zip)
);
create index if not exists owners_name_trgm on owners using gin (name_norm gin_trgm_ops);

create table if not exists lenders (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  name_norm           text not null unique,
  kind                lender_kind not null default 'unknown',
  fdic_cert           int,
  ncua_charter        int,
  hq_state            text,
  total_assets_k      bigint,          -- thousands of dollars, from call reports
  cre_loans_k         bigint,
  total_capital_k     bigint,
  cre_concentration   numeric,         -- CRE loans / total capital (supervisory guideline: 300%)
  classified_by       text,            -- rule | fdic | ncua | llm | manual
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists lenders_name_trgm on lenders using gin (name_norm gin_trgm_ops);

create table if not exists lender_aliases (
  alias_norm  text primary key,
  lender_id   uuid not null references lenders(id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Parks and parcels
-- ---------------------------------------------------------------------------
create table if not exists parks (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  name_norm     text not null,
  address       text,
  city          text,
  state         text not null,
  zip           text,
  county        text,
  lat           double precision,
  lon           double precision,
  kind          park_kind not null default 'unknown',
  units         int,
  status        text,
  owner_id      uuid references owners(id) on delete set null,
  website       text,
  phone         text,
  sources       jsonb not null default '{}'::jsonb,   -- {"hifld": "12345", "maricopa_assessor": "123-45-678"}
  first_seen_at timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists parks_state_idx on parks (state);
create index if not exists parks_latlon_idx on parks (lat, lon);
create index if not exists parks_name_trgm on parks using gin (name_norm gin_trgm_ops);
create unique index if not exists parks_hifld_uidx on parks ((sources->>'hifld')) where sources ? 'hifld';

create table if not exists parcels (
  county          text not null,
  apn             text not null,
  state           text not null,
  park_id         uuid references parks(id) on delete set null,
  situs_address   text,
  situs_city      text,
  situs_zip       text,
  owner_name      text,
  owner_mailing   text,
  owner_city      text,
  owner_state     text,
  owner_zip       text,
  land_use_code   text,
  land_use_desc   text,
  acres           numeric,
  lat             double precision,
  lon             double precision,
  last_sale_date  date,
  last_sale_price numeric,
  last_deed_number text,
  raw             jsonb,
  updated_at      timestamptz not null default now(),
  primary key (county, apn)
);
create index if not exists parcels_park_idx on parcels (park_id);

-- ---------------------------------------------------------------------------
-- Recorded documents (county recorder) and loans
-- ---------------------------------------------------------------------------
create table if not exists recorded_documents (
  id                 uuid primary key default gen_random_uuid(),
  county             text not null,
  recording_number   text not null,
  doc_type           text not null,         -- see pipeline/mhdebt/sources/doc_types.py
  doc_type_raw       text,
  recording_date     date,
  grantors           text[] not null default '{}',
  grantees           text[] not null default '{}',
  amount             numeric,
  apns               text[] not null default '{}',
  references_number  text,                  -- the earlier document this one releases/modifies/assigns
  page_count         int,
  pdf_url            text,
  park_id            uuid references parks(id) on delete set null,
  extraction_status  text not null default 'pending',  -- pending | done | failed | skipped
  extracted          jsonb,                 -- fields read from the document by the model
  raw                jsonb,
  created_at         timestamptz not null default now(),
  unique (county, recording_number)
);
create index if not exists recdocs_park_idx on recorded_documents (park_id);
create index if not exists recdocs_type_date_idx on recorded_documents (doc_type, recording_date);

create table if not exists loans (
  id                   uuid primary key default gen_random_uuid(),
  park_id              uuid references parks(id) on delete set null,
  source               loan_source not null,
  source_loan_id       text not null,
  lender_id            uuid references lenders(id) on delete set null,
  lender_name_raw      text,
  borrower_name_raw    text,
  original_amount      numeric,
  current_balance      numeric,
  origination_date     date,
  recording_date       date,
  maturity_date        date,
  maturity_basis       maturity_basis not null default 'unknown',
  note_rate            numeric,             -- percent, e.g. 4.25
  term_months          int,
  amort_months         int,
  interest_only        boolean,
  balloon              boolean,
  dscr_current         numeric,
  noi_current          numeric,
  occupancy_current    numeric,
  payment_status       text,
  status               loan_status not null default 'active',
  document_id          uuid references recorded_documents(id) on delete set null,
  property_name_raw    text,
  property_address_raw text,
  property_city_raw    text,
  property_state_raw   text,
  property_zip_raw     text,
  match_confidence     numeric,             -- 0..1 for the park match
  raw                  jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (source, source_loan_id)
);
create index if not exists loans_park_idx on loans (park_id);
create index if not exists loans_maturity_idx on loans (maturity_date);

create table if not exists maturity_estimates (
  loan_id          uuid primary key references loans(id) on delete cascade,
  p10_date         date,
  p50_date         date,
  p90_date         date,
  prob_12m         numeric,
  prob_24m         numeric,
  prob_past_due    numeric,
  likely_date      date,
  basis            maturity_basis not null,
  method           text not null,
  explanation      text,
  computed_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Scores, alerts, CRM activity
-- ---------------------------------------------------------------------------
create table if not exists park_scores (
  park_id        uuid primary key references parks(id) on delete cascade,
  score          numeric not null,
  components     jsonb not null,
  primary_loan_id uuid references loans(id) on delete set null,
  computed_at    timestamptz not null default now()
);

create table if not exists park_score_history (
  park_id      uuid not null references parks(id) on delete cascade,
  score        numeric not null,
  computed_on  date not null default current_date,
  primary key (park_id, computed_on)
);

create table if not exists alerts (
  id          uuid primary key default gen_random_uuid(),
  park_id     uuid references parks(id) on delete cascade,
  kind        text not null,      -- new_loan | release | modification | score_jump | maturity_window
  title       text not null,
  detail      text,
  dedupe_key  text unique,
  created_at  timestamptz not null default now(),
  seen_at     timestamptz
);
create index if not exists alerts_created_idx on alerts (created_at desc);

create table if not exists activities (
  id              uuid primary key default gen_random_uuid(),
  park_id         uuid not null references parks(id) on delete cascade,
  author_id       uuid,             -- auth.users.id on Supabase
  author_name     text,
  kind            text not null default 'call',   -- call | email | visit | note
  body            text not null,
  outcome         text,             -- no_answer | not_interested | interested | listing | refi_referral
  next_follow_up  date,
  extracted       jsonb,            -- structured facts pulled from the note (debt, timing, motivation)
  created_at      timestamptz not null default now()
);
create index if not exists activities_park_idx on activities (park_id, created_at desc);

create table if not exists source_runs (
  id          bigserial primary key,
  source      text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'running',
  stats       jsonb not null default '{}'::jsonb,
  error       text
);

create table if not exists source_state (
  source      text primary key,
  state       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Read model for the app
-- ---------------------------------------------------------------------------
create or replace view park_overview as
select
  p.id, p.name, p.address, p.city, p.state, p.zip, p.county, p.lat, p.lon, p.kind, p.units,
  o.id as owner_id, o.name as owner_name, o.entity_type as owner_entity_type,
  o.mailing_city as owner_city, o.mailing_state as owner_state, o.park_count as owner_park_count,
  s.score, s.components as score_components, s.computed_at as scored_at,
  l.id as loan_id, l.source as loan_source, l.original_amount, l.current_balance, l.note_rate,
  l.origination_date, l.recording_date, l.lender_name_raw,
  ld.name as lender_name, ld.kind as lender_kind,
  coalesce(l.maturity_date, me.likely_date, me.p50_date) as maturity_date,
  l.status as loan_status,
  coalesce(me.basis, l.maturity_basis) as maturity_basis,
  me.p10_date, me.p90_date, me.prob_12m, me.prob_24m, me.prob_past_due, me.explanation as maturity_explanation,
  (select max(a.created_at) from activities a where a.park_id = p.id) as last_activity_at
from parks p
left join owners o on o.id = p.owner_id
left join park_scores s on s.park_id = p.id
left join loans l on l.id = s.primary_loan_id
left join lenders ld on ld.id = l.lender_id
left join maturity_estimates me on me.loan_id = l.id;

-- ---------------------------------------------------------------------------
-- Row level security (Supabase). The pipeline uses the service role and bypasses RLS.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated')
     and exists (select 1 from pg_namespace where nspname = 'auth') then
    foreach t in array array['owners','lenders','parks','parcels','recorded_documents','loans',
                             'maturity_estimates','park_scores','park_score_history','alerts','activities'] loop
      execute format('alter table %I enable row level security', t);
      execute format('drop policy if exists "team can read" on %I', t);
      execute format('create policy "team can read" on %I for select to authenticated using (true)', t);
    end loop;
    drop policy if exists "team can write notes" on activities;
    create policy "team can write notes" on activities for insert to authenticated with check (author_id = auth.uid());
    drop policy if exists "team can mark alerts seen" on alerts;
    create policy "team can mark alerts seen" on alerts for update to authenticated using (true) with check (true);
    -- ...but only the seen_at column.
    revoke update on alerts from authenticated;
    if exists (select 1 from pg_roles where rolname = 'anon') then
      revoke all on all tables in schema public from anon;  -- nothing is readable without signing in
    end if;
    grant update (seen_at) on alerts to authenticated;
    -- Pipeline-only tables: RLS on with no policies, so the browser keys can't read or change them.
    alter table lender_aliases enable row level security;
    alter table source_runs enable row level security;
    alter table source_state enable row level security;
    alter view park_overview set (security_invoker = true);
  end if;
end $$;
