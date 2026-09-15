import ProjectPageContent from "./project-page-content";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ProjectPageContent projectId={projectId} />;
}
