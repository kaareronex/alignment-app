import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Admin client using the service role key. This key bypasses RLS
 * entirely, so this client must only ever be used in server components,
 * route handlers, or other server-only code — never sent to or
 * instantiated in browser code. The `server-only` import above makes any
 * accidental client-bundle import fail at build time.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
