-- Workshop duration, used to compute the time allocation in the
-- synthesis's generated workshop plan. Not admin-editable - fixed default.
alter table projects add column workshop_duration_minutes integer not null default 90;
