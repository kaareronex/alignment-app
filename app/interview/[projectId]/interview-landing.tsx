"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { startInterviewSession } from "../actions";
import IntroScreen from "./intro-screen";

type ProjectPublicState = {
  id: string;
  name: string;
  status: "draft" | "active" | "closed";
  access_mode: "lobby" | "open";
  timer_status: "not_started" | "running" | "ended";
  timer_started_at: string | null;
  time_limit_enabled: boolean;
  time_limit_minutes: number | null;
  max_questions: number;
};

type LeaderOption = {
  id: string;
  name: string;
  role_label: string;
  has_completed: boolean;
};

type LoadState =
  | { phase: "loading" }
  | { phase: "unavailable"; message: string }
  | { phase: "ready"; project: ProjectPublicState; leaders: LeaderOption[] };

export default function InterviewLanding({
  projectId,
  initialAlreadyCompleted = false,
}: {
  projectId: string;
  initialAlreadyCompleted?: boolean;
}) {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [selectedLeaderId, setSelectedLeaderId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [alreadyCompleted, setAlreadyCompleted] = useState(
    initialAlreadyCompleted
  );
  // A participant arriving here already known to be completed (resumed a
  // now-finished session) has nothing left to be introduced to.
  const [showIntro, setShowIntro] = useState(!initialAlreadyCompleted);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createClient();
      const [
        { data: projectRows, error: projectError },
        { data: leaders, error: leadersError },
      ] = await Promise.all([
        supabase.rpc("get_project_public_state", { p_project_id: projectId }),
        supabase.rpc("get_leaders_for_project", { p_project_id: projectId }),
      ]);

      if (cancelled) return;

      if (projectError || leadersError) {
        setState({
          phase: "unavailable",
          message:
            "Something went wrong loading this interview. Please try again later.",
        });
        return;
      }

      const project = (projectRows as ProjectPublicState[] | null)?.[0];
      if (!project || project.status !== "active") {
        setState({
          phase: "unavailable",
          message:
            "This interview is not currently available. Please contact whoever sent you this link.",
        });
        return;
      }

      if (!leaders || leaders.length === 0) {
        setState({
          phase: "unavailable",
          message: "No participants have been set up for this interview yet.",
        });
        return;
      }

      setState({
        phase: "ready",
        project,
        leaders: leaders as LeaderOption[],
      });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleConfirm() {
    if (!selectedLeaderId) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const result = await startInterviewSession(projectId, selectedLeaderId);
      if (result?.alreadyCompleted) {
        setAlreadyCompleted(true);
        return;
      }
      if (result?.error) {
        setSubmitError(result.error);
      }
      // Otherwise the server action already redirected to the session page.
    } catch {
      // Previously uncaught - a transient failure here (network blip,
      // momentary DB error) left the button stuck on "Please wait..."
      // forever with no feedback at all.
      setSubmitError("Something went wrong starting your interview. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (showIntro) {
    const minutesText =
      state.phase === "ready" &&
      state.project.time_limit_enabled &&
      state.project.time_limit_minutes
        ? `around ${state.project.time_limit_minutes} minutes`
        : "around 15 minutes";
    return (
      <IntroScreen
        minutesText={minutesText}
        onContinue={() => setShowIntro(false)}
      />
    );
  }

  if (state.phase === "loading") {
    return <p style={{ color: "var(--im-grey)" }}>Loading…</p>;
  }

  if (state.phase === "unavailable") {
    return <p style={{ color: "var(--im-ash)" }}>{state.message}</p>;
  }

  if (alreadyCompleted) {
    return (
      <p style={{ color: "var(--im-ash)" }}>
        You&apos;ve already completed this interview. Thank you.
      </p>
    );
  }

  return (
    <div className="max-w-sm space-y-4">
      <h1 className="im-display text-2xl" style={{ color: "var(--im-black)" }}>
        {state.project.name}
      </h1>

      <div>
        <label className="im-label">Select your name</label>
        <select
          value={selectedLeaderId}
          onChange={(e) => setSelectedLeaderId(e.target.value)}
          className="im-input"
        >
          <option value="">Choose your name…</option>
          {state.leaders.map((leader) => (
            <option
              key={leader.id}
              value={leader.id}
              style={leader.has_completed ? { color: "var(--im-grey)" } : undefined}
            >
              {leader.name} — {leader.role_label}
              {leader.has_completed ? " (completed)" : ""}
            </option>
          ))}
        </select>
      </div>

      {submitError && (
        <p className="text-sm" style={{ color: "var(--im-deep-red, #451f23)" }}>
          {submitError}
        </p>
      )}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={!selectedLeaderId || isSubmitting}
        className="btn-primary"
      >
        {isSubmitting ? "Please wait…" : "Confirm"}
      </button>
    </div>
  );
}
