"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Synthesis, SynthesisDimension, WorkshopAgendaItem } from "../../../types";
import { ALIGNMENT_LABELS, ALIGNMENT_COLORS } from "../alignment-display";

type Screen =
  | { kind: "opening" }
  | { kind: "theme"; dimension: SynthesisDimension }
  | { kind: "workshopOpening" }
  | { kind: "agendaItem"; item: WorkshopAgendaItem }
  | { kind: "closingCapture" };

/**
 * Fixed, full-viewport, high z-index: this is the mechanism that hides the
 * admin header/nav chrome from app/admin/layout.tsx, since Next.js layouts
 * can't be opted out of by a nested route - it's covered rather than
 * removed from the tree.
 */
export default function PresenterView({
  projectId,
  projectName,
  synthesis,
  accessToken,
}: {
  projectId: string;
  projectName: string;
  synthesis: Synthesis;
  accessToken?: string;
}) {
  const basePath = accessToken ? `/project/${accessToken}` : `/admin/${projectId}`;
  const screens: Screen[] = [
    { kind: "opening" },
    ...synthesis.content.dimensions.map(
      (dimension): Screen => ({ kind: "theme", dimension })
    ),
    { kind: "workshopOpening" },
    ...synthesis.content.workshopPlan.agendaItems.map(
      (item): Screen => ({ kind: "agendaItem", item })
    ),
    { kind: "closingCapture" },
  ];

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  // Every time the facilitator lands on a screen - including revisiting one
  // - the basis/narrative starts hidden again. The facilitator decides in
  // the moment whether to show it to a room that contains the people who
  // were interviewed; it must never come up already expanded. Reset
  // directly alongside every navigation, rather than via an effect keyed on
  // index, so it's just a normal event-handler state update.
  function goTo(nextIndex: number) {
    setIndex(nextIndex);
    setRevealed(false);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => {
          const next = Math.min(i + 1, screens.length - 1);
          setRevealed(false);
          return next;
        });
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => {
          const next = Math.max(i - 1, 0);
          setRevealed(false);
          return next;
        });
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setRevealed((r) => !r);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // screens.length is stable for the lifetime of this component (derived
    // from the synthesis prop, which doesn't change), so it's left out of
    // the dependency array deliberately to avoid re-binding every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const screen = screens[index];

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ backgroundColor: "var(--im-white)" }}
    >
      <div className="flex items-center justify-between px-6 py-4">
        <Link
          href={`${basePath}/results`}
          className="text-sm"
          style={{ color: "var(--im-grey)" }}
        >
          &larr; Exit presentation
        </Link>
        <span className="text-sm" style={{ color: "var(--im-grey)" }}>
          {index + 1} / {screens.length}
        </span>
      </div>

      {/*
        my-auto on the child, not items-center on this flex container:
        items-center clips symmetrically top-and-bottom when content is
        taller than the viewport, with no reliable way to scroll to the
        true top - margin:auto still centers short content but collapses
        to 0 and scrolls normally once content overflows.
      */}
      <div className="flex flex-1 justify-center overflow-y-auto px-12 py-8">
        <div className="my-auto w-full max-w-5xl">
          {screen.kind === "opening" && (
            <OpeningScreen projectName={projectName} synthesis={synthesis} />
          )}
          {screen.kind === "theme" && (
            <ThemeScreen
              dimension={screen.dimension}
              revealed={revealed}
              onToggleReveal={() => setRevealed((r) => !r)}
            />
          )}
          {screen.kind === "workshopOpening" && (
            <WorkshopOpeningScreen openingFraming={synthesis.content.workshopPlan.openingFraming} />
          )}
          {screen.kind === "agendaItem" && (
            <AgendaItemScreen
              key={index}
              item={screen.item}
              revealed={revealed}
              onToggleReveal={() => setRevealed((r) => !r)}
            />
          )}
          {screen.kind === "closingCapture" && (
            <ClosingCaptureScreen template={synthesis.content.workshopPlan.closingTemplate} />
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-8 pb-8">
        <button
          type="button"
          onClick={() => goTo(Math.max(index - 1, 0))}
          disabled={index === 0}
          className="px-4 text-4xl leading-none disabled:opacity-20"
          style={{ color: "var(--im-blue-green)" }}
          aria-label="Previous screen"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => goTo(Math.min(index + 1, screens.length - 1))}
          disabled={index === screens.length - 1}
          className="px-4 text-4xl leading-none disabled:opacity-20"
          style={{ color: "var(--im-blue-green)" }}
          aria-label="Next screen"
        >
          ›
        </button>
      </div>
    </div>
  );
}

function OpeningScreen({
  projectName,
  synthesis,
}: {
  projectName: string;
  synthesis: Synthesis;
}) {
  return (
    <div className="space-y-10 text-center">
      <p
        className="text-2xl"
        style={{ color: "var(--im-grey)" }}
      >
        {projectName}
      </p>
      <h1
        className="im-display"
        style={{ color: "var(--im-black)", fontSize: "clamp(2.75rem, 6vw, 4.5rem)" }}
      >
        Top priorities to discuss
      </h1>
      <ul className="space-y-6 text-left">
        {synthesis.content.topPriorities.map((p, i) => (
          <li
            key={i}
            className="flex gap-4"
            style={{
              color: "var(--im-ash)",
              fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
              lineHeight: 1.3,
            }}
          >
            <span style={{ color: "var(--im-blue-green)" }}>—</span>
            <span>{p.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WorkshopOpeningScreen({ openingFraming }: { openingFraming: string }) {
  return (
    <div className="space-y-8 text-center">
      <h1
        className="im-display"
        style={{ color: "var(--im-black)", fontSize: "clamp(2.75rem, 6vw, 4.5rem)" }}
      >
        Opening framing
      </h1>
      <p
        style={{
          color: "var(--im-ash)",
          fontSize: "clamp(1.5rem, 3.25vw, 2.5rem)",
          lineHeight: 1.4,
        }}
      >
        {openingFraming}
      </p>
    </div>
  );
}

function formatTimer(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Given a fresh `key={index}` from the parent on every navigation (see
 * PresenterView), this remounts - and so resets its timer - each time the
 * facilitator lands on this screen, the same reset-on-navigation behaviour
 * as the reveal state above, just implemented locally since the timer is
 * this screen's own concern.
 */
function AgendaItemScreen({
  item,
  revealed,
  onToggleReveal,
}: {
  item: WorkshopAgendaItem;
  revealed: boolean;
  onToggleReveal: () => void;
}) {
  const [remainingSeconds, setRemainingSeconds] = useState(item.minutes * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setRemainingSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  return (
    <div className="space-y-8 text-center">
      {/* Deliberately small and muted - visible, not a dominant element.
          Never auto-advances the screen; the facilitator decides that. */}
      <div className="flex items-center justify-center gap-3">
        <span style={{ fontSize: "1rem", color: "var(--im-grey)" }}>
          {item.minutes} min allotted
        </span>
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          className="btn-secondary"
          style={{ fontSize: "0.875rem", padding: "0.3rem 0.8rem" }}
        >
          {running ? "Pause" : "Start"}
        </button>
        <span
          style={{
            fontSize: "1rem",
            fontFamily: "monospace",
            color: remainingSeconds === 0 ? "var(--im-deep-red, #451f23)" : "var(--im-grey)",
            minWidth: "3ch",
          }}
        >
          {formatTimer(remainingSeconds)}
        </span>
      </div>

      <h1
        className="im-display"
        style={{ color: "var(--im-black)", fontSize: "clamp(2.5rem, 6vw, 4.5rem)" }}
      >
        {item.shortTitle}
      </h1>

      <p
        style={{
          color: "var(--im-ash)",
          fontSize: "clamp(1.5rem, 3.25vw, 2.5rem)",
          lineHeight: 1.4,
        }}
      >
        {item.discussionPrompt}
      </p>

      <div>
        <button
          type="button"
          onClick={onToggleReveal}
          className="btn-secondary"
          style={{ fontSize: "1.125rem", padding: "0.6rem 1.5rem" }}
        >
          {revealed ? "Hide facilitator notes" : "Show facilitator notes"}
        </button>
      </div>

      {revealed && (
        <div
          className="space-y-6 border-t pt-8 text-left"
          style={{ borderColor: "var(--im-blue-green-light)" }}
        >
          <p style={{ color: "var(--im-ash)", fontSize: "1.25rem", lineHeight: 1.5 }}>
            <span className="font-bold">Full priority: </span>
            {item.priorityText}
          </p>
          <p style={{ color: "var(--im-ash)", fontSize: "1.25rem", lineHeight: 1.5 }}>
            <span className="font-bold">Hypothesis (deploy if discussion stalls or stays too polite): </span>
            {item.hypothesis}
          </p>
          <p style={{ color: "var(--im-ash)", fontSize: "1.25rem", lineHeight: 1.5 }}>
            <span className="font-bold">Exercise: </span>
            {item.exercise}
          </p>
        </div>
      )}
    </div>
  );
}

function ClosingCaptureScreen({ template }: { template: string }) {
  return (
    <div className="space-y-8 text-center">
      <h1
        className="im-display"
        style={{ color: "var(--im-black)", fontSize: "clamp(2.75rem, 6vw, 4.5rem)" }}
      >
        Closing
      </h1>
      <p
        className="whitespace-pre-line text-left"
        style={{
          color: "var(--im-ash)",
          fontSize: "clamp(1.25rem, 2.75vw, 2rem)",
          lineHeight: 1.6,
        }}
      >
        {template}
      </p>
    </div>
  );
}

function ThemeScreen({
  dimension,
  revealed,
  onToggleReveal,
}: {
  dimension: SynthesisDimension;
  revealed: boolean;
  onToggleReveal: () => void;
}) {
  return (
    <div className="space-y-10 text-center">
      <h1
        className="im-display"
        style={{ color: "var(--im-black)", fontSize: "clamp(3rem, 7vw, 5.5rem)" }}
      >
        {dimension.label}
      </h1>

      <p
        className="font-bold"
        style={{ color: "var(--im-black)", fontSize: "clamp(1.75rem, 4vw, 3rem)", lineHeight: 1.3 }}
      >
        {dimension.keyPoint}
      </p>

      {dimension.alignment ? (
        <div className="flex flex-col items-center gap-4">
          <span
            className="rounded-[4px] px-6 py-2 font-bold uppercase text-white"
            style={{
              backgroundColor: ALIGNMENT_COLORS[dimension.alignment.level],
              fontSize: "clamp(1.25rem, 2.5vw, 1.75rem)",
            }}
          >
            {ALIGNMENT_LABELS[dimension.alignment.level]}
          </span>
          <p
            style={{
              color: "var(--im-ash)",
              fontSize: "clamp(1.375rem, 2.75vw, 2rem)",
              lineHeight: 1.4,
            }}
          >
            {dimension.alignment.summary}
          </p>
        </div>
      ) : (
        <p
          className="italic"
          style={{ color: "var(--im-grey)", fontSize: "clamp(1.375rem, 2.75vw, 2rem)" }}
        >
          Too few participants to assess alignment.
        </p>
      )}

      <div>
        <button
          type="button"
          onClick={onToggleReveal}
          className="btn-secondary"
          style={{ fontSize: "1.125rem", padding: "0.6rem 1.5rem" }}
        >
          {revealed ? "Hide the basis for this" : "Show the basis for this"}
        </button>
      </div>

      {revealed && (
        <div
          className="space-y-6 border-t pt-8 text-left"
          style={{ borderColor: "var(--im-blue-green-light)" }}
        >
          <p style={{ color: "var(--im-ash)", fontSize: "1.25rem", lineHeight: 1.5 }}>
            {dimension.narrative}
          </p>
          {dimension.participantBases.length > 0 && (
            <ul className="list-disc space-y-2 pl-6" style={{ fontSize: "1.125rem" }}>
              {dimension.participantBases.map((basis, i) => (
                <li key={i} style={{ color: "var(--im-ash)" }}>
                  <span className="font-bold">{basis.ref}: </span>
                  {basis.paraphrase}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
