import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import type { Synthesis } from "../../types";
import GenerateSynthesisButton from "./generate-synthesis-button";
import SynthesisView from "./synthesis-view";
import { hasCurrentShapeSynthesis } from "./synthesis-shape";

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

  // The "Regenerate" button still shows even for a stale-shaped row, since a
  // row does exist.
  const isCurrentShape = hasCurrentShapeSynthesis(synthesis?.content);

  return (
    <div className="space-y-6">
      <Link href={`/admin/${projectId}`} className="im-link text-sm">
        &larr; Back to project
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="im-display text-2xl" style={{ color: "var(--im-black)" }}>
          {project.name} — Results
        </h1>
        <GenerateSynthesisButton
          projectId={projectId}
          hasExistingSynthesis={!!synthesis}
          completedSessionCount={completedCount ?? 0}
        />
      </div>

      <p className="text-sm" style={{ color: "var(--im-grey)" }}>
        {completedCount ?? 0} completed session
        {(completedCount ?? 0) === 1 ? "" : "s"} available for synthesis.
      </p>

      {isCurrentShape ? (
        <SynthesisView
          projectId={projectId}
          projectName={project.name}
          synthesis={synthesis as unknown as Synthesis}
        />
      ) : synthesis ? (
        <p style={{ color: "var(--im-ash)" }}>
          The last synthesis for this project was generated before the
          workshop plan feature existed and can&apos;t be shown in the
          current format. Regenerate it to see the full results.
        </p>
      ) : (
        <p style={{ color: "var(--im-ash)" }}>
          No synthesis has been generated yet. Generate one once at least one
          participant has completed their interview.
        </p>
      )}
    </div>
  );
}
