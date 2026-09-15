"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { startProjectTimer } from "../../actions";

export default function StartTimerButton({
  projectId,
  accessToken,
}: {
  projectId: string;
  accessToken?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await startProjectTimer(projectId, accessToken);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="btn-primary"
    >
      {isPending ? "Starting…" : "Start timer"}
    </button>
  );
}
