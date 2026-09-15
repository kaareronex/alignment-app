import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdminSession } from "@/lib/admin-session";

/**
 * Dual-mode authorization for project-management Server Actions: either a
 * valid admin session (the /admin/* surface, for the real admin) or a valid
 * per-project access token (the /project/[accessToken]/* surface, for a
 * consultant given a link) - re-checked against the CURRENT
 * projects.access_token value on every single call, not just trusted
 * because the caller reached a gated page. That's what makes regenerating
 * the token revoke access immediately: an old token simply stops matching
 * the moment a new one is written, independently of whatever the route
 * itself already checked. Same defense-in-depth reasoning as every
 * existing action calling requireAdminSession() itself rather than trusting
 * proxy.ts's page-level redirect.
 *
 * Throws (never silently no-ops) on any mismatch - including a token valid
 * for a *different* project than the one being modified.
 */
export async function requireProjectAccess(
  projectId: string,
  accessToken?: string
): Promise<void> {
  if (!projectId) {
    throw new Error("Missing projectId");
  }

  if (!accessToken) {
    await requireAdminSession();
    return;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("access_token", accessToken)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error("This project link is no longer valid.");
  }
}

/** Resolves a /project/[accessToken] URL segment to a project id, or null if the token doesn't match any project. */
export async function getProjectIdForToken(
  accessToken: string
): Promise<string | null> {
  if (!accessToken) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .eq("access_token", accessToken)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}
