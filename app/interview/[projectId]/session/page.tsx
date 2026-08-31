import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { getInterviewSessionId } from "@/lib/interview-session-cookie";
import type { FramingDimension } from "@/app/admin/framing-defaults";
import SessionView from "./session-view";

export const dynamic = "force-dynamic";
// Server Actions inherit maxDuration from the page that invokes them, not
// from the action's own file - advanceInterview() (the Anthropic call) is
// invoked from this page via InterviewConversation, so this is where it
// has to be set. 60s is the maximum Vercel's Hobby plan allows; Pro allows
// up to 300s if 60s turns out not to be enough under real load.
export const maxDuration = 60;

export default async function InterviewSessionPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const sessionId = await getInterviewSessionId(projectId);

  if (!sessionId) {
    redirect(`/interview/${projectId}`);
  }

  const supabase = createAdminClient();
  const [
    { data: session, error: sessionError },
    { data: project, error: projectError },
  ] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, project_id, status, started_at, language_code")
      .eq("id", sessionId)
      .maybeSingle(),
    supabase
      .from("projects")
      .select(
        "status, access_mode, timer_status, timer_started_at, time_limit_enabled, time_limit_minutes, framing_definitions"
      )
      .eq("id", projectId)
      .maybeSingle(),
  ]);

  if (sessionError) throw new Error(sessionError.message);
  if (projectError) throw new Error(projectError.message);

  // A resumed session (cookie still set from an earlier visit) that has
  // since been completed - by hard stop, early exit, or on another
  // device - gets its own redirect flag so the landing page shows the
  // same "already completed" message it would show from a fresh name
  // selection, instead of silently bouncing back to the picker as if
  // nothing had happened.
  if (session && session.project_id === projectId && session.status === "completed") {
    redirect(`/interview/${projectId}?completed=1`);
  }

  if (!session || session.project_id !== projectId || !project || project.status !== "active") {
    redirect(`/interview/${projectId}`);
  }

  // Only the ids reach the browser - labels/descriptions guide the model
  // server-side but aren't shown to participants.
  const dimensionIds = ((project.framing_definitions ?? []) as FramingDimension[]).map(
    (d) => d.id
  );

  return (
    <SessionView
      projectId={projectId}
      accessMode={project.access_mode}
      initialTimerStatus={project.timer_status}
      initialTimerStartedAt={project.timer_started_at}
      timeLimitEnabled={project.time_limit_enabled}
      timeLimitMinutes={project.time_limit_minutes}
      sessionStartedAt={session.started_at}
      dimensionIds={dimensionIds}
      languageCode={session.language_code}
    />
  );
}
