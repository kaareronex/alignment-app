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
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <form action={createProject}>
          <button
            type="submit"
            className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800"
          >
            New project
          </button>
        </form>
      </div>

      {!projects || projects.length === 0 ? (
        <p className="text-neutral-500">No projects yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded border border-neutral-200">
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex items-center justify-between p-4"
            >
              <Link href={`/admin/${project.id}`} className="flex-1">
                <span className="font-medium">{project.name}</span>
                <span className="ml-3 text-sm uppercase text-neutral-500">
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
    </main>
  );
}
