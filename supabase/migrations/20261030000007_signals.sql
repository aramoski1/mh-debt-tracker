-- Filings, FHA park loans, offerings, and figures derived from rows already stored.
-- loan_source gains hud so an FHA mobile-home mortgage can sit with the other loans.
-- The new value is not used in this file. Postgres accepts it on the next transaction.

alter type loan_source add value if not exists 'hud';

create table if not exists filing_hits (
  source     text not null,          -- edgar_efts | google_news | edgar_exhibit
  source_id  text not null,
  title      text,
  url        text,
  filed_on   date,
  form       text,
  snippet    text,
  primary key (source, source_id)
);
create index if not exists filing_hits_filed_idx on filing_hits (filed_on desc);

create table if not exists form_d_offerings (
  accession       text primary key,
  issuer_name     text not null,
  city            text,
  state           text,
  entity_type     text,
  industry_group  text,
  filed_on        date,
  sale_date       date,
  is_equity       boolean,
  is_debt         boolean,
  total_offering  numeric,
  total_sold      numeric,
  url             text
);
create index if not exists form_d_filed_idx on form_d_offerings (filed_on desc);

create table if not exists distress_events (
  source      text not null,
  source_id   text not null,
  event_type  text not null,
  park_id     uuid references parks(id) on delete set null,
  county      text,
  event_date  date,
  amount      numeric,
  title       text,
  url         text,
  primary key (source, source_id, event_type)
);
create index if not exists distress_events_park_idx on distress_events (park_id);

create table if not exists transactions (
  source          text not null,
  source_id       text not null,
  park_id         uuid references parks(id) on delete set null,
  county          text,
  apn             text,
  sale_date       date,
  price           numeric,
  sites           int,
  price_per_site  numeric,
  owner_name      text,             -- current assessor owner, not a confirmed buyer
  primary key (source, source_id)
);
create index if not exists transactions_park_idx on transactions (park_id);

-- Recorded owner on the assessor roll. This is not a beneficial-owner determination.
create table if not exists entities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  name_norm  text not null,
  zip        text not null default '',
  kind       text not null default 'recorded_owner',
  source     text not null,
  unique (name_norm, zip, source)
);

create table if not exists entity_links (
  entity_id  uuid not null references entities(id) on delete cascade,
  park_id    uuid not null references parks(id) on delete cascade,
  role       text not null,
  source     text not null,
  primary key (entity_id, park_id, role)
);

do $$
declare t text;
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated')
     and exists (select 1 from pg_namespace where nspname = 'auth') then
    foreach t in array array['filing_hits','form_d_offerings','distress_events','transactions','entities','entity_links'] loop
      execute format('alter table %I enable row level security', t);
      execute format('drop policy if exists "team can read" on %I', t);
      execute format('create policy "team can read" on %I for select to authenticated using (true)', t);
      execute format('grant select on %I to authenticated', t);
    end loop;
  end if;
end $$;
