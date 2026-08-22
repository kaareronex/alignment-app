import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import type { Synthesis } from "../../types";
import GenerateSynthesisButton from "./generate-synthesis-button";
import SynthesisView from "./synthesis-view";

export const dynamic = "force-dynamic";

export default async function ProjectResultsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = createAdminClient();

  const [
    { data: project, error: projectError },
    { data: synthesis, error: synthesisError },
    { count: completedCount, error: countError },
  ] = await Promise.all([
    supabase.from("projects").select("id, name").eq("id", projectId).maybeSingle(),
    supabase
      .from("synthesis")
      .select("id, project_id, generated_at, content")
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "completed"),
  ]);

  if (projectError) throw new Error(projectError.message);
  if (synthesisError) throw new Error(synthesisError.message);
  if (countError) throw new Error(countError.message);
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/${projectId}`}
        className="text-sm text-neutral-500 hover:underline"
      >
        &larr; Back to project
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{project.name} — Results</h1>
        <GenerateSynthesisButton
          projectId={projectId}
          hasExistingSynthesis={!!synthesis}
          completedSessionCount={completedCount ?? 0}
        />
      </div>

      <p className="text-sm text-neutral-500">
        {completedCount ?? 0} completed session
        {(completedCount ?? 0) === 1 ? "" : "s"} available for synthesis.
      </p>

      {synthesis ? (
        <SynthesisView
          projectName={project.name}
          synthesis={synthesis as unknown as Synthesis}
        />
      ) : (
        <p className="text-neutral-600">
          No synthesis has been generated yet. Generate one once at least one
          leader has completed their interview.
        </p>
      )}
    </div>
  );
}
