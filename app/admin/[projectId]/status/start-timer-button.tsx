"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { startProjectTimer } from "../../actions";

export default function StartTimerButton({
  projectId,
}: {
  projectId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await startProjectTimer(projectId);
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
