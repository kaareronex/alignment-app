# Setup

How to run Groundwork on a new machine, and deploy it, from this repo alone.
Nothing here contains a secret value - you create each one yourself.

## 1. Prerequisites

- **Node.js 20.9 or newer** (Next.js 16's minimum; development has used the
  current Node release). npm ships with it.
- **Git**.
- A **Supabase** account (free tier is enough to start).
- Access to an **OpenAI-compatible model endpoint** and an API key for it
  (see [AI provider](#ai-provider)).
- A **Vercel** account, only if you are deploying.

## 2. Clone and install

```bash
git clone <repository-url> alignment-app
cd alignment-app
npm install
```

`npm install` also installs `@anthropic-ai/sdk`. It is only used by two
retained, unimported rollback files (`lib/ai/*.anthropic.ts`); see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#the-ai-layer).

## 3. Environment variables

Create `.env.local` in the repo root (it is gitignored - `.env*` is ignored
entirely, so never commit one). On Vercel, set the same names in
*Project Settings -> Environment Variables*.

| Variable | What it is | Exposure | Where to get it |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Public (bundled into browser code) | Supabase dashboard -> Project Settings -> API -> Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key. Has **no direct table access** (RLS denies everything; only two RPC functions are callable) | Public | Same page -> Project API keys -> `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key. **Bypasses RLS entirely** | **Server-only secret** | Same page -> Project API keys -> `service_role` |
| `ADMIN_SESSION_SECRET` | Random secret that signs the `/admin` session cookie (HS256 JWT). Rotating it logs every admin out | **Server-only secret** | Generate your own: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` - use a different value per environment |
| `OPENAI_API_KEY` | Key for the model endpoint configured in `lib/ai/openai-client.ts`. Sent as an `api-key` header | **Server-only secret** | From whoever operates the model endpoint |
| `NEXT_PUBLIC_APP_URL` | This deployment's own base URL, no trailing slash, e.g. `http://localhost:3000` locally or your production domain. Used to build the participant interview link and the consultant access link shown on `/admin/[projectId]` | Public | You choose it. Deliberately explicit rather than Vercel's `VERCEL_URL`, which is the per-deployment URL, not the stable domain people are sent |
| `ANTHROPIC_API_KEY` | **Optional.** Only read by the dormant `*.anthropic.ts` rollback files. Not needed unless you restore them | Server-only secret | Anthropic console |

Never prefix a secret with `NEXT_PUBLIC_`, and never import
`lib/supabase/server.ts` from a client component (it carries `server-only`,
so the build fails if you try).

## 4. Supabase

1. **Create a project.** Pick a **region close to your users and to your
   Vercel functions' region** - every interview turn does several database
   round trips plus a model call, so distance adds directly to the latency
   participants feel. The region cannot be changed later (you would have to
   migrate). Choose a strong database password and keep it; you need it to
   apply migrations.
2. **Copy the three keys and the URL** into your environment (table above).
3. **Apply the migrations** in `supabase/migrations/`, **in filename
   order**. The timestamp prefix is the order:

   1. `20260820000000_init_schema.sql` - tables.
   2. `20260820000001_rls_policies.sql` - enables RLS everywhere, creates the two participant-facing RPC functions.
   3. `20260821000000_flexible_dimensions_and_progress.sql` - themes become a flexible array; `messages.dimension_id`; `sessions.ended_reason`.
   4. `20260823000000_workshop_duration.sql` - `projects.workshop_duration_minutes` (default 90).
   5. `20260824000000_leaders_completion_status.sql` - drops and recreates `get_leaders_for_project` with a `has_completed` column.
   6. `20260831000000_session_language.sql` - `sessions.language_code`.
   7. `20260916000000_project_access_token.sql` - `projects.access_token` (unique, backfilled), used by `/project/[accessToken]`.

   Ways to apply them: paste each file into the Supabase **SQL editor** and run
   it, in order; or use the Supabase CLI (`supabase link` then
   `supabase db push`); or connect with `psql` to the database connection
   string (Project Settings -> Database) and run each file with `\i`.
   There is no standing DDL access from the app itself - the app never runs
   migrations.

   Migration 7 uses `gen_random_bytes`, which comes from the `pgcrypto`
   extension. Supabase enables it by default; if you get "function does not
   exist", run `create extension if not exists pgcrypto;` first.
4. **Realtime** needs no configuration: the lobby uses Broadcast on public
   channels (no table replication, no policies). Make sure Realtime is
   enabled for the project (it is by default).
5. There is nothing to seed. The first visit to `/admin/login` on an empty
   `app_settings` table asks you to choose the admin password; that
   submission creates it. **Do this immediately after the first deploy** -
   until a password exists, whoever reaches `/admin/login` first sets it.

## 5. Run locally

```bash
npm run dev          # http://localhost:3000
npm run lint
npx tsc --noEmit
npm run build && npm run start   # production build locally
```

Then open `/admin`, set the password, create a project, add participants,
set it to **Active**, and open the participant link
(`/interview/<projectId>`). The microphone button needs a browser with the
Web Speech API (Chromium-based browsers; support elsewhere varies) and
`localhost` or HTTPS.

## 6. Vercel

1. **Import the repo** and keep the framework preset as **Next.js**. No
   custom build or output settings are needed (`next build`).
2. **Environment variables:** add every variable from the table above for
   Production (and Preview if you use it). `NEXT_PUBLIC_*` values are inlined
   at build time, so **redeploy after changing them**. Set
   `NEXT_PUBLIC_APP_URL` to the production domain.
3. **Function duration.** The interview page
   (`app/interview/[projectId]/session/page.tsx`) exports
   `maxDuration = 60`, which applies to the Server Actions it calls (each
   interview turn is one model call; observed turns take a few seconds).
   60 s is the maximum on Vercel's Hobby plan. **Synthesis generation has no
   `maxDuration` set** and is the slowest operation (roughly 40-120 s
   observed). Before relying on it in production, add
   `export const maxDuration = 300;` (needs a plan that allows it) to both
   `app/admin/[projectId]/results/page.tsx` and
   `app/project/[accessToken]/results/page.tsx`, because Server Actions
   inherit the limit from the page that invokes them, not from the actions
   file.
4. **Region:** set the function region (Project Settings -> Functions) near
   your Supabase region.
5. Deploy, open `/admin/login`, and set the admin password.

## AI provider

All model calls go through two files, `lib/ai/interview-model.ts` and
`lib/ai/synthesis-model.ts`, using the shared client in
`lib/ai/openai-client.ts`. That client is hardcoded to a specific
OpenAI-compatible base URL and authenticates with an `api-key` header rather
than the default `Authorization: Bearer`. To use a different provider you
change `BASE_URL` and the auth header in `openai-client.ts` and the model
names (`MODEL` constants) in the two model files; callers do not change. Note
that prompt caching in the interview path uses OpenAI Responses API options
(`prompt_cache_options`) that other providers may not support - see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#the-ai-layer).
