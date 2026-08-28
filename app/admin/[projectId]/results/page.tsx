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

  // A synthesis row generated before a content-shape change (workshop plan,
  // then alignment/basis) has an old-shaped content blob - since synthesis
  // is always fully overwritten (never migrated in place), treat it as
  // stale rather than render a half-formed page. The "Regenerate" button
  // still shows, since a row does exist.
  const dimensions = (synthesis?.content as { dimensions?: unknown })?.dimensions;
  const hasCurrentShapeSynthesis =
    !!synthesis &&
    Array.isArray((synthesis.content as { topPriorities?: unknown })?.topPriorities) &&
    !!(synthesis.content as { workshopPlan?: unknown })?.workshopPlan &&
    Array.isArray(dimensions) &&
    dimensions.every(
      (d) =>
        typeof (d as { keyPoint?: unknown }).keyPoint === "string" &&
        Array.isArray((d as { participantBases?: unknown }).participantBases)
    );

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

      {hasCurrentShapeSynthesis ? (
        <SynthesisView
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
