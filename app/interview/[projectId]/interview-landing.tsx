"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { startInterviewSession } from "../actions";

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

type LeaderOption = { id: string; name: string; role_label: string };

type LoadState =
  | { phase: "loading" }
  | { phase: "unavailable"; message: string }
  | { phase: "ready"; project: ProjectPublicState; leaders: LeaderOption[] };

export default function InterviewLanding({
  projectId,
}: {
  projectId: string;
}) {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [selectedLeaderId, setSelectedLeaderId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);

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
    const result = await startInterviewSession(projectId, selectedLeaderId);
    if (result?.alreadyCompleted) {
      setAlreadyCompleted(true);
      setIsSubmitting(false);
      return;
    }
    if (result?.error) {
      setSubmitError(result.error);
      setIsSubmitting(false);
    }
    // Otherwise the server action already redirected to the session page.
  }

  if (state.phase === "loading") {
    return <p className="text-neutral-500">Loading…</p>;
  }

  if (state.phase === "unavailable") {
    return <p className="text-neutral-700">{state.message}</p>;
  }

  if (alreadyCompleted) {
    return (
      <p className="text-neutral-700">
        You&apos;ve already completed this interview. Thank you.
      </p>
    );
  }

  return (
    <div className="max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">{state.project.name}</h1>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Select your name
        </label>
        <select
          value={selectedLeaderId}
          onChange={(e) => setSelectedLeaderId(e.target.value)}
          className="w-full rounded border border-neutral-300 p-2"
        >
          <option value="">Choose your name…</option>
          {state.leaders.map((leader) => (
            <option key={leader.id} value={leader.id}>
              {leader.name} — {leader.role_label}
            </option>
          ))}
        </select>
      </div>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={!selectedLeaderId || isSubmitting}
        className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {isSubmitting ? "Please wait…" : "Confirm"}
      </button>
    </div>
  );
}
