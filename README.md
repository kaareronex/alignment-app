# Groundwork

An AI-interview app that surfaces where a team is - and is not - aligned.
Participants are interviewed individually by an AI interviewer; their
answers are synthesised into themed findings, a cross-cutting list of
priorities and a facilitator workshop plan.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS, Supabase
(Postgres + RLS + Realtime) and an OpenAI-compatible model endpoint.

## Documentation

- [SETUP.md](SETUP.md) - install, environment variables, Supabase and Vercel setup.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - data model, routes, security model, AI layer, known limitations.
- [CLAUDE.md](CLAUDE.md) - working notes and conventions for AI coding assistants.

## Quick start

```bash
npm install
# create .env.local with the variables listed in SETUP.md
npm run dev
```

Open <http://localhost:3000/admin>. On a fresh database the first password
you submit becomes the admin password, so set it immediately.
