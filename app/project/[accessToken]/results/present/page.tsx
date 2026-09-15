import { notFound } from "next/navigation";
import { getProjectIdForToken } from "@/lib/project-access";
import PresentPageContent from "@/app/admin/[projectId]/results/present/present-page-content";

export const dynamic = "force-dynamic";

export default async function ProjectAccessPresentPage({
  params,
}: {
  params: Promise<{ accessToken: string }>;
}) {
  const { accessToken } = await params;
  const projectId = await getProjectIdForToken(accessToken);
  if (!projectId) notFound();

  return <PresentPageContent projectId={projectId} accessToken={accessToken} />;
}
