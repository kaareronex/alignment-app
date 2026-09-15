import { notFound } from "next/navigation";
import { getProjectIdForToken } from "@/lib/project-access";
import StatusPageContent from "@/app/admin/[projectId]/status/status-page-content";

export const dynamic = "force-dynamic";

export default async function ProjectAccessStatusPage({
  params,
}: {
  params: Promise<{ accessToken: string }>;
}) {
  const { accessToken } = await params;
  const projectId = await getProjectIdForToken(accessToken);
  if (!projectId) notFound();

  return <StatusPageContent projectId={projectId} accessToken={accessToken} />;
}
