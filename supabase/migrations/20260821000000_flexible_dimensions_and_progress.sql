-- 1. framing_definitions moves from a fixed 4-key object to a flexible
-- array of { id, label, description }, so admins can add/remove/rename/
-- reorder dimensions (2-6, enforced in the app). Transform any existing
-- rows from the old object shape; safe to re-run (only touches rows
-- still in the old object shape).
update projects p
set framing_definitions = coalesce((
  select jsonb_agg(jsonb_build_object('id', d.key, 'label', d.label, 'description', fd.value))
  from jsonb_each_text(p.framing_definitions) as fd(key, value)
  join (
    values
      ('uenighed', 'Disagreement'),
      ('ikke_vores_bord', 'Out of scope'),
      ('vigtigt', 'Important'),
      ('lykkedes', 'Success')
  ) as d(key, label) on d.key = fd.key
), '[]'::jsonb)
where jsonb_typeof(p.framing_definitions) = 'object';

alter table projects alter column framing_definitions set default '[]'::jsonb;

-- 2. Tag which framing dimension (by its id from the array above) each
-- assistant message primarily addressed, so progress can be derived from
-- messages rather than kept as separate duplicated per-session state.
alter table messages add column dimension_id text;

-- 3. Distinguish how a session ended, for the future synthesis/results
-- view - was a short interview the AI wrapping up naturally, or the
-- leader bailing out?
alter table sessions add column ended_reason text
  check (ended_reason in ('model_signal', 'leader_early_exit', 'max_questions', 'time_limit'));
