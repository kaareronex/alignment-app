"use client";

import { useTransition } from "react";

export default function DeleteProjectButton({
  projectId,
  deleteAction,
}: {
  projectId: string;
  deleteAction: (projectId: string) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        "Delete this project? This also deletes its leaders, sessions, messages, and synthesis. This cannot be undone."
      )
    ) {
      return;
    }
    startTransition(async () => {
      await deleteAction(projectId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-sm text-red-600 hover:underline disabled:opacity-50"
    >
      {isPending ? "Deleting…" : "Delete"}
    </button>
  );
}
