"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { setInterviewSessionCookie } from "@/lib/interview-session-cookie";

export type StartSessionResult =
  | { error: string; alreadyCompleted?: false }
  | { alreadyCompleted: true; error?: undefined }
  | undefined;

export async function startInterviewSession(
  projectId: string,
  leaderId: string
): Promise<StartSessionResult> {
  if (!projectId || !leaderId) {
    return { error: "Missing project or leader." };
  }

  const supabase = createAdminClient();

  const { data: leader, error: leaderError } = await supabase
    .from("leaders")
    .select("id")
    .eq("id", leaderId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (leaderError) throw new Error(leaderError.message);
  if (!leader) {
    return { error: "That participant could not be found for this project." };
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("access_mode, status")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) throw new Error(projectError.message);
  if (!project || project.status !== "active") {
    return { error: "This interview is not currently available." };
  }

  const { data: existing, error: existingError } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("project_id", projectId)
    .eq("leader_id", leaderId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (existing) {
    if (existing.status === "completed") {
      return { alreadyCompleted: true };
    }
    await setInterviewSessionCookie(projectId, existing.id);
    redirect(`/interview/${projectId}/session`);
  }

  const isOpenMode = project.access_mode === "open";
  const nowIso = new Date().toISOString();

  const { data: created, error: createError } = await supabase
    .from("sessions")
    .insert({
      project_id: projectId,
      leader_id: leaderId,
      status: isOpenMode ? "in_progress" : "not_started",
      started_at: isOpenMode ? nowIso : null,
    })
    .select("id")
    .single();
  if (createError) throw new Error(createError.message);

  await setInterviewSessionCookie(projectId, created.id);
  redirect(`/interview/${projectId}/session`);
}
