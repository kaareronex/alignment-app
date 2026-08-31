"use client";

import { useEffect, useRef, useState } from "react";

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function VoiceInputButton({
  lang,
  disabled,
  baseTextRef,
  onTranscriptChange,
}: {
  lang: string;
  disabled?: boolean;
  baseTextRef: React.MutableRefObject<string>;
  onTranscriptChange: (text: string) => void;
}) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Bumped every time a recognition session is stopped/invalidated, so a
  // result that arrives after the fact (recognition.stop() doesn't end the
  // session synchronously - a trailing onresult/onend can still fire once
  // it finishes processing buffered audio) can be told apart from one that
  // still belongs to the session currently driving the answer field.
  const activeRecognitionIdRef = useRef(0);

  useEffect(() => {
    // Browser API support can only be checked client-side; this is the
    // standard isClient-detection pattern, not an external-state sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSupported(getSpeechRecognitionCtor() !== null);
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  // The parent disables this button while the answer is being submitted -
  // stop listening then too, and invalidate the session so a trailing
  // result can't repopulate the field right after it's cleared for the
  // next question. Not setting isListening here directly: stop() triggers
  // onend asynchronously, which updates it.
  useEffect(() => {
    if (!disabled) return;
    activeRecognitionIdRef.current++;
    recognitionRef.current?.stop();
  }, [disabled]);

  function handleToggle() {
    if (isListening) {
      activeRecognitionIdRef.current++;
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    setMicError(null);
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    const recognitionId = ++activeRecognitionIdRef.current;
    const startingText = baseTextRef.current;
    let finalTranscript = "";

    recognition.onresult = (event) => {
      if (activeRecognitionIdRef.current !== recognitionId) return;
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + " ";
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      const combined = [startingText, finalTranscript + interimTranscript]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" ");
      onTranscriptChange(combined);
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      if (activeRecognitionIdRef.current !== recognitionId) return;
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        setMicError(
          "Microphone access was blocked. Allow it in your browser's site settings to use voice input."
        );
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setMicError("Voice input stopped unexpectedly. You can type instead.");
      }
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  if (!isSupported) {
    return (
      <button
        type="button"
        disabled
        title="Voice input isn't supported in this browser"
        className="btn-secondary shrink-0 px-3 py-1.5 text-xs opacity-40"
      >
        🎤 Voice
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        title={isListening ? "Stop voice input" : "Start voice input"}
        className="btn-secondary shrink-0 px-3 py-1.5 text-xs disabled:opacity-40"
        style={
          isListening
            ? { backgroundColor: "var(--im-deep-red, #451f23)", color: "white" }
            : undefined
        }
      >
        {isListening ? "● Listening…" : "🎤 Voice"}
      </button>
      {micError && (
        <p className="text-xs" style={{ color: "var(--im-deep-red, #451f23)" }}>
          {micError}
        </p>
      )}
    </div>
  );
}
