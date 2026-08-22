"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdminSession } from "@/lib/admin-session";
import { broadcastProjectTimerStarted } from "@/lib/realtime-broadcast";
import {
  DEFAULT_FRAMING_DIMENSIONS,
  MIN_DIMENSIONS,
  MAX_DIMENSIONS,
  type FramingDimension,
} from "./framing-defaults";
import type { Leader, SynthesisContent } from "./types";
import { getSynthesis, type SynthesisSessionInput } from "@/lib/ai/synthesis-model";

export async function createProject() {
  await requireAdminSession();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      name: "New project",
      status: "draft",
      framing_definitions: DEFAULT_FRAMING_DIMENSIONS,
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
  framing_definitions: FramingDimension[];
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

  if (
    input.framing_definitions.length < MIN_DIMENSIONS ||
    input.framing_definitions.length > MAX_DIMENSIONS
  ) {
    throw new Error(
      `A project must have between ${MIN_DIMENSIONS} and ${MAX_DIMENSIONS} framing dimensions.`
    );
  }

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

export async function generateSynthesis(projectId: string) {
  await requireAdminSession();

  const supabase = createAdminClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("strategy_context, session_purpose, framing_definitions")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) throw new Error(projectError.message);
  if (!project) throw new Error("Project not found.");

  const framingDimensions = project.framing_definitions as FramingDimension[];

  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select("id, leader_id, leaders(role_label)")
    .eq("project_id", projectId)
    .eq("status", "completed");
  if (sessionsError) throw new Error(sessionsError.message);
  if (!sessions || sessions.length === 0) {
    throw new Error("No completed sessions yet - nothing to synthesise.");
  }

  type SessionRow = {
    id: string;
    leader_id: string;
    leaders: { role_label: string } | { role_label: string }[] | null;
  };
  const sessionRows = sessions as unknown as SessionRow[];

  // Deterministic anonymity rule, computed server-side: a role_label is
  // only safe to name if 2+ leaders in THIS run's completed-session set
  // share it exactly. Anyone with a unique role is folded into a generic
  // bucket before the model ever sees anything.
  const roleLabelOf = (row: SessionRow): string => {
    const leader = Array.isArray(row.leaders) ? row.leaders[0] : row.leaders;
    return leader?.role_label ?? "Unknown role";
  };
  const roleCounts = new Map<string, number>();
  for (const row of sessionRows) {
    const role = roleLabelOf(row);
    roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
  }
  const OTHER_LEADERS_TAG = "Other leaders";
  const roleTagByLeaderId = new Map<string, string>();
  for (const row of sessionRows) {
    const role = roleLabelOf(row);
    const safe = (roleCounts.get(role) ?? 0) >= 2;
    roleTagByLeaderId.set(row.leader_id, safe ? role : OTHER_LEADERS_TAG);
  }

  // Friendly, opaque refs (never the raw leader uuid) are what the model
  // actually sees and echoes back - keeps the report readable while
  // staying anonymous. Order is stable (by leader_id) so refs don't shuffle.
  const orderedLeaderIds = sessionRows.map((r) => r.leader_id).sort();
  const refByLeaderId = new Map<string, string>(
    orderedLeaderIds.map((id, i) => [id, `Leader ${i + 1}`])
  );

  const sessionIds = sessionRows.map((r) => r.id);
  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("session_id, sender, content, dimension_id, created_at")
    .in("session_id", sessionIds)
    .order("created_at", { ascending: true });
  if (messagesError) throw new Error(messagesError.message);

  const messagesBySession = new Map<
    string,
    { sender: "assistant" | "leader"; content: string; dimensionId: string | null }[]
  >();
  for (const m of messages ?? []) {
    const list = messagesBySession.get(m.session_id) ?? [];
    list.push({
      sender: m.sender as "assistant" | "leader",
      content: m.content,
      dimensionId: m.dimension_id,
    });
    messagesBySession.set(m.session_id, list);
  }

  const roleTagByRef = new Map(
    sessionRows.map((row) => [
      refByLeaderId.get(row.leader_id)!,
      roleTagByLeaderId.get(row.leader_id) ?? OTHER_LEADERS_TAG,
    ])
  );

  const synthesisSessions: SynthesisSessionInput[] = sessionRows.map((row) => ({
    leaderId: refByLeaderId.get(row.leader_id)!,
    roleTag: roleTagByLeaderId.get(row.leader_id) ?? OTHER_LEADERS_TAG,
    messages: messagesBySession.get(row.id) ?? [],
  }));

  const output = await getSynthesis({
    strategyContext: project.strategy_context ?? "",
    sessionPurpose: project.session_purpose ?? "",
    framingDimensions,
    sessions: synthesisSessions,
  });

  const leaderIds = synthesisSessions.map((s) => s.leaderId);
  const dimensionLabelById = new Map(
    framingDimensions.map((d) => [d.id, d.label] as const)
  );

  const content: SynthesisContent = {
    sessionCount: sessionRows.length,
    topPriorities: output.topPriorities,
    dimensions: framingDimensions.map((dim) => {
      const dimOutput = output.dimensions.find((d) => d.dimensionId === dim.id);
      if (!dimOutput) {
        throw new Error(
          `Synthesis model did not return a dimension for "${dim.label}".`
        );
      }

      // Deterministic aggregation, not left to the model: group each
      // leader's position by their (already-anonymised) role tag.
      const breakdownByRole = new Map<
        string,
        { aligned: number; mixed: number; concerned: number; not_addressed: number }
      >();
      for (const leaderId of leaderIds) {
        const roleTag = roleTagByRef.get(leaderId) ?? OTHER_LEADERS_TAG;
        const position = dimOutput.positions.find((p) => p.leaderId === leaderId);
        const category = position?.category ?? "not_addressed";
        const entry =
          breakdownByRole.get(roleTag) ??
          { aligned: 0, mixed: 0, concerned: 0, not_addressed: 0 };
        entry[category] += 1;
        breakdownByRole.set(roleTag, entry);
      }

      return {
        dimensionId: dim.id,
        label: dimensionLabelById.get(dim.id) ?? dim.label,
        narrative: dimOutput.narrative,
        breakdown: Array.from(breakdownByRole.entries()).map(
          ([roleLabel, counts]) => ({
            roleLabel,
            ...counts,
            total: counts.aligned + counts.mixed + counts.concerned + counts.not_addressed,
          })
        ),
      };
    }),
  };

  const generatedAt = new Date().toISOString();

  const { data: existing, error: existingError } = await supabase
    .from("synthesis")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (existing) {
    const { error } = await supabase
      .from("synthesis")
      .update({ content, generated_at: generatedAt })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("synthesis")
      .insert({ project_id: projectId, content, generated_at: generatedAt });
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/admin/${projectId}/results`);
}
