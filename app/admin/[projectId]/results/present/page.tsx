import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import type { Synthesis } from "../../../types";
import { hasCurrentShapeSynthesis } from "../synthesis-shape";
import PresenterView from "./presenter-view";

export const dynamic = "force-dynamic";

export default async function FacilitatorPresentPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = createAdminClient();

  const [
    { data: project, error: projectError },
    { data: synthesis, error: synthesisError },
  ] = await Promise.all([
    supabase.from("projects").select("id, name").eq("id", projectId).maybeSingle(),
    supabase
      .from("synthesis")
      .select("id, project_id, generated_at, content")
      .eq("project_id", projectId)
      .maybeSingle(),
  ]);

  if (projectError) throw new Error(projectError.message);
  if (synthesisError) throw new Error(synthesisError.message);
  if (!project) notFound();

  if (!hasCurrentShapeSynthesis(synthesis?.content)) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8">
        <Link href={`/admin/${projectId}/results`} className="im-link text-sm">
          &larr; Back to results
        </Link>
        <p style={{ color: "var(--im-ash)" }}>
          {synthesis
            ? "The last synthesis for this project was generated before the workshop plan feature existed and can't be presented in the current format. Regenerate it from the results page first."
            : "No synthesis has been generated yet for this project. Generate one from the results page first."}
        </p>
      </div>
    );
  }

  return (
    <PresenterView
      projectId={projectId}
      projectName={project.name}
      synthesis={synthesis as unknown as Synthesis}
    />
  );
}
