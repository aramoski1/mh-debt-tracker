-- Term-matched spreads. market_spreads stays the 5-year rollup the model reads.
-- loan_spreads is the same loans split by Treasury tenor and origination quarter.

create table if not exists loan_spreads (
  source         text not null,
  lender_kind    text not null,
  tenor          text not null,        -- DGS5, DGS7, DGS10
  quarter        text not null,        -- origination quarter, 2024Q2
  method         text not null,        -- matching_tenor | term_unknown_uses_5y
  median_spread  numeric(6, 3) not null,
  sample_size    integer not null,
  as_of          date not null,
  primary key (source, lender_kind, tenor, quarter, method, as_of)
);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated')
     and exists (select 1 from pg_namespace where nspname = 'auth') then
    alter table loan_spreads enable row level security;
    drop policy if exists "team can read" on loan_spreads;
    create policy "team can read" on loan_spreads for select to authenticated using (true);
    grant select on loan_spreads to authenticated;
  end if;
end $$;
