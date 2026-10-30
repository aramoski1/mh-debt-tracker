-- Where each field's current value came from. Locked tags are enforced in the writers.

alter table parks add column if not exists field_sources jsonb not null default '{}'::jsonb;
alter table loans add column if not exists field_sources jsonb not null default '{}'::jsonb;
alter table park_operating add column if not exists field_sources jsonb not null default '{}'::jsonb;
alter table underwriting add column if not exists field_sources jsonb not null default '{}'::jsonb;

comment on column parks.field_sources is
  'Map of column name to tag: edgar, recorder, assessor, sba, hud, agency, fdic, document, jack, estimate, web, hifld.';
