import InterviewLanding from "./interview-landing";

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <InterviewLanding projectId={projectId} />;
}
