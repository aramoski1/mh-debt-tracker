-- Longer acquisition stages. Existing values stay valid.

alter table deals drop constraint if exists deals_stage_check;

alter table deals add constraint deals_stage_check
  check (stage in (
    'target',
    'contacted',
    'in_conversation',
    'underwriting',
    'loi',
    'due_diligence',
    'under_contract',
    'closed',
    'passed'
  ));
