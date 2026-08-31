import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import StartTimerButton from "./start-timer-button";
import ProjectStatusControl from "./project-status-control";
import ResetParticipantButton from "./reset-participant-button";

export const dynamic = "force-dynamic";

const SESSION_STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

export default async function ProjectStatusPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = createAdminClient();
  const [
    { data: project, error: projectError },
    { data: leaders, error: leadersError },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, status, access_mode, timer_status, timer_started_at")
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("leaders")
      .select("id, name, role_label, sessions(status)")
      .eq("project_id", projectId)
      .order("name", { ascending: true }),
  ]);

  if (projectError) throw new Error(projectError.message);
  if (leadersError) throw new Error(leadersError.message);
  if (!project) notFound();

  const participants = (leaders ?? []).map((leader) => {
    const sessionRows = leader.sessions as unknown as { status: string }[];
    const status = sessionRows?.[0]?.status ?? "not_started";
    return {
      id: leader.id,
      name: leader.name,
      roleLabel: leader.role_label,
      status,
    };
  });

  return (
    <div className="space-y-4">
      <Link href={`/admin/${projectId}`} className="im-link text-sm">
        &larr; Back to project
      </Link>
      <h1 className="im-display text-2xl" style={{ color: "var(--im-black)" }}>
        {project.name} — Status
      </h1>

      <ProjectStatusControl projectId={project.id} status={project.status} />

      {project.access_mode === "open" ? (
        <p style={{ color: "var(--im-ash)" }}>
          This project uses open access — each participant starts their own
          interview when they join, so there is no shared timer to start
          here.
        </p>
      ) : project.timer_status === "running" ? (
        <p style={{ color: "var(--im-ash)" }}>
          The timer started at{" "}
          {project.timer_started_at
            ? new Date(project.timer_started_at).toLocaleString("en-GB")
            : "an unknown time"}
          .
        </p>
      ) : (
        <div className="space-y-2">
          <p style={{ color: "var(--im-ash)" }}>
            Participants in the lobby are waiting for the shared start signal.
          </p>
          <StartTimerButton projectId={project.id} />
        </div>
      )}

      <div>
        <h2 className="im-display mb-2 text-lg" style={{ color: "var(--im-black)" }}>
          Participants
        </h2>
        {participants.length === 0 ? (
          <p style={{ color: "var(--im-grey)" }}>No participants have been set up yet.</p>
        ) : (
          <ul className="im-card divide-y divide-[var(--im-blue-green-light)] p-0">
            {participants.map((participant) => (
              <li
                key={participant.id}
                className="flex items-center justify-between p-4"
              >
                <div>
                  <span className="font-medium" style={{ color: "var(--im-black)" }}>
                    {participant.name}
                  </span>
                  <span className="ml-2 text-sm" style={{ color: "var(--im-grey)" }}>
                    {participant.roleLabel}
                  </span>
                  <span
                    className="ml-3 text-sm uppercase"
                    style={{ color: "var(--im-grey)" }}
                  >
                    {SESSION_STATUS_LABELS[participant.status] ?? participant.status}
                  </span>
                </div>
                {participant.status !== "not_started" && (
                  <ResetParticipantButton
                    projectId={projectId}
                    leaderId={participant.id}
                    leaderName={participant.name}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
