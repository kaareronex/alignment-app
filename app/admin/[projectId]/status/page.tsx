import StatusPageContent from "./status-page-content";

export const dynamic = "force-dynamic";

export default async function ProjectStatusPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <StatusPageContent projectId={projectId} />;
}
