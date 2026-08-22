"use client";

import { useActionState } from "react";
import { submitAdminPassword } from "../auth-actions";

export default function LoginForm({
  hasPasswordSet,
}: {
  hasPasswordSet: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    submitAdminPassword,
    undefined
  );

  return (
    <form action={formAction} className="max-w-sm space-y-4">
      <h1 className="im-display text-2xl" style={{ color: "var(--im-black)" }}>
        {hasPasswordSet ? "Admin login" : "Set admin password"}
      </h1>
      {!hasPasswordSet && (
        <p className="text-sm" style={{ color: "var(--im-grey)" }}>
          No admin password has been set yet. Choose one now to protect the
          admin area.
        </p>
      )}

      <div>
        <label className="im-label">
          {hasPasswordSet ? "Password" : "New password"}
        </label>
        <input
          type="password"
          name="password"
          required
          minLength={hasPasswordSet ? undefined : 8}
          autoFocus
          className="im-input"
        />
      </div>

      {!hasPasswordSet && (
        <div>
          <label className="im-label">Confirm password</label>
          <input
            type="password"
            name="confirmPassword"
            required
            minLength={8}
            className="im-input"
          />
        </div>
      )}

      {state?.error && (
        <p className="text-sm" style={{ color: "var(--im-deep-red, #451f23)" }}>
          {state.error}
        </p>
      )}

      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending
          ? "Please wait…"
          : hasPasswordSet
            ? "Log in"
            : "Set password"}
      </button>
    </form>
  );
}
