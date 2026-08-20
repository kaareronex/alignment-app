import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import StartTimerButton from "./start-timer-button";
import ProjectStatusControl from "./project-status-control";

export const dynamic = "force-dynamic";

export default async function ProjectStatusPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = createAdminClient();
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, name, status, access_mode, timer_status, timer_started_at")
    .eq("id", projectId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!project) notFound();

  return (
    <div className="space-y-4">
      <Link
        href={`/admin/${projectId}`}
        className="text-sm text-neutral-500 hover:underline"
      >
        &larr; Back to project
      </Link>
      <h1 className="text-2xl font-semibold">{project.name} — Status</h1>

      <ProjectStatusControl projectId={project.id} status={project.status} />

      {project.access_mode === "open" ? (
        <p className="text-neutral-600">
          This project uses open access — each leader starts their own
          interview when they join, so there is no shared timer to start
          here.
        </p>
      ) : project.timer_status === "running" ? (
        <p className="text-neutral-600">
          The timer started at{" "}
          {project.timer_started_at
            ? new Date(project.timer_started_at).toLocaleString("en-GB")
            : "an unknown time"}
          .
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-neutral-600">
            Leaders in the lobby are waiting for the shared start signal.
          </p>
          <StartTimerButton projectId={project.id} />
        </div>
      )}
    </div>
  );
}
