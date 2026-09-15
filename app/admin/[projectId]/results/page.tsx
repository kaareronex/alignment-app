import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import type { Synthesis } from "../../types";
import GenerateSynthesisButton from "./generate-synthesis-button";
import WorkshopDurationField from "./workshop-duration-field";
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
    supabase
      .from("projects")
      .select("id, name, workshop_duration_minutes")
      .eq("id", projectId)
      .maybeSingle(),
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
  const currentSynthesis = isCurrentShape
    ? (synthesis as unknown as Synthesis)
    : null;

  // Neither of these blocks the current synthesis from being shown (it's
  // still valid content, just possibly out of date) - unlike
  // hasCurrentShapeSynthesis above, which guards a hard structural
  // incompatibility that can't be rendered at all.
  const sessionCountGrew =
    !!currentSynthesis && (completedCount ?? 0) > currentSynthesis.content.sessionCount;
  const durationChanged =
    !!currentSynthesis &&
    project.workshop_duration_minutes !== currentSynthesis.content.workshopPlan.totalMinutes;

  return (
    <div className="space-y-6">
      <Link href={`/admin/${projectId}`} className="im-link text-sm">
        &larr; Back to project
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="im-display text-2xl" style={{ color: "var(--im-black)" }}>
          {project.name} — Results
        </h1>
        <div className="flex flex-wrap items-end gap-4">
          <WorkshopDurationField
            projectId={projectId}
            initialMinutes={project.workshop_duration_minutes}
          />
          <GenerateSynthesisButton
            projectId={projectId}
            hasExistingSynthesis={!!synthesis}
            completedSessionCount={completedCount ?? 0}
          />
        </div>
      </div>

      <p className="text-sm" style={{ color: "var(--im-grey)" }}>
        {completedCount ?? 0} completed session
        {(completedCount ?? 0) === 1 ? "" : "s"} available for synthesis.
      </p>

      {(sessionCountGrew || durationChanged) && (
        <div
          className="im-card space-y-1 text-sm"
          style={{ borderColor: "var(--im-yellow, #e4b73c)", color: "var(--im-ash)" }}
        >
          <p className="font-bold">This synthesis may be out of date:</p>
          <ul className="list-disc pl-5">
            {sessionCountGrew && (
              <li>
                {completedCount} session{(completedCount ?? 0) === 1 ? "" : "s"} are now
                completed, up from {currentSynthesis!.content.sessionCount} when this was
                generated.
              </li>
            )}
            {durationChanged && (
              <li>
                The workshop length is now set to {project.workshop_duration_minutes} min,
                but this plan was generated for {currentSynthesis!.content.workshopPlan.totalMinutes}{" "}
                min - the plan&apos;s timings, and the facilitator view&apos;s per-item
                countdown timers, won&apos;t reflect the new duration until you regenerate.
              </li>
            )}
          </ul>
          <p>Regenerate above to bring it up to date.</p>
        </div>
      )}

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
