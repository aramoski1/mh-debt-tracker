-- Acquisition desk: rate prints, measured spreads, saved underwriting, deal stages,
-- the parks Cooper Cardinal already manages, and the buy box those fit against.
-- Flood zone is filled by the pipeline. The app only reads it.

create table if not exists rate_prints (
  series       text not null,          -- DGS5, DGS7, DGS10, DPRIME, BAA10Y, SOFR
  observed_on  date not null,
  value        numeric(8, 4) not null, -- percent
  primary key (series, observed_on)
);

create table if not exists market_spreads (
  source         text not null,        -- cmbs | sba
  lender_kind    text not null,
  median_spread  numeric(6, 3) not null,
  sample_size    integer not null,
  as_of          date not null,
  primary key (source, lender_kind, as_of)
);

create table if not exists underwriting (
  park_id        uuid primary key references parks(id) on delete cascade,
  price          numeric,
  cap_rate       numeric(6, 3),        -- percent, e.g. 7.5
  lot_rent       numeric(10, 2),
  occupancy_pct  numeric(5, 2),
  expense_pct    numeric(5, 2),
  rent_growth    numeric(5, 2),
  sites          integer,
  updated_at     timestamptz not null default now()
);

create table if not exists deals (
  park_id     uuid primary key references parks(id) on delete cascade,
  stage       text not null default 'target'
              check (stage in ('target', 'contacted', 'loi', 'under_contract', 'closed', 'passed')),
  next_action date,
  note        text,
  updated_at  timestamptz not null default now()
);

create table if not exists portfolio (
  park_id  uuid primary key references parks(id) on delete cascade,
  added_at timestamptz not null default now()
);

create table if not exists buy_box (
  id         integer primary key default 1 check (id = 1),
  min_sites  integer not null default 50,
  max_sites  integer not null default 400,
  states     text[] not null default '{AZ}',
  kinds      text[] not null default '{mhp,rv,mixed}',
  updated_at timestamptz not null default now()
);

insert into buy_box (id) values (1) on conflict (id) do nothing;

alter table parks add column if not exists flood_zone text;

-- Append only. create or replace cannot insert columns in the middle of an existing view.
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
  (select max(a.created_at) from activities a where a.park_id = p.id) as last_activity_at,
  p.phone, p.website,
  (pf.park_id is not null) as managed,
  p.flood_zone
from parks p
left join owners o on o.id = p.owner_id
left join park_scores s on s.park_id = p.id
left join loans l on l.id = s.primary_loan_id
left join lenders ld on ld.id = l.lender_id
left join maturity_estimates me on me.loan_id = l.id
left join portfolio pf on pf.park_id = p.id;

alter view park_overview set (security_invoker = true);

do $$
declare t text;
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated')
     and exists (select 1 from pg_namespace where nspname = 'auth') then
    foreach t in array array['rate_prints', 'market_spreads', 'underwriting', 'deals', 'portfolio', 'buy_box'] loop
      execute format('alter table %I enable row level security', t);
      execute format('drop policy if exists "team can read" on %I', t);
      execute format('create policy "team can read" on %I for select to authenticated using (true)', t);
    end loop;
    drop policy if exists "team can read" on source_runs;
    alter table source_runs enable row level security;
    create policy "team can read" on source_runs for select to authenticated using (true);

    foreach t in array array['underwriting', 'deals', 'portfolio', 'buy_box'] loop
      execute format('grant select, insert, update, delete on %I to authenticated', t);
    end loop;
    grant select on rate_prints, market_spreads, source_runs to authenticated;

    drop policy if exists "team can write underwriting" on underwriting;
    create policy "team can write underwriting" on underwriting for all to authenticated using (true) with check (true);
    drop policy if exists "team can write deals" on deals;
    create policy "team can write deals" on deals for all to authenticated using (true) with check (true);
    drop policy if exists "team can write portfolio" on portfolio;
    create policy "team can write portfolio" on portfolio for all to authenticated using (true) with check (true);
    drop policy if exists "team can write buy box" on buy_box;
    create policy "team can write buy box" on buy_box for all to authenticated using (true) with check (true);
  end if;
end $$;
