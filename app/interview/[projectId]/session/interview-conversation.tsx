"use client";

import { useEffect, useRef, useState } from "react";
import {
  advanceInterview,
  endInterviewEarly,
  type InterviewTurnResponse,
} from "../../actions";
import VoiceInputButton from "./voice-input-button";

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
          className="h-1 flex-1 rounded-[2px]"
          style={{
            backgroundColor:
              i < touchedCount ? "var(--im-blue-green)" : "var(--im-blue-green-light)",
          }}
        />
      ))}
    </div>
  );
}

export default function InterviewConversation({
  projectId,
  dimensionIds,
  languageCode,
}: {
  projectId: string;
  dimensionIds: string[];
  languageCode: string | null;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [answer, setAnswer] = useState("");
  const answerRef = useRef(answer);
  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);
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
    return <p style={{ color: "var(--im-grey)" }}>Preparing your first question…</p>;
  }

  if (phase.kind === "load-error") {
    return (
      <div className="space-y-2">
        <p style={{ color: "var(--im-deep-red, #451f23)" }}>
          Something went wrong loading your interview.
        </p>
        <button type="button" onClick={handleRetryLoad} className="btn-text">
          Try again
        </button>
      </div>
    );
  }

  if (phase.kind === "completed") {
    return (
      <div className="space-y-2">
        <h1 className="im-display text-2xl" style={{ color: "var(--im-black)" }}>
          Thank you
        </h1>
        <p style={{ color: "var(--im-ash)" }}>
          That&apos;s everything for now — thank you for taking the time to
          share your thinking.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProgressBar
        totalCount={dimensionIds.length}
        touchedCount={touchedDimensionIds.length}
      />
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="im-display text-xl" style={{ color: "var(--im-black)" }}>
          {phase.message}
        </p>
        <div className="flex items-start gap-2">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={5}
            placeholder="Type your answer…"
            autoFocus
            disabled={isSubmitting}
            className="im-input flex-1"
          />
          <VoiceInputButton
            lang={
              languageCode ??
              (typeof navigator !== "undefined" ? navigator.language : "en-GB")
            }
            disabled={isSubmitting}
            baseTextRef={answerRef}
            onTranscriptChange={setAnswer}
          />
        </div>
        {submitError && (
          <p className="text-sm" style={{ color: "var(--im-deep-red, #451f23)" }}>
            {submitError}
          </p>
        )}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={!answer.trim() || isSubmitting}
            className="btn-primary"
          >
            {isSubmitting ? "Sending…" : "Send"}
          </button>
          <button
            type="button"
            onClick={handleEndEarly}
            disabled={isEnding}
            className="btn-text disabled:opacity-50"
          >
            {isEnding ? "Ending…" : "End interview early"}
          </button>
        </div>
      </form>
    </div>
  );
}
