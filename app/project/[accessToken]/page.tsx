import { notFound } from "next/navigation";
import { getProjectIdForToken } from "@/lib/project-access";
import ProjectPageContent from "@/app/admin/[projectId]/project-page-content";

export const dynamic = "force-dynamic";

export default async function ProjectAccessPage({
  params,
}: {
  params: Promise<{ accessToken: string }>;
}) {
  const { accessToken } = await params;
  const projectId = await getProjectIdForToken(accessToken);
  if (!projectId) notFound();

  return <ProjectPageContent projectId={projectId} accessToken={accessToken} />;
}
