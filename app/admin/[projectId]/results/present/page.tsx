import PresentPageContent from "./present-page-content";

export const dynamic = "force-dynamic";

export default async function FacilitatorPresentPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <PresentPageContent projectId={projectId} />;
}
