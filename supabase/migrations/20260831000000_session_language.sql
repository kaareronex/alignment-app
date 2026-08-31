-- Participants now pick their interview language explicitly up front
-- (replacing the earlier auto-detect-from-first-answer approach), so it
-- needs to be stored per session rather than inferred by the model at
-- request time. Nullable/no default: every NEW session sets it before the
-- first question is ever asked, but existing in-flight sessions predate
-- this column and should fall back to auto-detect behaviour rather than
-- being forced into a language nobody chose.
alter table sessions add column language_code text;
