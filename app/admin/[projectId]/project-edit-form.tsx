"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProject } from "../actions";
import {
  MIN_DIMENSIONS,
  MAX_DIMENSIONS,
  type FramingDimension,
} from "../framing-defaults";
import type { Leader, Project } from "../types";
import ShareableLinkCard from "./shareable-link-card";

type LeaderRow = { id: string | null; name: string; role_label: string };

export default function ProjectEditForm({
  project,
  leaders,
}: {
  project: Project;
  leaders: Leader[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(project.name);
  const [strategyContext, setStrategyContext] = useState(
    project.strategy_context ?? ""
  );
  const [sessionPurpose, setSessionPurpose] = useState(
    project.session_purpose ?? ""
  );
  const [dimensions, setDimensions] = useState<FramingDimension[]>(
    project.framing_definitions ?? []
  );
  const [maxQuestions, setMaxQuestions] = useState(project.max_questions);
  const [accessMode, setAccessMode] = useState<"lobby" | "open">(
    project.access_mode
  );
  const [timeLimitEnabled, setTimeLimitEnabled] = useState(
    project.time_limit_enabled
  );
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(
    project.time_limit_minutes ?? 15
  );

  const [leaderRows, setLeaderRows] = useState<LeaderRow[]>(
    leaders.map((l) => ({ id: l.id, name: l.name, role_label: l.role_label }))
  );
  const [removedLeaderIds, setRemovedLeaderIds] = useState<string[]>([]);

  function addLeaderRow() {
    setLeaderRows((rows) => [...rows, { id: null, name: "", role_label: "" }]);
  }

  function updateLeaderRow(index: number, patch: Partial<LeaderRow>) {
    setLeaderRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function removeLeaderRow(index: number) {
    setLeaderRows((rows) => {
      const target = rows[index];
      if (target.id) {
        setRemovedLeaderIds((ids) => [...ids, target.id as string]);
      }
      return rows.filter((_, i) => i !== index);
    });
  }

  function updateDimension(index: number, patch: Partial<FramingDimension>) {
    setDimensions((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function addDimension() {
    setDimensions((rows) =>
      rows.length >= MAX_DIMENSIONS
        ? rows
        : [...rows, { id: crypto.randomUUID(), label: "", description: "" }]
    );
  }

  function removeDimension(index: number) {
    setDimensions((rows) =>
      rows.length <= MIN_DIMENSIONS ? rows : rows.filter((_, i) => i !== index)
    );
  }

  function moveDimension(index: number, direction: -1 | 1) {
    setDimensions((rows) => {
      const target = index + direction;
      if (target < 0 || target >= rows.length) return rows;
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      try {
        const result = await saveProject(project.id, {
          name,
          strategy_context: strategyContext,
          session_purpose: sessionPurpose,
          framing_definitions: dimensions,
          max_questions: maxQuestions,
          access_mode: accessMode,
          time_limit_enabled: timeLimitEnabled,
          time_limit_minutes: timeLimitMinutes,
          leaders: leaderRows,
          removedLeaderIds,
        });
        setLeaderRows(
          result.leaders.map((l) => ({
            id: l.id,
            name: l.name,
            role_label: l.role_label,
          }))
        );
        setRemovedLeaderIds([]);
        setSaved(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <label className="im-label">Project name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="im-input"
        />
      </div>

      <div>
        <label className="im-label">Strategy context</label>
        <textarea
          rows={6}
          value={strategyContext}
          onChange={(e) => setStrategyContext(e.target.value)}
          className="im-input"
        />
      </div>

      <div>
        <label className="im-label">Session purpose</label>
        <textarea
          rows={3}
          value={sessionPurpose}
          onChange={(e) => setSessionPurpose(e.target.value)}
          className="im-input"
        />
      </div>

      <div>
        <h2 className="im-display mb-2 text-lg" style={{ color: "var(--im-black)" }}>
          Framing dimensions
        </h2>
        <p className="mb-4 text-sm" style={{ color: "var(--im-grey)" }}>
          These definitions aren&apos;t shown to participants directly — they
          guide the AI interviewer&apos;s judgement about what counts as
          each dimension when it generates follow-up questions and later
          builds the synthesis. Rename these to fit how you want the AI to
          frame its questions — for example, replace &quot;Disagreement&quot;
          with &quot;How people really feel about the strategy&quot; if that
          fits your context better. You can also add, remove, and reorder
          dimensions (between {MIN_DIMENSIONS} and {MAX_DIMENSIONS}).
        </p>
        <div className="space-y-4">
          {dimensions.map((dim, i) => (
            <div key={dim.id} className="im-card space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => moveDimension(i, -1)}
                  disabled={i === 0}
                  className="px-1 text-sm disabled:opacity-30"
                  style={{ color: "var(--im-grey)" }}
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveDimension(i, 1)}
                  disabled={i === dimensions.length - 1}
                  className="px-1 text-sm disabled:opacity-30"
                  style={{ color: "var(--im-grey)" }}
                  aria-label="Move down"
                >
                  ↓
                </button>
                <input
                  type="text"
                  value={dim.label}
                  onChange={(e) =>
                    updateDimension(i, { label: e.target.value })
                  }
                  placeholder="Label"
                  required
                  className="im-input flex-1 font-medium"
                />
                <button
                  type="button"
                  onClick={() => removeDimension(i)}
                  disabled={dimensions.length <= MIN_DIMENSIONS}
                  className="btn-danger-text px-2 py-2 disabled:opacity-30"
                >
                  Remove
                </button>
              </div>
              <textarea
                rows={3}
                value={dim.description}
                onChange={(e) =>
                  updateDimension(i, { description: e.target.value })
                }
                placeholder="Description"
                className="im-input"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addDimension}
          disabled={dimensions.length >= MAX_DIMENSIONS}
          className="btn-text mt-3 disabled:opacity-30"
        >
          + Add dimension
        </button>
      </div>

      <div>
        <label className="im-label">Max questions</label>
        <input
          type="number"
          min={1}
          value={maxQuestions}
          onChange={(e) => setMaxQuestions(Number(e.target.value))}
          required
          className="im-input w-32"
        />
      </div>

      <fieldset>
        <legend className="im-label">Access mode</legend>
        <label className="mr-4 inline-flex items-center gap-1 text-sm">
          <input
            type="radio"
            name="access_mode"
            checked={accessMode === "lobby"}
            onChange={() => setAccessMode("lobby")}
          />
          Lobby
        </label>
        <label className="inline-flex items-center gap-1 text-sm">
          <input
            type="radio"
            name="access_mode"
            checked={accessMode === "open"}
            onChange={() => setAccessMode("open")}
          />
          Open
        </label>
      </fieldset>

      <div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={timeLimitEnabled}
            onChange={(e) => setTimeLimitEnabled(e.target.checked)}
          />
          Time limit enabled
        </label>
        {timeLimitEnabled && (
          <div className="mt-2">
            <label className="im-label">Time limit (minutes)</label>
            <input
              type="number"
              min={1}
              value={timeLimitMinutes}
              onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
              className="im-input w-32"
            />
          </div>
        )}
      </div>

      <div>
        <h2 className="im-display mb-2 text-lg" style={{ color: "var(--im-black)" }}>
          Participants
        </h2>
        <div className="space-y-2">
          {leaderRows.map((row, i) => (
            <div key={row.id ?? `new-${i}`} className="flex items-start gap-2">
              <input
                type="text"
                placeholder="Name"
                value={row.name}
                onChange={(e) => updateLeaderRow(i, { name: e.target.value })}
                className="im-input flex-1"
              />
              <input
                type="text"
                placeholder="Role (e.g. Sales Director)"
                value={row.role_label}
                onChange={(e) =>
                  updateLeaderRow(i, { role_label: e.target.value })
                }
                className="im-input flex-1"
              />
              <button
                type="button"
                onClick={() => removeLeaderRow(i)}
                className="btn-danger-text px-2 py-2"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addLeaderRow} className="btn-text mt-3">
          + Add participant
        </button>
      </div>

      <ShareableLinkCard
        projectId={project.id}
        isActive={project.status === "active"}
      />

      {error && (
        <p className="text-sm" style={{ color: "var(--im-deep-red, #451f23)" }}>
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Saving…" : "Save"}
        </button>
        {saved && !isPending && (
          <span className="text-sm" style={{ color: "var(--im-blue-green)" }}>
            Saved.
          </span>
        )}
      </div>
    </form>
  );
}
