# CLAUDE.md

## What this is

A **leader-alignment interview app** built in a Danish management-consulting
context (Implement Consulting Group). Leaders are interviewed individually, and
their responses are synthesised to surface where a leadership team is — and is
not — aligned.

## Stack

- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Linting:** ESLint (`eslint-config-next`)
- **Database:** Supabase
- **Hosting:** Vercel
- **AI:** API calls to Claude power both the interview logic (conducting the
  interview) and the synthesis (aggregating and analysing responses across
  leaders).

## Access model

- **No login system.** There are no user accounts, passwords, or auth flows.
- Each leader accesses their interview via a **unique magic link**. The link
  itself identifies the participant, so treat these links as secrets and scope
  all data access to the token carried in the link.

## Conventions

- App Router under `app/`, TypeScript throughout, Tailwind utility styling.
- Keep secrets (Supabase keys, Claude API key) in environment variables — never
  commit them. `.env*` is gitignored.

<!-- Next.js agent rules (auto-maintained by `next dev`). -->
@AGENTS.md
