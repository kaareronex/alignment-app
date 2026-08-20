-- Row Level Security for the leader-alignment app.
--
-- Access model (no login; the anon key is public and identical for every
-- visitor, so RLS cannot key off auth.uid()):
--
--   * app_settings, sessions, messages, synthesis, and all writes to
--     projects/leaders: RLS is enabled with NO policies for anon, which
--     denies access by default. Only service_role (used exclusively in
--     server-side code, see lib/supabase/server.ts) may touch these —
--     service_role bypasses RLS entirely in Supabase, so it needs no
--     policies of its own.
--
--   * projects (read) and leaders (read): anon gets no direct table grant
--     either. Instead, two SECURITY DEFINER functions below expose only
--     the columns the leader-facing pages need, scoped to a single
--     project_id argument. This avoids the common mistake of a
--     `using (true)` policy, which would let anyone holding the anon key
--     run an unfiltered `select *` and dump every project's data — the
--     function signature forces the project_id filter, so no unfiltered
--     dump is possible even with direct API access.
--
--   * sessions and messages get no anon access at all, in either
--     direction. The interview loop already requires a server round trip
--     (the Claude API call), so the browser never talks to these tables
--     directly — a Next.js route handler using the service-role client
--     mediates reads/writes, authorizing each request against the
--     session's own id (an unguessable uuid, never listable since anon
--     has no grant on the table) as a bearer capability.

alter table app_settings enable row level security;
alter table projects enable row level security;
alter table leaders enable row level security;
alter table sessions enable row level security;
alter table messages enable row level security;
alter table synthesis enable row level security;

-- Leader-facing read access, via SECURITY DEFINER functions rather than
-- table grants, each scoped to a single project_id.

create or replace function get_project_public_state(p_project_id uuid)
returns table (
  id uuid,
  name text,
  status text,
  access_mode text,
  timer_status text,
  timer_started_at timestamptz,
  time_limit_enabled boolean,
  time_limit_minutes integer,
  max_questions integer
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.name,
    p.status,
    p.access_mode,
    p.timer_status,
    p.timer_started_at,
    p.time_limit_enabled,
    p.time_limit_minutes,
    p.max_questions
  from projects p
  where p.id = p_project_id;
$$;

revoke all on function get_project_public_state(uuid) from public;
grant execute on function get_project_public_state(uuid) to anon;

create or replace function get_leaders_for_project(p_project_id uuid)
returns table (
  id uuid,
  name text,
  role_label text
)
language sql
security definer
set search_path = public
stable
as $$
  select l.id, l.name, l.role_label
  from leaders l
  where l.project_id = p_project_id
  order by l.name;
$$;

revoke all on function get_leaders_for_project(uuid) from public;
grant execute on function get_leaders_for_project(uuid) to anon;
