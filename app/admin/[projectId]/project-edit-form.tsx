"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProject } from "../actions";
import { FRAMING_DIMENSIONS } from "../framing-defaults";
import type { Leader, Project } from "../types";

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
  const [framingDefinitions, setFramingDefinitions] = useState<
    Record<string, string>
  >(project.framing_definitions ?? {});
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
          framing_definitions: framingDefinitions,
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
        <label className="mb-1 block text-sm font-medium">
          Project name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded border border-neutral-300 p-2"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Strategy context
        </label>
        <textarea
          rows={6}
          value={strategyContext}
          onChange={(e) => setStrategyContext(e.target.value)}
          className="w-full rounded border border-neutral-300 p-2"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Session purpose
        </label>
        <textarea
          rows={3}
          value={sessionPurpose}
          onChange={(e) => setSessionPurpose(e.target.value)}
          className="w-full rounded border border-neutral-300 p-2"
        />
      </div>

      <div>
        <h2 className="mb-2 text-lg font-medium">Framing definitions</h2>
        <p className="mb-4 text-sm text-neutral-500">
          These definitions aren&apos;t shown to leaders directly — they
          guide the AI interviewer&apos;s judgement about what counts as
          disagreement, out-of-scope, importance, and success when it
          generates follow-up questions and later builds the synthesis.
          Rewrite them freely to match this organisation&apos;s context.
        </p>
        <div className="space-y-4">
          {FRAMING_DIMENSIONS.map((dim) => (
            <div key={dim.key}>
              <label className="mb-1 block text-sm font-medium">
                {dim.label}
              </label>
              <textarea
                rows={3}
                value={framingDefinitions[dim.key] ?? ""}
                onChange={(e) =>
                  setFramingDefinitions((prev) => ({
                    ...prev,
                    [dim.key]: e.target.value,
                  }))
                }
                className="w-full rounded border border-neutral-300 p-2"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Max questions
        </label>
        <input
          type="number"
          min={1}
          value={maxQuestions}
          onChange={(e) => setMaxQuestions(Number(e.target.value))}
          required
          className="w-32 rounded border border-neutral-300 p-2"
        />
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Access mode</legend>
        <label className="mr-4 inline-flex items-center gap-1">
          <input
            type="radio"
            name="access_mode"
            checked={accessMode === "lobby"}
            onChange={() => setAccessMode("lobby")}
          />
          Lobby
        </label>
        <label className="inline-flex items-center gap-1">
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
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={timeLimitEnabled}
            onChange={(e) => setTimeLimitEnabled(e.target.checked)}
          />
          Time limit enabled
        </label>
        {timeLimitEnabled && (
          <div className="mt-2">
            <label className="mb-1 block text-sm font-medium">
              Time limit (minutes)
            </label>
            <input
              type="number"
              min={1}
              value={timeLimitMinutes}
              onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
              className="w-32 rounded border border-neutral-300 p-2"
            />
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-lg font-medium">Leaders</h2>
        <div className="space-y-2">
          {leaderRows.map((row, i) => (
            <div key={row.id ?? `new-${i}`} className="flex items-start gap-2">
              <input
                type="text"
                placeholder="Name"
                value={row.name}
                onChange={(e) => updateLeaderRow(i, { name: e.target.value })}
                className="flex-1 rounded border border-neutral-300 p-2"
              />
              <input
                type="text"
                placeholder="Role (e.g. Sales Director)"
                value={row.role_label}
                onChange={(e) =>
                  updateLeaderRow(i, { role_label: e.target.value })
                }
                className="flex-1 rounded border border-neutral-300 p-2"
              />
              <button
                type="button"
                onClick={() => removeLeaderRow(i)}
                className="px-2 py-2 text-sm text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addLeaderRow}
          className="mt-3 text-sm underline"
        >
          + Add leader
        </button>
      </div>

      <div className="rounded border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-sm text-neutral-500">
          Shareable interview link (not active yet):
        </p>
        <code className="mt-1 block">/interview/{project.id}</code>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        {saved && !isPending && (
          <span className="text-sm text-green-600">Saved.</span>
        )}
      </div>
    </form>
  );
}
