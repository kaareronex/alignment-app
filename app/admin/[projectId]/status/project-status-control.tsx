"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProjectStatus } from "../../actions";

type Status = "draft" | "active" | "closed";

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
];

export default function ProjectStatusControl({
  projectId,
  status,
}: {
  projectId: string;
  status: Status;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Status>(status);
  const [isPending, startTransition] = useTransition();

  function handleUpdate() {
    startTransition(async () => {
      await updateProjectStatus(projectId, selected);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium" htmlFor="project-status">
        Project status
      </label>
      <select
        id="project-status"
        value={selected}
        onChange={(e) => setSelected(e.target.value as Status)}
        className="rounded border border-neutral-300 p-2 text-sm"
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleUpdate}
        disabled={isPending || selected === status}
        className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {isPending ? "Updating…" : "Update"}
      </button>
    </div>
  );
}
