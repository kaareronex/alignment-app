import { notFound } from "next/navigation";
import { getProjectIdForToken } from "@/lib/project-access";
import ResultsPageContent from "@/app/admin/[projectId]/results/results-page-content";

export const dynamic = "force-dynamic";

export default async function ProjectAccessResultsPage({
  params,
}: {
  params: Promise<{ accessToken: string }>;
}) {
  const { accessToken } = await params;
  const projectId = await getProjectIdForToken(accessToken);
  if (!projectId) notFound();

  return <ResultsPageContent projectId={projectId} accessToken={accessToken} />;
}
