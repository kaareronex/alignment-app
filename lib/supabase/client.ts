import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client using the public anon key. Safe to call from client
 * components. RLS + the leader-facing RPC functions (see
 * supabase/migrations/20260820000001_rls_policies.sql) are what actually
 * restrict what this client can read/write — the anon key itself grants
 * no table access.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
