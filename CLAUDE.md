# CLAUDE.md

## What this is

A **leader-alignment interview app** built in a Danish management-consulting
context (Implement Consulting Group). Leaders are interviewed individually by
an AI interviewer, and their responses will be synthesised (not built yet) to
surface where a leadership team is — and is not — aligned.

## Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Linting:** ESLint (`eslint-config-next`)
- **Database:** Supabase (Postgres + RLS)
- **Hosting:** Vercel (not yet deployed there — local dev only so far)
- **AI:** Anthropic Claude (`claude-opus-4-8`), called only from
  `lib/ai/interview-model.ts` — the single file that talks to the provider
  directly, so swapping providers (e.g. an Azure-hosted model) later means
  editing that one file, not the callers. **The interview-conducting side is
  built; the synthesis side is not.**

## Access model

- **Leaders:** no login. A shared link per project (`/interview/[projectId]`);
  the leader picks their name from an admin-populated dropdown (no free
  text). The project id in the URL is the only "secret" — treat it as a
  capability token.
- **Admin:** a single shared password (bcrypt-hashed in `app_settings`,
  changeable from `/admin/settings`), session via a signed cookie
  (`lib/admin-session.ts`). Every `/admin/*` route is gated by `proxy.ts`
  (Next 16's middleware convention) doing an optimistic cookie check on
  every request.
- **RLS note:** the anon key has zero direct table grants. Leader-facing
  reads go through two `SECURITY DEFINER` RPCs scoped to one project id
  (`get_project_public_state`, `get_leaders_for_project`); `sessions` and
  `messages` are never touched by the anon key at all — every read/write to
  them goes through a Server Action using the service-role client, since the
  interview loop needs a server round-trip for the Claude call anyway.

## Current state (as of 2026-08-21)

### Built and verified end-to-end

All three migrations in `supabase/migrations/` have been **run against the
live Supabase database** (not just written), via a temporary direct
Postgres connection each time — there's no standing DDL access from the app
itself.

- **Database layer:** full schema (`app_settings`, `projects`, `leaders`,
  `sessions`, `messages`, `synthesis`) + RLS + the two Supabase client
  helpers (`lib/supabase/client.ts` anon, `lib/supabase/server.ts` service
  role).
- **Admin:** project list/create/delete, full project edit form (strategy
  context, session purpose, framing dimensions, max questions, access mode,
  time limit, leaders CRUD), project status control (draft/active/closed),
  a minimal `/admin/[projectId]/status` page with a lobby "Start timer"
  button, and the password gate/settings described above.
- **Leader-facing landing + lobby:** name picker, session create/resume
  logic, lobby waiting screen synced via Supabase Realtime **Broadcast**
  (deliberately not `postgres_changes`, which would have needed a
  permissive anon SELECT policy on `projects` and reopened the enumeration
  hole the RPC design closes), open-mode immediate start, live countdown
  when a time limit is set.
- **AI-driven interview conversation** (`lib/ai/interview-model.ts` +
  `app/interview/actions.ts`): one question at a time, model decides
  dimension order and when to push back on a vague answer, via Claude
  structured outputs (`client.messages.parse` + `zodOutputFormat`) — never
  free-text parsing. Every turn returns `{ message, leaderWantsToStop,
  dimensionAddressed }`. Session ending is **always server-decided**: hard
  stops on `max_questions`/time limit are checked before ever calling the
  model; the model's own `leaderWantsToStop` signal is honoured on top of,
  not instead of, those; and the leader has an "End interview early" button.
  `sessions.ended_reason` (`model_signal` / `leader_early_exit` /
  `max_questions` / `time_limit`) records which one fired, for later
  reporting.
- **Flexible framing dimensions:** 2–6 per project, each an admin-editable
  `{id, label, description}` — no longer fixed to 4 named fields. A
  segmented progress bar on the session page fills as dimensions get
  touched on, without ever showing leaders a question count or countdown.

### Not yet built

- **Synthesis generation** — aggregating a project's leader responses into
  the themed output (`uenigheder`/`konsensus`/etc. per the original plan).
  Nothing exists for this yet: no prompt, no server action, no `synthesis`
  row ever gets written.
- **`/admin/[projectId]/results` page** — viewing the synthesis once it
  exists.
- **Export** — markdown/text download of the results.
- **Live leader-progress view** on `/admin/[projectId]/status` — the
  original plan called for seeing which leaders are in progress/done and
  how many questions each has reached; only the lobby timer control exists
  there today.
- **Azure model swap** — not started, and nothing in this repo references
  Azure yet. The single-abstraction design in `lib/ai/interview-model.ts`
  exists specifically to make this a one-file change when it happens.
- Root route `/` is still the unmodified `create-next-app` scaffold.
- Not deployed anywhere — everything so far has been run and tested via
  local `next dev`.

## Conventions

- App Router under `app/`, TypeScript throughout, Tailwind utility styling.
- Keep secrets (Supabase keys, Claude API key, admin session secret) in
  environment variables — never commit them. `.env*` is gitignored. See
  `README.md` for the full list of required env vars.
- All UI copy is English (UK), including AI-generated interview copy.

<!-- Next.js agent rules (auto-maintained by `next dev`). -->
@AGENTS.md
