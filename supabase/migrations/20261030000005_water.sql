-- Drinking-water systems from EPA ECHO, matched to a park only when the name is unambiguous.

create table if not exists water_systems (
  pws_id                text primary key,
  name                  text not null,
  county                text,
  serious_violator      boolean not null default false,
  qtrs_with_violations  integer,
  rules_violated_3yr    integer,
  park_id               uuid references parks(id) on delete set null,
  match_score           numeric(5, 1),
  observed_on           date not null default current_date
);
create index if not exists water_systems_park_idx on water_systems (park_id);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated')
     and exists (select 1 from pg_namespace where nspname = 'auth') then
    alter table water_systems enable row level security;
    drop policy if exists "team can read" on water_systems;
    create policy "team can read" on water_systems for select to authenticated using (true);
    grant select on water_systems to authenticated;
  end if;
end $$;
