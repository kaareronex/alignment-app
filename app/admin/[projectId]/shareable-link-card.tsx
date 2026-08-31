"use client";

import { useState } from "react";

/**
 * NEXT_PUBLIC_APP_URL is set explicitly per environment (Vercel project
 * settings for production, .env.local for dev) rather than derived from
 * Vercel's VERCEL_URL - that variable points at the unique per-deployment
 * URL (e.g. a preview build's hash subdomain), not the stable production
 * domain participants are actually sent, so it would produce wrong links on
 * exactly the deployments where this matters most.
 */
function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  return (configured ?? "http://localhost:3000").replace(/\/$/, "");
}

export default function ShareableLinkCard({
  projectId,
}: {
  projectId: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle"
  );
  const link = `${getAppUrl()}/interview/${projectId}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopyState("copied");
    } catch {
      // Clipboard API can be denied (permissions policy, non-HTTPS context) -
      // fail visibly instead of leaving an unhandled rejection with no
      // feedback at all.
      setCopyState("failed");
    } finally {
      setTimeout(() => setCopyState("idle"), 2000);
    }
  }

  return (
    <div className="im-card" style={{ backgroundColor: "var(--im-light-grey)" }}>
      <p className="text-sm" style={{ color: "var(--im-grey)" }}>
        Shareable interview link:
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
      </div>
    </div>
  );
}
