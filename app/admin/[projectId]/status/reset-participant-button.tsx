"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetParticipantSession } from "../../actions";

export default function ResetParticipantButton({
  projectId,
  leaderId,
  leaderName,
}: {
  projectId: string;
  leaderId: string;
  leaderName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        `Reset ${leaderName}'s interview? This permanently deletes their answers so far and lets them start over from scratch. This cannot be undone.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      await resetParticipantSession(projectId, leaderId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="btn-danger-text disabled:opacity-50"
    >
      {isPending ? "Resetting…" : "Reset"}
    </button>
  );
}
