"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateWorkshopDuration } from "../../actions";

export default function WorkshopDurationField({
  projectId,
  initialMinutes,
  accessToken,
}: {
  projectId: string;
  initialMinutes: number;
  accessToken?: string;
}) {
  const router = useRouter();
  const [minutes, setMinutes] = useState(initialMinutes);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateWorkshopDuration(projectId, minutes, accessToken);
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <label className="text-sm" style={{ color: "var(--im-ash)" }} htmlFor="workshop-duration">
          Workshop length
        </label>
        <input
          id="workshop-duration"
          type="number"
          min={15}
          max={480}
          step={5}
          value={minutes}
          onChange={(e) => {
            setMinutes(Number(e.target.value));
            setSaved(false);
          }}
          className="im-input w-20"
        />
        <span className="text-sm" style={{ color: "var(--im-grey)" }}>
          min
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || minutes === initialMinutes}
          className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
      {saved && (
        <span className="text-xs" style={{ color: "var(--im-blue-green)" }}>
          Saved — regenerate the synthesis to apply the new timing.
        </span>
      )}
      {error && (
        <span className="text-xs" style={{ color: "var(--im-deep-red, #451f23)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
