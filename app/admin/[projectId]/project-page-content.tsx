import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import ProjectEditForm from "./project-edit-form";
import type { Leader, Project } from "../types";

/**
 * Shared by /admin/[projectId] (the real admin, accessToken omitted) and
 * /project/[accessToken] (a consultant's project-scoped link) - one
 * implementation so the two surfaces can't quietly drift apart. The caller
 * is responsible for resolving accessToken to a projectId first and for its
 * own auth gate; this only renders.
 */
export default async function ProjectPageContent({
  projectId,
  accessToken,
}: {
  projectId: string;
  accessToken?: string;
}) {
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

  const basePath = accessToken ? `/project/${accessToken}` : `/admin/${projectId}`;

  return (
    <>
      {!accessToken && (
        <Link href="/admin" className="im-link text-sm">
          &larr; Back to projects
        </Link>
      )}
      <div className="mb-6 mt-2 flex items-center justify-between">
        <h1 className="im-display text-2xl" style={{ color: "var(--im-black)" }}>
          {(project as Project).name || "Untitled project"}
        </h1>
        <div className="flex gap-4">
          <Link href={`${basePath}/status`} className="im-link text-sm">
            View status →
          </Link>
          <Link href={`${basePath}/results`} className="im-link text-sm">
            View results →
          </Link>
        </div>
      </div>
      <ProjectEditForm
        project={project as Project}
        leaders={(leaders ?? []) as Leader[]}
        accessToken={accessToken}
      />
    </>
  );
}
