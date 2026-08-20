"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdminSession } from "@/lib/admin-session";
import { broadcastProjectTimerStarted } from "@/lib/realtime-broadcast";
import { DEFAULT_FRAMING_DEFINITIONS } from "./framing-defaults";
import type { Leader } from "./types";

export async function createProject() {
  await requireAdminSession();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      name: "New project",
      status: "draft",
      framing_definitions: DEFAULT_FRAMING_DEFINITIONS,
      max_questions: 8,
      access_mode: "lobby",
      time_limit_enabled: false,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  redirect(`/admin/${data.id}`);
}

export async function deleteProject(projectId: string) {
  await requireAdminSession();

  if (!projectId) {
    throw new Error("Missing projectId");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}

type SaveProjectInput = {
  name: string;
  strategy_context: string;
  session_purpose: string;
  framing_definitions: Record<string, string>;
  max_questions: number;
  access_mode: "lobby" | "open";
  time_limit_enabled: boolean;
  time_limit_minutes: number | null;
  leaders: { id: string | null; name: string; role_label: string }[];
  removedLeaderIds: string[];
};

export async function saveProject(
  projectId: string,
  input: SaveProjectInput
): Promise<{ leaders: Leader[] }> {
  await requireAdminSession();

  const supabase = createAdminClient();

  const { error: projectError } = await supabase
    .from("projects")
    .update({
      name: input.name,
      strategy_context: input.strategy_context,
      session_purpose: input.session_purpose,
      framing_definitions: input.framing_definitions,
      max_questions: input.max_questions,
      access_mode: input.access_mode,
      time_limit_enabled: input.time_limit_enabled,
      time_limit_minutes: input.time_limit_enabled
        ? input.time_limit_minutes
        : null,
    })
    .eq("id", projectId);
  if (projectError) throw new Error(projectError.message);

  const toUpdate = input.leaders.filter((l) => l.id);
  const toInsert = input.leaders.filter((l) => !l.id);

  for (const leader of toUpdate) {
    const { error } = await supabase
      .from("leaders")
      .update({ name: leader.name, role_label: leader.role_label })
      .eq("id", leader.id as string);
    if (error) throw new Error(error.message);
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("leaders").insert(
      toInsert.map((l) => ({
        project_id: projectId,
        name: l.name,
        role_label: l.role_label,
      }))
    );
    if (error) throw new Error(error.message);
  }

  if (input.removedLeaderIds.length > 0) {
    const { error } = await supabase
      .from("leaders")
      .delete()
      .in("id", input.removedLeaderIds);
    if (error) throw new Error(error.message);
  }

  const { data: freshLeaders, error: fetchError } = await supabase
    .from("leaders")
    .select("id, name, role_label")
    .eq("project_id", projectId)
    .order("name");
  if (fetchError) throw new Error(fetchError.message);

  revalidatePath(`/admin/${projectId}`);
  revalidatePath("/admin");

  return { leaders: freshLeaders ?? [] };
}

export async function updateProjectStatus(
  projectId: string,
  status: "draft" | "active" | "closed"
) {
  await requireAdminSession();

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", projectId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/${projectId}`);
  revalidatePath(`/admin/${projectId}/status`);
  revalidatePath("/admin");
}

export async function startProjectTimer(projectId: string) {
  await requireAdminSession();

  const startedAt = new Date().toISOString();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("projects")
    .update({ timer_status: "running", timer_started_at: startedAt })
    .eq("id", projectId);
  if (error) throw new Error(error.message);

  await broadcastProjectTimerStarted(projectId, startedAt);

  revalidatePath(`/admin/${projectId}/status`);
}
