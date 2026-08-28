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
import type {
  Leader,
  SynthesisContent,
  SynthesisDimension,
  SynthesisAlignmentLevel,
} from "./types";
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
    .select(
      "strategy_context, session_purpose, framing_definitions, workshop_duration_minutes"
    )
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
  // only safe to name if 2+ participants in THIS run's completed-session set
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
  const OTHER_LEADERS_TAG = "Other participants";
  const roleTagByLeaderId = new Map<string, string>();
  for (const row of sessionRows) {
    const role = roleLabelOf(row);
    const safe = (roleCounts.get(role) ?? 0) >= 2;
    roleTagByLeaderId.set(row.leader_id, safe ? role : OTHER_LEADERS_TAG);
  }

  // Friendly, opaque refs (never the raw participant uuid) are what the model
  // actually sees and echoes back - keeps the report readable while
  // staying anonymous. Order is stable (by leader_id) so refs don't shuffle.
  const orderedLeaderIds = sessionRows.map((r) => r.leader_id).sort();
  const refByLeaderId = new Map<string, string>(
    orderedLeaderIds.map((id, i) => [id, `Participant ${i + 1}`])
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

  const synthesisSessions: SynthesisSessionInput[] = sessionRows.map((row) => ({
    leaderId: refByLeaderId.get(row.leader_id)!,
    roleTag: roleTagByLeaderId.get(row.leader_id) ?? OTHER_LEADERS_TAG,
    messages: messagesBySession.get(row.id) ?? [],
  }));

  const workshopDurationMinutes = project.workshop_duration_minutes;

  const output = await getSynthesis({
    strategyContext: project.strategy_context ?? "",
    sessionPurpose: project.session_purpose ?? "",
    framingDimensions,
    sessions: synthesisSessions,
    workshopDurationMinutes,
  });

  const dimensionLabelById = new Map(
    framingDimensions.map((d) => [d.id, d.label] as const)
  );

  // Below 3 completed sessions, an alignment read (consensus/partial/divided)
  // is statistically meaningless and inviting false confidence - hidden
  // entirely rather than shown on too little data. This is a project-wide
  // count, not per-dimension: even a dimension only 2 of 3 participants
  // addressed still gets hidden, since the gate is about the size of the
  // group being read, not how many happened to answer any one question.
  const enoughSessionsForAlignment = sessionRows.length >= 3;

  const dimensions: SynthesisDimension[] = framingDimensions.map((dim) => {
    const dimOutput = output.dimensions.find((d) => d.dimensionId === dim.id);
    if (!dimOutput) {
      throw new Error(
        `Synthesis model did not return a dimension for "${dim.label}".`
      );
    }

    return {
      dimensionId: dim.id,
      label: dimensionLabelById.get(dim.id) ?? dim.label,
      keyPoint: dimOutput.keyPoint,
      narrative: dimOutput.narrative,
      alignment: enoughSessionsForAlignment
        ? { level: dimOutput.alignmentLevel, summary: dimOutput.divergenceSummary }
        : null,
      participantBases: dimOutput.participantBases.map((p) => ({
        ref: p.leaderId,
        paraphrase: p.paraphrase,
      })),
    };
  });

  if (output.topPriorities.length !== output.workshopPlan.agendaItems.length) {
    throw new Error(
      "Synthesis model returned a different number of agenda items than top priorities."
    );
  }

  const dimensionByIdContent = new Map(dimensions.map((d) => [d.dimensionId, d]));

  // Deterministic time weighting, not left to the model: priorities tied to
  // a more divided dimension get more workshop time than ones the team is
  // already aligned on. Priorities with no single dimension (cross-cutting),
  // or generated when alignment itself is hidden (too few sessions), fall
  // back to the average weight across dimensions that do have a reading.
  const ALIGNMENT_WEIGHT: Record<SynthesisAlignmentLevel, number> = {
    consensus: 1,
    partial: 2,
    divided: 3,
  };

  function contestednessWeight(primaryDimensionId: string | null): number {
    if (primaryDimensionId) {
      const dim = dimensionByIdContent.get(primaryDimensionId);
      if (dim?.alignment) {
        return ALIGNMENT_WEIGHT[dim.alignment.level];
      }
    }
    const weights = dimensions
      .map((dim) => dim.alignment && ALIGNMENT_WEIGHT[dim.alignment.level])
      .filter((w): w is number => w != null);
    if (weights.length === 0) return 1;
    return weights.reduce((sum, w) => sum + w, 0) / weights.length;
  }

  const weights = output.topPriorities.map((p) =>
    contestednessWeight(p.primaryDimensionId)
  );
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const openingMinutes = Math.min(
    15,
    Math.max(5, Math.round(workshopDurationMinutes * 0.08))
  );
  const closingMinutes = Math.min(
    20,
    Math.max(10, Math.round(workshopDurationMinutes * 0.12))
  );
  const agendaMinutesTotal = Math.max(
    0,
    workshopDurationMinutes - openingMinutes - closingMinutes
  );

  const agendaMinutes = weights.map((w) =>
    Math.max(1, Math.round((agendaMinutesTotal * w) / totalWeight))
  );
  // Rounding can drift the sum off the target by a few minutes - correct it
  // on the largest item so the total still lands exactly on
  // workshopDurationMinutes, not a stale-looking near-miss.
  const roundingDrift =
    agendaMinutesTotal - agendaMinutes.reduce((sum, m) => sum + m, 0);
  if (agendaMinutes.length > 0) {
    const largestIndex = agendaMinutes.indexOf(Math.max(...agendaMinutes));
    agendaMinutes[largestIndex] = Math.max(
      1,
      agendaMinutes[largestIndex] + roundingDrift
    );
  }

  const content: SynthesisContent = {
    sessionCount: sessionRows.length,
    dimensions,
    topPriorities: output.topPriorities.map((p) => ({
      text: p.text,
      primaryDimensionId: p.primaryDimensionId,
    })),
    workshopPlan: {
      totalMinutes: workshopDurationMinutes,
      openingFraming: output.workshopPlan.openingFraming,
      openingMinutes,
      agendaItems: output.workshopPlan.agendaItems.map((item, i) => ({
        priorityText: output.topPriorities[i].text,
        discussionPrompt: item.discussionPrompt,
        hypothesis: item.hypothesis,
        exercise: item.exercise,
        minutes: agendaMinutes[i],
      })),
      closingMinutes,
      closingTemplate: output.workshopPlan.closingTemplate,
    },
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
