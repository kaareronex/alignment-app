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

type ThemeState = "upcoming" | "active" | "covered";

function themeState(
  dimensionId: string,
  currentDimensionId: string | null,
  touchedDimensionIds: string[]
): ThemeState {
  if (dimensionId === currentDimensionId) return "active";
  if (touchedDimensionIds.includes(dimensionId)) return "covered";
  return "upcoming";
}

// Each segment's label sits directly under it - never floating separately
// above the whole bar - so which name belongs to which segment is never
// ambiguous. Upcoming themes stay completely unlabelled (just an outline
// segment, no text): revealing a theme's name before the interview actually
// reaches it would give away what's still to come, which the AI decides on
// the fly, not on a fixed published order.
function ThemeProgressBar({
  dimensions,
  currentDimensionId,
  touchedDimensionIds,
}: {
  dimensions: { id: string; label: string }[];
  currentDimensionId: string | null;
  touchedDimensionIds: string[];
}) {
  const coveredCount = dimensions.filter(
    (d) => themeState(d.id, currentDimensionId, touchedDimensionIds) !== "upcoming"
  ).length;

  return (
    <div
      className="flex gap-1.5"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={dimensions.length}
      aria-valuenow={coveredCount}
      aria-label="Interview progress"
    >
      {dimensions.map((d) => {
        const state = themeState(d.id, currentDimensionId, touchedDimensionIds);
        return (
          <div key={d.id} className="flex min-w-0 flex-1 flex-col gap-1">
            <div
              className="h-1.5 rounded-[2px] transition-colors duration-500"
              style={
                state === "active"
                  ? { backgroundColor: "var(--im-blue-green)" }
                  : state === "covered"
                    ? { backgroundColor: "var(--im-grey)" }
                    : {
                        backgroundColor: "transparent",
                        border: "1px solid var(--im-blue-green-light)",
                      }
              }
            />
            <p
              className="truncate text-xs leading-4"
              style={
                state === "active"
                  ? {
                      color: "var(--im-blue-green)",
                      fontWeight: 700,
                      borderBottom: "2px solid var(--im-blue-green)",
                    }
                  : state === "covered"
                    ? {
                        color: "var(--im-grey)",
                        fontVariant: "small-caps",
                        letterSpacing: "0.05em",
                        fontWeight: 600,
                        borderBottom: "2px solid transparent",
                      }
                    : { borderBottom: "2px solid transparent" }
              }
            >
              {state === "upcoming" ? " " : d.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function InterviewConversation({
  projectId,
  dimensions,
  languageCode,
}: {
  projectId: string;
  dimensions: { id: string; label: string }[];
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
  const [currentDimensionId, setCurrentDimensionId] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  function applyResult(result: InterviewTurnResponse) {
    if (result.status === "completed") {
      setPhase({ kind: "completed" });
    } else {
      setPhase({ kind: "question", message: result.message });
      setTouchedDimensionIds(result.touchedDimensionIds);
      setCurrentDimensionId(result.currentDimensionId);
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

  async function handleConfirmEnd() {
    if (isEnding) return;
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
      setShowEndConfirm(false);
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
      <ThemeProgressBar
        dimensions={dimensions}
        currentDimensionId={currentDimensionId}
        touchedDimensionIds={touchedDimensionIds}
      />
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="im-display text-xl" style={{ color: "var(--im-black)" }}>
          {phase.message}
        </p>
        <div className="flex items-start gap-2">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={10}
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
        <button
          type="submit"
          disabled={!answer.trim() || isSubmitting}
          className="btn-primary"
        >
          {isSubmitting ? "Sending…" : "Send"}
        </button>
      </form>

      <div className="mt-8 border-t pt-4" style={{ borderColor: "var(--im-blue-green-light)" }}>
        {showEndConfirm ? (
          <div className="space-y-2">
            <p className="text-sm" style={{ color: "var(--im-ash)" }}>
              Are you sure? You won&apos;t be able to continue this interview
              afterwards.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleConfirmEnd}
                disabled={isEnding}
                className="btn-secondary disabled:opacity-50"
              >
                {isEnding ? "Ending…" : "Yes, end interview"}
              </button>
              <button
                type="button"
                onClick={() => setShowEndConfirm(false)}
                disabled={isEnding}
                className="btn-text disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowEndConfirm(true)}
            className="btn-secondary"
          >
            End Interview
          </button>
        )}
      </div>
    </div>
  );
}
