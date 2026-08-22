import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { createProject, deleteProject } from "./actions";
import DeleteProjectButton from "./delete-project-button";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createAdminClient();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, status, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--im-black)" }}>
          Projects
        </h1>
        <form action={createProject}>
          <button type="submit" className="btn-primary">
            New project
          </button>
        </form>
      </div>

      {!projects || projects.length === 0 ? (
        <p style={{ color: "var(--im-grey)" }}>No projects yet.</p>
      ) : (
        <ul className="im-card divide-y divide-[var(--im-blue-green-light)] p-0">
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex items-center justify-between p-4"
            >
              <Link href={`/admin/${project.id}`} className="flex-1">
                <span className="font-medium" style={{ color: "var(--im-black)" }}>
                  {project.name}
                </span>
                <span
                  className="ml-3 text-sm uppercase"
                  style={{ color: "var(--im-grey)" }}
                >
                  {project.status}
                </span>
              </Link>
              <DeleteProjectButton
                projectId={project.id}
                deleteAction={deleteProject}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
