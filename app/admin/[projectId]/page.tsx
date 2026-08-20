import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import ProjectEditForm from "./project-edit-form";
import type { Leader, Project } from "../types";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = createAdminClient();

  const [{ data: project, error: projectError }, { data: leaders, error: leadersError }] =
    await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
      supabase
        .from("leaders")
        .select("id, name, role_label")
        .eq("project_id", projectId)
        .order("name"),
    ]);

  if (projectError) throw new Error(projectError.message);
  if (leadersError) throw new Error(leadersError.message);
  if (!project) notFound();

  return (
    <>
      <Link href="/admin" className="text-sm text-neutral-500 hover:underline">
        &larr; Back to projects
      </Link>
      <div className="mb-6 mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {(project as Project).name || "Untitled project"}
        </h1>
        <Link
          href={`/admin/${projectId}/status`}
          className="text-sm text-neutral-500 hover:underline"
        >
          View status →
        </Link>
      </div>
      <ProjectEditForm
        project={project as Project}
        leaders={(leaders ?? []) as Leader[]}
      />
    </>
  );
}
