"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateSynthesis } from "../../actions";

export default function GenerateSynthesisButton({
  projectId,
  hasExistingSynthesis,
  completedSessionCount,
}: {
  projectId: string;
  hasExistingSynthesis: boolean;
  completedSessionCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const disabled = isPending || completedSessionCount === 0;
  const label = isPending
    ? "Generating synthesis…"
    : hasExistingSynthesis
      ? "Regenerate synthesis"
      : "Generate synthesis";

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await generateSynthesis(projectId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to generate synthesis.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={
          completedSessionCount === 0
            ? "No completed sessions yet"
            : undefined
        }
        className="btn-primary"
      >
        {label}
      </button>
      {isPending && (
        <p className="text-xs" style={{ color: "var(--im-grey)" }}>
          This calls Claude and reads every completed interview - it can take
          a minute or two for larger teams.
        </p>
      )}
      {error && (
        <p className="text-xs" style={{ color: "var(--im-deep-red, #451f23)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
