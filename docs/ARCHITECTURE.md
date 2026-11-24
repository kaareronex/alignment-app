# Architecture

Written from the code as it stands. File paths are relative to the repo root.
For installation and configuration see [SETUP.md](../SETUP.md).

## Overview

Groundwork runs structured one-to-one interviews with an AI interviewer, then
synthesises all completed interviews of a project into per-theme findings, a
list of priorities and a facilitator workshop plan.

Roles:

- **Admin** - one shared password; full access to everything under `/admin`.
- **Consultant** - anyone holding a project's access link
  (`/project/[accessToken]`); full admin rights over that single project.
- **Participant** - anyone with the interview link
  (`/interview/[projectId]`); picks their name from a list and is interviewed.
  No login.

Stack: Next.js 16 App Router (React 19, TypeScript), Tailwind CSS 4,
Supabase (Postgres, RLS, Realtime Broadcast), `openai` SDK against an
OpenAI-compatible endpoint, `zod` for structured output schemas, `jose` (JWT)
and `bcryptjs` for the admin session.

## Data model

Defined in `supabase/migrations/`. All tables have RLS enabled.

| Table | Purpose | Key columns |
|---|---|---|
| `app_settings` | Single row (enforced by a unique `singleton` column) holding the bcrypt hash of the admin password | `admin_password_hash` |
| `projects` | One interview round | `name`, `status` (`draft`/`active`/`closed`), `strategy_context`, `session_purpose`, `framing_definitions` (jsonb array of `{id, label, description}`, 2-6 items; shown as **Themes** in the UI), `max_questions`, `access_mode` (`lobby`/`open`), `time_limit_enabled`/`time_limit_minutes`, `timer_status`/`timer_started_at` (lobby timer), `workshop_duration_minutes` (default 90), `access_token` (unique, 64 hex chars) |
| `leaders` | The people invited to a project (shown as **participants**) | `project_id`, `name`, `role_label` |
| `sessions` | One interview per participant per project (`unique(project_id, leader_id)`) | `status` (`not_started`/`in_progress`/`completed`), `question_count`, `started_at`/`ended_at`, `ended_reason`, `language_code` (BCP-47; null on pre-selection legacy sessions) |
| `messages` | The transcript | `session_id`, `sender` (`assistant`/`leader`), `content`, `question_number`, `dimension_id` (which theme an assistant message addressed), `created_at` |
| `synthesis` | At most one row per project, always fully overwritten on regenerate | `content` (jsonb), `generated_at` |

Everything below `projects` cascades on delete. Naming note: the table and
column names still say `leader` (`leaders`, `leader_id`, `leaderName`, ...)
while the UI says "participant"; this is deliberate - it avoids touching
working RLS policies and RPC functions over a wording change. Likewise
`framing_definitions` is shown as "Themes".

`synthesis.content` shape (`app/admin/types.ts`): `sessionCount`,
`dimensions[]` (label, `keyPoint`, `narrative`, `alignment` or null,
`participantBases[]`), `topPriorities[]`, and `workshopPlan` (`totalMinutes`,
opening framing and minutes, `agendaItems[]` with `shortTitle`, priority
text, discussion prompt, hypothesis, exercise and minutes, closing template
and minutes).

## Routes

| Route | Purpose | Gate |
|---|---|---|
| `/` | Still the unmodified create-next-app scaffold | none |
| `/admin/login` | Login; on an empty `app_settings` it sets the password instead | none |
| `/admin` | Project list, create, delete | admin session |
| `/admin/settings` | Change admin password | admin session |
| `/admin/[projectId]` | Edit project: name, context, purpose, themes, max questions, access mode, time limit, participants; shows participant link and consultant access link (with "Regenerate link") | admin session |
| `/admin/[projectId]/status` | Project status, lobby start-timer, per-participant status and "Reset" | admin session |
| `/admin/[projectId]/results` | Generate/regenerate synthesis, workshop length, staleness warnings, results, markdown export | admin session |
| `/admin/[projectId]/results/present` | Facilitator presentation view | admin session |
| `/project/[accessToken]` (+ `/status`, `/results`, `/results/present`) | The same four pages for one project, reached by token | token |
| `/interview/[projectId]` | Participant landing: intro, name picker, language + connection + microphone check | none (capability: the project id) |
| `/interview/[projectId]/session` | The interview itself (lobby waiting screen, then conversation) | session cookie |
| `/api/ping` | Trivial 200 used by the connection check | none |

The four project pages share their logic: each `page.tsx` under
`/admin/[projectId]/...` and `/project/[accessToken]/...` is a thin wrapper
around a common `*-page-content.tsx` (`project-page-content.tsx`,
`status/status-page-content.tsx`, `results/results-page-content.tsx`,
`results/present/present-page-content.tsx`). The admin wrapper passes
`projectId`; the token wrapper first resolves the token to a project id
(`getProjectIdForToken`, 404 if none) and passes `accessToken` too. The
presence of `accessToken` switches internal links to `/project/<token>/...`
and hides admin-only UI.

Layouts: `app/admin/layout.tsx` (header + admin nav),
`app/project/layout.tsx` (header only - no link into `/admin`),
`app/interview/layout.tsx` (participant shell). The presentation view covers
the layout chrome with a fixed full-viewport overlay, because a nested route
cannot opt out of a parent layout.

## Security model

### No direct anon access to tables

The Supabase **anon key is public** (it ships to every browser) and identical
for every visitor, so RLS cannot key off a user. Instead:

- RLS is enabled on every table and **anon has no policies and no grants** -
  anon can read or write nothing directly.
- Participants' browsers need exactly two reads, exposed as
  `SECURITY DEFINER` Postgres functions (`set search_path = public`, `revoke
  all ... from public`, `grant execute ... to anon`), each **requiring a
  single project id**, so there is no way to list or dump other projects:
  - `get_project_public_state(p_project_id)` -> id, name, status, access mode,
    lobby timer state, time limit, max questions.
  - `get_leaders_for_project(p_project_id)` -> id, name, role label and
    `has_completed` (used to grey out finished participants in the picker).
- **Everything else - all writes, and all access to `sessions`, `messages`,
  `synthesis`, `app_settings` - goes through Server Actions/route handlers
  using the service-role client** (`lib/supabase/server.ts`, `server-only`).
  The browser never touches `sessions` or `messages`; each interview turn is
  a server round trip anyway because of the model call.
- The project id in the participant URL is a capability token: unguessable,
  and never listable because anon cannot enumerate projects.

### Admin session

`lib/admin-session.ts`. Login compares against the bcrypt hash in
`app_settings` and sets an `admin_session` cookie: an HS256 JWT
(`{role: "admin"}`, 30 days) signed with `ADMIN_SESSION_SECRET`, `httpOnly`,
`sameSite=lax`, `secure` in production. Two layers check it:

1. `proxy.ts` (Next 16's middleware convention, matcher `/admin/:path*`) does
   an optimistic cookie check on every request and redirects to
   `/admin/login`.
2. Every admin Server Action independently re-verifies, via
   `requireAdminSession()` or `requireProjectAccess()`. The proxy is a
   convenience, not the only gate.

On a database with no password row, the first submission to `/admin/login`
creates the password (minimum 8 characters).

### Participant interview session

`lib/interview-session-cookie.ts`: after picking a name, a cookie
`interview_session_<projectId>` holds the session id (`httpOnly`,
`sameSite=lax`, path-scoped to `/interview/<projectId>`, 24 h). The session
id is an unguessable uuid used as a bearer capability by the interview Server
Actions (`app/interview/actions.ts`).

### Project access links

`/project/[accessToken]` grants full admin rights to one project without a
login. `lib/project-access.ts`:

- `requireProjectAccess(projectId, accessToken?)` - with no token, falls back
  to `requireAdminSession()`; with a token, queries
  `projects where id = projectId and access_token = accessToken` and throws
  if there is no match. It re-checks the **current** database value on every
  call, so a token valid for project A cannot act on project B, and
  regenerating the token revokes the old one immediately with no revocation
  list.
- Used by `saveProject`, `updateProjectStatus`, `startProjectTimer`,
  `resetParticipantSession`, `updateWorkshopDuration`, `generateSynthesis`
  (each takes an optional trailing `accessToken`).
- `regenerateProjectAccessToken` is **admin-only** on purpose (a token that
  could rotate itself would make revocation meaningless). `deleteProject`
  and `createProject` are also admin-only.
- `/project/*` is a separate route tree that `proxy.ts` never touches; a
  token gives no path to `/admin`, the project list or `/admin/settings`.

### Lobby timer over Broadcast

In `lobby` access mode participants wait until the admin starts a shared
timer. `startProjectTimer` writes `timer_status`/`timer_started_at` and calls
`broadcastProjectTimerStarted` (`lib/realtime-broadcast.ts`), which sends a
Realtime **Broadcast** message on the channel `project-timer:<projectId>`;
the waiting participant page subscribes to that channel. Broadcast on a
public channel was chosen over `postgres_changes` because the latter would
need a permissive anon `SELECT` policy on `projects`, reopening the
enumeration hole the RPC design closes. The channel topic, which embeds the
project id, is the access gate. In `open` mode each participant's timer
starts when they begin.

## The interview

`app/interview/actions.ts`:

- `startInterviewSession(projectId, leaderId, languageCode)` validates the
  participant belongs to the project and the project is `active`, creates the
  session (status `in_progress` immediately in open mode, `not_started` in
  lobby mode), stores `language_code`, sets the cookie and redirects to the
  session page. A completed participant gets "already completed".
- `advanceInterview(projectId, answerText?)` is the single turn function: it
  records the pending answer, checks the **server-side hard stops** (see
  below), builds the conversation from the `messages` table, calls
  `getNextInterviewTurn`, stores the assistant message with its
  `dimension_id`, updates `question_count`, and returns the message plus
  `touchedDimensionIds` and `currentDimensionId` for the progress bar. It
  is idempotent against a duplicate "get current question" call (React
  strict mode double-invokes effects).
- The participant UI (`app/interview/[projectId]/session/`) shows a segmented
  progress bar (one segment per theme; completed themes labelled in muted
  style, the current theme labelled prominently, upcoming themes unlabelled
  so what is still to come is never revealed), a 10-row answer box, an
  optional voice-input button (Web Speech API, language taken from the
  session's language), and an "End Interview" button with inline
  confirmation.

### How an interview ends - `sessions.ended_reason`

Ending is **always decided server-side**; the model is never trusted to end a
session on its own. In `advanceInterview`, before any model call:

| `ended_reason` | Trigger |
|---|---|
| `max_questions` | `question_count >= projects.max_questions` |
| `time_limit` | time limit enabled and the deadline has passed (lobby: from `timer_started_at`; open: from the session's `started_at`) |

After a model call:

| `ended_reason` | Trigger |
|---|---|
| `model_signal` | the model set `leaderWantsToStop` because the participant clearly asked to stop (honoured on top of, not instead of, the hard stops) |
| `leader_early_exit` | the participant clicked End Interview (`endInterviewEarly`) |

A final-question turn lets the model close with a closing remark instead of a
question; the following submit then trips the `max_questions` stop.

## The AI layer

Two files talk to the model provider; nothing else imports an AI SDK.

- `lib/ai/openai-client.ts` - shared client factory.
- `lib/ai/interview-model.ts` - `getNextInterviewTurn(input)`.
- `lib/ai/synthesis-model.ts` - `getSynthesis(input)`.

Swapping provider means editing those files, not their callers. Both keep the
same exported types and signatures.

### Client and provider

Uses the `openai` SDK's **Responses API** (`client.responses.create`) against
a configured OpenAI-compatible base URL (Azure APIM gateway). The gateway
authenticates with an `api-key` header. The SDK constructor requires a truthy
`apiKey` regardless of custom headers, so the key is passed both as `apiKey`
(producing an ignored `Authorization: Bearer`) and as `api-key` in
`defaultHeaders`. Models: `gpt-5.6-terra` for interviews (balanced
speed/cost, `reasoning.effort: "low"`), `gpt-5.6-sol` for synthesis (flagship,
`reasoning.effort: "high"`).

### Structured output

Both paths request a JSON schema built from a `zod` schema via
`zodTextFormat`. Calls use `create()` rather than `parse()` so the
**completion status can be checked before parsing**: any
`response.status !== "completed"` (for example `incomplete_details.reason` of
`max_output_tokens`) throws a descriptive error rather than an opaque JSON
error. `max_output_tokens` counts reasoning tokens too, so the ceilings are
generous (8192 interview, 32768 synthesis).

Interview schema fields: `leadIn` (optional short acknowledgement),
`nextQuestion` (required), `isClosingRemark`, `leaderWantsToStop`,
`dimensionAddressed` (theme id or null). The interview path parses by hand
and validates leniently where harmless: an unrecognised `dimensionAddressed`
becomes `null` instead of failing the turn. It also **validates that
`nextQuestion` really is a question** (contains a `?`, `？` or `؟`) unless
`isClosingRemark`, and **retries the model call once** if not, then throws.
Synthesis parses atomically with `format.$parseRaw`.

### Prompt caching (interview)

The system message is sent as two content parts: the stable part (role,
language, strategy context, purpose, themes, conduct rules) carries
`prompt_cache_breakpoint: {mode: "explicit"}`; the per-turn **pacing** part
(question count, final-question flag, time remaining) follows uncached. The
request sets `prompt_cache_options: {mode: "explicit", ttl: "30m"}` (a
`gpt-5.6`-family feature). Cache usage appears in
`response.usage.input_tokens_details` (`cache_write_tokens`, `cached_tokens`);
caching is best-effort, so an occasional miss is normal. Synthesis does not
use caching (one call per project).

### Language

The participant picks the interview language up front (list in
`lib/languages.ts`); it is stored on the session and injected into the system
prompt so the interviewer speaks it from the first question, still following
the participant if they switch. Sessions with a null `language_code` fall
back to detect-from-first-answer. Synthesis output is always English (UK),
whatever language the interviews were in.

### Retained Anthropic implementation

`lib/ai/interview-model.anthropic.ts` and `lib/ai/synthesis-model.anthropic.ts`
are the pre-migration implementations (Anthropic SDK, `messages.create` with
`zodOutputFormat`, `cache_control: {type: "ephemeral"}` on the stable system
block, `stop_reason` checks). They are **not imported anywhere**, are kept
only for rollback, and need `ANTHROPIC_API_KEY`. To restore one, rename it
over the active file; the exported types and signatures match. They still
compile as part of the build, which is why `@anthropic-ai/sdk` remains a
dependency.

## Synthesis

`generateSynthesis` in `app/admin/actions.ts` (admin or token):

1. Loads completed sessions and transcripts.
2. **Anonymity is enforced here, deterministically, before the model sees
   anything**: a `role_label` is only named if two or more participants in
   this run share it; a unique role becomes "Other participants". Names are
   never sent; the model sees opaque refs ("Participant N") and role tags.
3. Calls `getSynthesis`, which returns per-theme key point, narrative,
   alignment level (`consensus`/`partial`/`divided` - judged on convergence of
   substantive positions, not sentiment), a neutral non-verbatim paraphrase per
   contributing participant, 3-6 priorities, and a workshop plan.
4. **Alignment is hidden below 3 completed sessions** (the indicator is
   meaningless on too little data).
5. **Workshop time is computed deterministically**, not by the model: opening
   (8%, clamped 5-15 min) and closing (12%, clamped 10-20 min) take their
   share of `workshop_duration_minutes`; the remainder is split across agenda
   items weighted by how contested each priority's primary theme is
   (consensus 1, partial 2, divided 3), with rounding drift corrected on the
   largest item.
6. Fully overwrites the single `synthesis` row.

`hasCurrentShapeSynthesis` (`app/admin/[projectId]/results/synthesis-shape.ts`)
treats a stored row with an older content shape as stale and refuses to render
it; the results page also shows non-blocking "may be out of date" warnings
when more sessions have completed, or the workshop length has changed, since
generation.

### Facilitator view

`/admin/[projectId]/results/present` (and the token equivalent) is a
projector-oriented presentation: an opening screen of priorities, one screen
per theme (name, key point, alignment indicator only), the workshop's opening
framing, one screen per agenda item (short title, allotted time, discussion
prompt visible), and a closing capture template. The narrative and anonymised
paraphrases, and per agenda item the full priority statement, hypothesis and
exercise, stay **hidden until the facilitator explicitly reveals them** and
re-hide on every navigation (the hypothesis must not sit next to the open
question). Arrow keys navigate; Enter/Space reveal. Each agenda screen has a
Start/Pause countdown that never auto-advances. Timer durations come from the
stored synthesis, not live from the project, hence the staleness warning.

## Known limitations

- **No automated tests.** Behaviour has been checked by hand and by
  throwaway scripts. Security-relevant paths (token scoping, revocation,
  `/admin` gating) were verified by attempting the bypasses, but nothing
  re-runs those checks.
- **Synthesis function duration is unset** and synthesis can take 40-120 s;
  see SETUP.md before deploying.
- **First-run admin password claim:** until a password exists, the first
  visitor to `/admin/login` sets it.
- **Single shared admin password**, no per-user accounts or audit log. A
  consultant access link is full edit rights over its project (except
  delete) and is valid until regenerated.
- **Capability URLs:** the participant link (project id) and consultant link
  are unguessable but not revocable per person; anyone with the link has the
  access. Participant identity is a name picked from a list, not verified.
- **Dormant Anthropic files** still compile and keep an unused dependency.
- **Prompt caching** options are OpenAI Responses API features specific to
  the `gpt-5.6` family; another provider will need a different approach.
- **Model output quality varies by language**; strongest in English and major
  European languages. Voice input depends on browser Web Speech API support.
- Root `/` is still the create-next-app scaffold.
- `npm audit` reports vulnerabilities in transitive/framework dependencies
  (Next.js, sharp, js-yaml) that predate this documentation; review and
  upgrade before a public deployment.
