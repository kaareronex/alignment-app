"use client";

import { useEffect, useRef, useState } from "react";
import { INTERVIEW_LANGUAGES } from "@/lib/languages";

type ConnectionState =
  | { status: "checking" }
  | { status: "good"; avgMs: number; jitterMs: number }
  | { status: "unstable"; avgMs: number | null; jitterMs: number | null };

type MicState = "checking" | "granted" | "denied" | "unsupported";

const PING_SAMPLE_COUNT = 8;
const PING_PER_REQUEST_TIMEOUT_MS = 3000;
const PING_OVERALL_BUDGET_MS = 12000;
const GOOD_AVG_MS_THRESHOLD = 400;
const GOOD_JITTER_MS_THRESHOLD = 200;

async function pingOnce(timeoutMs: number): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    await fetch("/api/ping", { cache: "no-store", signal: controller.signal });
    return performance.now() - start;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function runConnectionCheck(): Promise<ConnectionState> {
  const samples: number[] = [];
  const deadline = Date.now() + PING_OVERALL_BUDGET_MS;

  for (let i = 0; i < PING_SAMPLE_COUNT && Date.now() < deadline; i++) {
    const remaining = deadline - Date.now();
    const ms = await pingOnce(Math.min(PING_PER_REQUEST_TIMEOUT_MS, remaining));
    if (ms !== null) samples.push(ms);
  }

  if (samples.length === 0) {
    return { status: "unstable", avgMs: null, jitterMs: null };
  }

  const avgMs = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
  const jitterMs = Math.round(Math.max(...samples) - Math.min(...samples));
  const isGood = avgMs < GOOD_AVG_MS_THRESHOLD && jitterMs < GOOD_JITTER_MS_THRESHOLD;

  return isGood
    ? { status: "good", avgMs, jitterMs }
    : { status: "unstable", avgMs, jitterMs };
}

function useMicCheck() {
  const [micState, setMicState] = useState<MicState>("checking");
  const [level, setLevel] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let animationFrame: number;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMicState("unsupported");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setMicState("granted");

        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sumSquares = 0;
          for (let i = 0; i < data.length; i++) {
            const normalised = (data[i] - 128) / 128;
            sumSquares += normalised * normalised;
          }
          const rms = Math.sqrt(sumSquares / data.length);
          setLevel(Math.min(100, Math.round(rms * 300)));
          animationFrame = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        if (!cancelled) setMicState("denied");
      }
    }

    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
      stream?.getTracks().forEach((t) => t.stop());
      audioContext?.close();
    };
  }, []);

  return { micState, level };
}

function ConnectionCheckResult({ state }: { state: ConnectionState }) {
  if (state.status === "checking") {
    return <p style={{ color: "var(--im-grey)" }}>Checking your connection…</p>;
  }
  if (state.status === "good") {
    return (
      <p style={{ color: "var(--im-blue-green)" }}>
        Looks good ({state.avgMs} ms average).
      </p>
    );
  }
  return (
    <p style={{ color: "var(--im-yellow, #e4b73c)" }}>
      Might be unstable{state.avgMs !== null ? ` (${state.avgMs} ms average)` : ""}
      . That&apos;s fine — the interview will still work, answers just might
      take a little longer to send.
    </p>
  );
}

function MicCheckResult({ micState, level }: { micState: MicState; level: number }) {
  if (micState === "checking") {
    return <p style={{ color: "var(--im-grey)" }}>Waiting for microphone permission…</p>;
  }
  if (micState === "unsupported") {
    return (
      <p style={{ color: "var(--im-grey)" }}>
        Voice input isn&apos;t supported in this browser, but you can still
        type your answers.
      </p>
    );
  }
  if (micState === "denied") {
    return (
      <p style={{ color: "var(--im-grey)" }}>
        Microphone access wasn&apos;t granted, so voice input won&apos;t work
        — but typing your answers works just as well.
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <p style={{ color: "var(--im-blue-green)" }}>
        Microphone is working — try saying something.
      </p>
      <div
        className="h-2 w-full overflow-hidden rounded-[2px]"
        style={{ backgroundColor: "var(--im-blue-green-light)" }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={level}
        aria-label="Microphone input level"
      >
        <div
          className="h-full rounded-[2px] transition-[width]"
          style={{ width: `${level}%`, backgroundColor: "var(--im-blue-green)" }}
        />
      </div>
    </div>
  );
}

export default function ReadinessStep({
  languageCode,
  onLanguageChange,
  onBack,
  onContinue,
  isSubmitting,
  submitError,
}: {
  languageCode: string;
  onLanguageChange: (code: string) => void;
  onBack: () => void;
  onContinue: () => void;
  isSubmitting: boolean;
  submitError: string | null;
}) {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: "checking",
  });
  const { micState, level } = useMicCheck();
  const hasStartedConnectionCheck = useRef(false);

  useEffect(() => {
    if (hasStartedConnectionCheck.current) return;
    hasStartedConnectionCheck.current = true;
    runConnectionCheck().then(setConnectionState);
  }, []);

  return (
    <div className="max-w-sm space-y-6">
      <h1 className="im-display text-2xl" style={{ color: "var(--im-black)" }}>
        Let&apos;s get you ready.
      </h1>

      <div>
        <label className="im-label">Interview language</label>
        <select
          value={languageCode}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="im-input"
        >
          {INTERVIEW_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm" style={{ color: "var(--im-ash)" }}>
          The interviewer will conduct the whole conversation in this
          language from the first question onwards. If you end up answering
          in a different language, it will follow along naturally.
        </p>
      </div>

      <div className="im-card space-y-1">
        <p className="im-label">Connection check</p>
        <ConnectionCheckResult state={connectionState} />
      </div>

      <div className="im-card space-y-1">
        <p className="im-label">Microphone check</p>
        <MicCheckResult micState={micState} level={level} />
      </div>

      {submitError && (
        <p className="text-sm" style={{ color: "var(--im-deep-red, #451f23)" }}>
          {submitError}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="btn-text"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={isSubmitting}
          className="btn-primary"
        >
          {isSubmitting ? "Please wait…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
