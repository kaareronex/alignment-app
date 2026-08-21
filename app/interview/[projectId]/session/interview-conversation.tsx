"use client";

import { useEffect, useState } from "react";
import {
  advanceInterview,
  endInterviewEarly,
  type InterviewTurnResponse,
} from "../../actions";

type Phase =
  | { kind: "loading" }
  | { kind: "load-error" }
  | { kind: "question"; message: string }
  | { kind: "completed" };

function ProgressBar({
  totalCount,
  touchedCount,
}: {
  totalCount: number;
  touchedCount: number;
}) {
  return (
    <div
      className="flex gap-1"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={totalCount}
      aria-valuenow={touchedCount}
      aria-label="Interview progress"
    >
      {Array.from({ length: totalCount }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full ${
            i < touchedCount ? "bg-black" : "bg-neutral-200"
          }`}
        />
      ))}
    </div>
  );
}

export default function InterviewConversation({
  projectId,
  dimensionIds,
}: {
  projectId: string;
  dimensionIds: string[];
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [touchedDimensionIds, setTouchedDimensionIds] = useState<string[]>([]);
  const [isEnding, setIsEnding] = useState(false);

  function applyResult(result: InterviewTurnResponse) {
    if (result.status === "completed") {
      setPhase({ kind: "completed" });
    } else {
      setPhase({ kind: "question", message: result.message });
      setTouchedDimensionIds(result.touchedDimensionIds);
    }
  }

  useEffect(() => {
    advanceInterview(projectId)
      .then(applyResult)
      .catch(() => setPhase({ kind: "load-error" }));
  }, [projectId]);

  function handleRetryLoad() {
    setPhase({ kind: "loading" });
    advanceInterview(projectId)
      .then(applyResult)
      .catch(() => setPhase({ kind: "load-error" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = answer.trim();
    if (!text || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const result = await advanceInterview(projectId, text);
      setAnswer("");
      applyResult(result);
    } catch {
      setSubmitError(
        "Something went wrong sending your answer. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEndEarly() {
    if (isEnding) return;
    if (
      !confirm(
        "End this interview now? You won't be able to continue it afterwards."
      )
    ) {
      return;
    }
    setIsEnding(true);
    try {
      const result = await endInterviewEarly(projectId);
      applyResult(result);
    } catch {
      setSubmitError(
        "Something went wrong ending the interview. Please try again."
      );
    } finally {
      setIsEnding(false);
    }
  }

  if (phase.kind === "loading") {
    return <p className="text-neutral-500">Preparing your first question…</p>;
  }

  if (phase.kind === "load-error") {
    return (
      <div className="space-y-2">
        <p className="text-red-600">
          Something went wrong loading your interview.
        </p>
        <button
          type="button"
          onClick={handleRetryLoad}
          className="text-sm underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (phase.kind === "completed") {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Thank you</h1>
        <p className="text-neutral-600">
          That&apos;s everything for now — thank you for taking the time to
          share your thinking.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ProgressBar
        totalCount={dimensionIds.length}
        touchedCount={touchedDimensionIds.length}
      />
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-lg">{phase.message}</p>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={4}
          placeholder="Type your answer…"
          autoFocus
          className="w-full rounded border border-neutral-300 p-2"
        />
        {submitError && <p className="text-sm text-red-600">{submitError}</p>}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={!answer.trim() || isSubmitting}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {isSubmitting ? "Sending…" : "Send"}
          </button>
          <button
            type="button"
            onClick={handleEndEarly}
            disabled={isEnding}
            className="text-sm text-neutral-500 hover:underline disabled:opacity-50"
          >
            {isEnding ? "Ending…" : "End interview early"}
          </button>
        </div>
      </form>
    </div>
  );
}
