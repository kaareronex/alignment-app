"use client";

import { useState, useTransition } from "react";
import { regenerateProjectAccessToken } from "../actions";

function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  return (configured ?? "http://localhost:3000").replace(/\/$/, "");
}

export default function ConsultantAccessLinkCard({
  projectId,
  accessToken,
}: {
  projectId: string;
  accessToken: string;
}) {
  const [token, setToken] = useState(accessToken);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const link = `${getAppUrl()}/project/${token}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    } finally {
      setTimeout(() => setCopyState("idle"), 2000);
    }
  }

  function handleRegenerate() {
    if (
      !confirm(
        "Regenerate this link? The current link will stop working immediately - anyone still using it will need the new one."
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await regenerateProjectAccessToken(projectId);
        setToken(result.accessToken);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to regenerate link.");
      }
    });
  }

  return (
    <div className="im-card" style={{ backgroundColor: "var(--im-light-grey)" }}>
      <p className="text-sm" style={{ color: "var(--im-grey)" }}>
        Consultant access link — full edit rights to this project only:
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="im-link break-all text-sm"
        >
          {link}
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className="btn-secondary shrink-0 px-3 py-1.5 text-xs"
        >
          {copyState === "copied"
            ? "Copied!"
            : copyState === "failed"
              ? "Couldn't copy"
              : "Copy link"}
        </button>
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={isPending}
          className="btn-danger-text shrink-0 text-xs disabled:opacity-50"
        >
          {isPending ? "Regenerating…" : "Regenerate link"}
        </button>
      </div>
      {error && (
        <p className="mt-1 text-xs" style={{ color: "var(--im-deep-red, #451f23)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
