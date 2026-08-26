import InterviewLanding from "./interview-landing";

export default async function InterviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ completed?: string }>;
}) {
  const { projectId } = await params;
  const { completed } = await searchParams;
  return (
    <InterviewLanding
      projectId={projectId}
      initialAlreadyCompleted={completed === "1"}
    />
  );
}
