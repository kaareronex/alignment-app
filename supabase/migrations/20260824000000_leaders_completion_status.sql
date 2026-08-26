-- Exposes whether each leader has already completed their interview, so the
-- leader-facing name dropdown can show it before selection (not just after).
-- Return columns are changing, so the function must be dropped and recreated
-- rather than replaced in place.
drop function if exists get_leaders_for_project(uuid);

create function get_leaders_for_project(p_project_id uuid)
returns table (
  id uuid,
  name text,
  role_label text,
  has_completed boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    l.id,
    l.name,
    l.role_label,
    exists (
      select 1 from sessions s
      where s.leader_id = l.id
        and s.project_id = p_project_id
        and s.status = 'completed'
    ) as has_completed
  from leaders l
  where l.project_id = p_project_id
  order by l.name;
$$;

revoke all on function get_leaders_for_project(uuid) from public;
grant execute on function get_leaders_for_project(uuid) to anon;
