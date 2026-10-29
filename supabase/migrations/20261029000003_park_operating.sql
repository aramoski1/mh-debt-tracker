-- Per-park operating figures: rent, site count, vacancy, park type, how long the owner has held it.
-- One row per observation (a broker's entry or a row of an imported file), so history and sources are kept.
-- Scoring reads the newest non-empty value of each field; rows never overwrite each other.

create table if not exists park_operating (
  id                uuid primary key default gen_random_uuid(),
  park_id           uuid not null references parks(id) on delete cascade,
  source            text not null,        -- manual | csv | the vendor name given to `ingest operating --source`
  source_ref        text,                 -- file name for imports; null for manual entries
  observed_on       date not null default current_date,
  -- rent
  rent_current      numeric(10,2),        -- average monthly lot rent today
  rent_jan_this     numeric(10,2),        -- January 1 of this year
  rent_jan_last     numeric(10,2),        -- January 1 of last year
  rent_jan_prior    numeric(10,2),        -- January 1 of the year before
  -- size and vacancy
  total_sites       integer check (total_sites >= 0),
  vacant_sites      integer check (vacant_sites >= 0),
  dev_sites         integer check (dev_sites >= 0),       -- under development, not yet rentable
  park_owned_homes  integer check (park_owned_homes >= 0),
  empty_homes       integer check (empty_homes >= 0),
  occupancy_pct     numeric(5,2) check (occupancy_pct between 0 and 100),  -- when stated directly
  -- what kind of park
  rv_share_pct      numeric(5,2) check (rv_share_pct between 0 and 100),
  age_restricted    boolean,              -- true: 55+, false: all ages
  year_built        integer,
  land_tenure       text check (land_tenure in ('owned', 'leased')),
  owned_since       date,
  amenities         text,                 -- pools, clubhouse, street type, home age mix: call prep, not scored
  notes             text,
  entered_by        uuid,                 -- auth.users.id for manual entries
  entered_by_name   text,
  created_at        timestamptz not null default now()
);
create index if not exists park_operating_park_idx on park_operating (park_id, observed_on desc, created_at desc);
-- Re-importing the same file is idempotent; manual rows (source_ref null) never collide.
create unique index if not exists park_operating_import_uq on park_operating (park_id, source, source_ref, observed_on);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated')
     and exists (select 1 from pg_namespace where nspname = 'auth') then
    alter table park_operating enable row level security;
    drop policy if exists "team can read" on park_operating;
    create policy "team can read" on park_operating for select to authenticated using (true);
    drop policy if exists "team can enter figures" on park_operating;
    create policy "team can enter figures" on park_operating for insert to authenticated
      with check (entered_by = auth.uid() and source = 'manual');
  end if;
end $$;
