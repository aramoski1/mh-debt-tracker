-- A park with no loan is not scored. The pressure column stays blank instead of storing 0.
-- Existing read policies on park_scores and park_score_history are unchanged.

alter table park_scores alter column score drop not null;
alter table park_score_history alter column score drop not null;
