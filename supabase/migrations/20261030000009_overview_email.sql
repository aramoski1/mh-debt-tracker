-- Owner email is on the owners table and was missing from the desk view.

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
  p.flood_zone,
  o.email as owner_email
from parks p
left join owners o on o.id = p.owner_id
left join park_scores s on s.park_id = p.id
left join loans l on l.id = s.primary_loan_id
left join lenders ld on ld.id = l.lender_id
left join maturity_estimates me on me.loan_id = l.id
left join portfolio pf on pf.park_id = p.id;

alter view park_overview set (security_invoker = true);
