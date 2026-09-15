import ResultsPageContent from "./results-page-content";

export const dynamic = "force-dynamic";

export default async function ProjectResultsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ResultsPageContent projectId={projectId} />;
}
