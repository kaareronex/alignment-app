"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import {
  setInterviewSessionCookie,
  getInterviewSessionId,
} from "@/lib/interview-session-cookie";
import { getNextInterviewTurn } from "@/lib/ai/interview-model";
import type { FramingDimension } from "@/app/admin/framing-defaults";
import {
  INTERVIEW_LANGUAGES,
  DEFAULT_INTERVIEW_LANGUAGE_CODE,
  getInterviewLanguageLabel,
} from "@/lib/languages";

export type StartSessionResult =
  | { error: string; alreadyCompleted?: false }
  | { alreadyCompleted: true; error?: undefined }
  | undefined;

export async function startInterviewSession(
  projectId: string,
  leaderId: string,
  languageCode?: string
): Promise<StartSessionResult> {
  if (!projectId || !leaderId) {
    return { error: "Missing project or participant." };
  }

  const resolvedLanguageCode = INTERVIEW_LANGUAGES.some(
    (l) => l.code === languageCode
  )
    ? (languageCode as string)
    : DEFAULT_INTERVIEW_LANGUAGE_CODE;

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
      language_code: resolvedLanguageCode,
    })
    .select("id")
    .single();
  if (createError) throw new Error(createError.message);

  await setInterviewSessionCookie(projectId, created.id);
  redirect(`/interview/${projectId}/session`);
}

export type InterviewTurnResponse =
  | { status: "question"; message: string; touchedDimensionIds: string[] }
  | { status: "completed" };

function computeTouchedDimensionIds(
  messages: { dimension_id: string | null }[]
): string[] {
  const ids = new Set<string>();
  for (const m of messages) {
    if (m.dimension_id) ids.add(m.dimension_id);
  }
  return Array.from(ids);
}

/**
 * Advances the interview by one turn: records the participant's answer to the
 * currently open question (if any), then either asks the next question or
 * ends the session, per the server-side hard stops on question count and
 * time limit - the model is never trusted to decide the session is over on
 * its own.
 */
export async function advanceInterview(
  projectId: string,
  answerText?: string
): Promise<InterviewTurnResponse> {
  const sessionId = await getInterviewSessionId(projectId);
  if (!sessionId) {
    throw new Error("No interview session found for this browser.");
  }

  const supabase = createAdminClient();

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select(
      "id, project_id, leader_id, status, started_at, question_count, language_code"
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session || session.project_id !== projectId) {
    throw new Error("Interview session not found.");
  }
  if (session.status === "completed") {
    return { status: "completed" };
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "strategy_context, session_purpose, framing_definitions, max_questions, access_mode, timer_started_at, time_limit_enabled, time_limit_minutes"
    )
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) throw new Error(projectError.message);
  if (!project) throw new Error("Project not found.");

  const { data: leader, error: leaderError } = await supabase
    .from("leaders")
    .select("name, role_label")
    .eq("id", session.leader_id)
    .maybeSingle();
  if (leaderError) throw new Error(leaderError.message);
  if (!leader) throw new Error("Participant not found.");

  const { data: existingMessages, error: messagesError } = await supabase
    .from("messages")
    .select("sender, content, question_number, dimension_id")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (messagesError) throw new Error(messagesError.message);

  const conversation = (existingMessages ?? []).map((m) => ({
    sender: m.sender as "assistant" | "leader",
    content: m.content as string,
  }));

  const questionsAskedSoFar = session.question_count;
  const currentQuestionNumber = questionsAskedSoFar;

  const currentQuestionAnswered = (existingMessages ?? []).some(
    (m) => m.sender === "leader" && m.question_number === currentQuestionNumber
  );

  if (!answerText && currentQuestionNumber > 0 && !currentQuestionAnswered) {
    // A question is already pending with no answer yet - e.g. a duplicate
    // "get the current turn" call (React Strict Mode double-invokes mount
    // effects in dev; a slow-network retry could do the same in
    // production). Return the existing question instead of asking the
    // model again, since the API rejects a conversation that would end on
    // an assistant message with no new user turn to respond to.
    const lastQuestion = (existingMessages ?? [])
      .filter((m) => m.sender === "assistant")
      .at(-1);
    if (lastQuestion) {
      return {
        status: "question",
        message: lastQuestion.content,
        touchedDimensionIds: computeTouchedDimensionIds(existingMessages ?? []),
      };
    }
  }

  if (answerText && currentQuestionNumber > 0) {
    if (!currentQuestionAnswered) {
      const { error: insertAnswerError } = await supabase
        .from("messages")
        .insert({
          session_id: sessionId,
          sender: "leader",
          content: answerText,
          question_number: currentQuestionNumber,
        });
      if (insertAnswerError) throw new Error(insertAnswerError.message);
      conversation.push({ sender: "leader", content: answerText });
    }
  }

  let timeRemainingSeconds: number | null = null;
  if (project.time_limit_enabled && project.time_limit_minutes) {
    const reference =
      project.access_mode === "lobby"
        ? project.timer_started_at
        : session.started_at;
    if (reference) {
      const deadline =
        new Date(reference).getTime() + project.time_limit_minutes * 60_000;
      timeRemainingSeconds = (deadline - Date.now()) / 1000;
    }
  }

  const hardStopByCount = questionsAskedSoFar >= project.max_questions;
  const hardStopByTime =
    timeRemainingSeconds !== null && timeRemainingSeconds <= 0;

  if (hardStopByCount || hardStopByTime) {
    const { error: endError } = await supabase
      .from("sessions")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        ended_reason: hardStopByCount ? "max_questions" : "time_limit",
      })
      .eq("id", sessionId);
    if (endError) throw new Error(endError.message);
    return { status: "completed" };
  }

  const isFinalQuestion = questionsAskedSoFar + 1 >= project.max_questions;
  const framingDimensions = (project.framing_definitions ??
    []) as FramingDimension[];

  const turn = await getNextInterviewTurn({
    strategyContext: project.strategy_context ?? "",
    sessionPurpose: project.session_purpose ?? "",
    framingDimensions,
    leaderName: leader.name,
    leaderRoleLabel: leader.role_label,
    conversation,
    questionsAskedSoFar,
    maxQuestions: project.max_questions,
    isFinalQuestion,
    timeRemainingSeconds,
    interviewLanguageLabel: getInterviewLanguageLabel(session.language_code),
  });

  const newQuestionNumber = questionsAskedSoFar + 1;
  const { error: insertQuestionError } = await supabase
    .from("messages")
    .insert({
      session_id: sessionId,
      sender: "assistant",
      content: turn.message,
      question_number: newQuestionNumber,
      dimension_id: turn.dimensionAddressed,
    });
  if (insertQuestionError) throw new Error(insertQuestionError.message);

  const sessionUpdate: Record<string, unknown> = {
    question_count: newQuestionNumber,
  };
  if (session.status === "not_started") {
    sessionUpdate.status = "in_progress";
  }
  if (!session.started_at) {
    sessionUpdate.started_at = new Date().toISOString();
  }
  // The model can also end the session voluntarily, when it judges the
  // participant has clearly asked to stop - checked deterministically here via
  // a structured field, never inferred from the message text. This is on
  // top of, not instead of, the hard stops above: those still fire first
  // and don't depend on this flag at all.
  if (turn.leaderWantsToStop) {
    sessionUpdate.status = "completed";
    sessionUpdate.ended_at = new Date().toISOString();
    sessionUpdate.ended_reason = "model_signal";
  }
  const { error: updateSessionError } = await supabase
    .from("sessions")
    .update(sessionUpdate)
    .eq("id", sessionId);
  if (updateSessionError) throw new Error(updateSessionError.message);

  if (turn.leaderWantsToStop) {
    return { status: "completed" };
  }

  const touchedDimensionIds = computeTouchedDimensionIds([
    ...(existingMessages ?? []),
    { dimension_id: turn.dimensionAddressed },
  ]);

  return { status: "question", message: turn.message, touchedDimensionIds };
}

/** The participant clicking "End interview early" - a hard stop just like the
 * count/time ones, distinguished only by ended_reason for later reporting. */
export async function endInterviewEarly(
  projectId: string
): Promise<{ status: "completed" }> {
  const sessionId = await getInterviewSessionId(projectId);
  if (!sessionId) {
    throw new Error("No interview session found for this browser.");
  }

  const supabase = createAdminClient();
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, project_id, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session || session.project_id !== projectId) {
    throw new Error("Interview session not found.");
  }

  if (session.status !== "completed") {
    const { error } = await supabase
      .from("sessions")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        ended_reason: "leader_early_exit",
      })
      .eq("id", sessionId);
    if (error) throw new Error(error.message);
  }

  return { status: "completed" };
}
