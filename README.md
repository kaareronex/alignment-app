This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Environment variables

This project requires a `.env.local` file (never committed — see `.gitignore`) with:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key. Safe to expose to the browser; RLS restricts what it can actually do (see `supabase/migrations/`).
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key. **Server-only secret** — bypasses RLS entirely. Never prefix with `NEXT_PUBLIC_`, never import `lib/supabase/server.ts` from client components. Used by `lib/supabase/server.ts` for admin operations (server components / route handlers only).
- `ADMIN_SESSION_SECRET` — random secret used to sign the `/admin` login session cookie (see `lib/admin-session.ts`). **Server-only secret.** Generate a fresh one per environment, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Rotating it invalidates all existing admin sessions.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
