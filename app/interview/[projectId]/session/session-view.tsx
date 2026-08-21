"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import InterviewConversation from "./interview-conversation";

type Props = {
  projectId: string;
  accessMode: "lobby" | "open";
  initialTimerStatus: "not_started" | "running" | "ended";
  initialTimerStartedAt: string | null;
  timeLimitEnabled: boolean;
  timeLimitMinutes: number | null;
  sessionStartedAt: string | null;
  dimensionIds: string[];
};

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function SessionView({
  projectId,
  accessMode,
  initialTimerStatus,
  initialTimerStartedAt,
  timeLimitEnabled,
  timeLimitMinutes,
  sessionStartedAt,
  dimensionIds,
}: Props) {
  const [timerStatus, setTimerStatus] = useState(initialTimerStatus);
  const [timerStartedAt, setTimerStartedAt] = useState(initialTimerStartedAt);
  // Starts null so the server-rendered markup never includes a
  // point-in-time value - it's filled in after mount, avoiding a hydration
  // mismatch between server render time and client hydration time.
  const [now, setNow] = useState<number | null>(null);

  const isWaiting = accessMode === "lobby" && timerStatus !== "running";

  // In lobby mode, wait for the admin's "start timer" broadcast. Not needed
  // in open mode, where the interview starts immediately on arrival.
  useEffect(() => {
    if (accessMode !== "lobby" || timerStatus === "running") return;

    const supabase = createClient();
    const channel = supabase.channel(`project-timer:${projectId}`);
    channel
      .on("broadcast", { event: "timer_started" }, (message) => {
        const payload = message.payload as { timerStartedAt: string };
        setTimerStartedAt(payload.timerStartedAt);
        setTimerStatus("running");
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accessMode, timerStatus, projectId]);

  useEffect(() => {
    if (!timeLimitEnabled) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [timeLimitEnabled]);

  const deadline = useMemo(() => {
    if (!timeLimitEnabled || !timeLimitMinutes) return null;
    const reference = accessMode === "lobby" ? timerStartedAt : sessionStartedAt;
    if (!reference) return null;
    return new Date(reference).getTime() + timeLimitMinutes * 60_000;
  }, [
    timeLimitEnabled,
    timeLimitMinutes,
    accessMode,
    timerStartedAt,
    sessionStartedAt,
  ]);

  // Always recomputed from the fixed deadline against the current time, so
  // this can't drift the way an incrementally-decremented counter would.
  const remainingMs =
    deadline !== null && now !== null ? deadline - now : null;

  if (isWaiting) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">
          Waiting for the interview to start
        </h1>
        <p className="text-neutral-600">
          The interview will start shortly. Please keep this page open.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {remainingMs !== null && (
        <p className="text-sm text-neutral-500">
          Time remaining: {formatRemaining(remainingMs)}
        </p>
      )}
      <InterviewConversation projectId={projectId} dimensionIds={dimensionIds} />
    </div>
  );
}
