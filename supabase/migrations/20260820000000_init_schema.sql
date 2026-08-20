-- Core schema for the leader-alignment interview app.
-- See alignment-app-plan.md ("Datamodel (Supabase)") for the source spec.

create table if not exists app_settings (
  id uuid primary key default gen_random_uuid(),
  admin_password_hash text not null,
  -- Enforces a single row: the unique constraint on a constant-valued
  -- column makes a second insert violate uniqueness.
  singleton boolean not null default true unique
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'closed')),
  strategy_context text,
  session_purpose text,
  framing_definitions jsonb not null default '{}'::jsonb,
  max_questions integer not null,
  access_mode text not null
    check (access_mode in ('lobby', 'open')),
  time_limit_enabled boolean not null default false,
  time_limit_minutes integer,
  timer_status text not null default 'not_started'
    check (timer_status in ('not_started', 'running', 'ended')),
  timer_started_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists leaders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  name text not null,
  role_label text not null
);

create index if not exists leaders_project_id_idx on leaders (project_id);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  leader_id uuid not null references leaders (id) on delete cascade,
  started_at timestamptz,
  ended_at timestamptz,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'completed')),
  question_count integer not null default 0,
  -- One session per leader per project.
  unique (project_id, leader_id)
);

create index if not exists sessions_project_id_idx on sessions (project_id);
create index if not exists sessions_leader_id_idx on sessions (leader_id);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  sender text not null
    check (sender in ('assistant', 'leader')),
  content text not null,
  question_number integer not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_session_id_idx on messages (session_id);

create table if not exists synthesis (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  generated_at timestamptz not null default now(),
  content jsonb not null default '{}'::jsonb
);

create index if not exists synthesis_project_id_idx on synthesis (project_id);
