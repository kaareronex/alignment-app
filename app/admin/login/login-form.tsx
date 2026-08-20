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
      <h1 className="text-2xl font-semibold">
        {hasPasswordSet ? "Admin login" : "Set admin password"}
      </h1>
      {!hasPasswordSet && (
        <p className="text-sm text-neutral-500">
          No admin password has been set yet. Choose one now to protect the
          admin area.
        </p>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">
          {hasPasswordSet ? "Password" : "New password"}
        </label>
        <input
          type="password"
          name="password"
          required
          minLength={hasPasswordSet ? undefined : 8}
          autoFocus
          className="w-full rounded border border-neutral-300 p-2"
        />
      </div>

      {!hasPasswordSet && (
        <div>
          <label className="mb-1 block text-sm font-medium">
            Confirm password
          </label>
          <input
            type="password"
            name="confirmPassword"
            required
            minLength={8}
            className="w-full rounded border border-neutral-300 p-2"
          />
        </div>
      )}

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {isPending
          ? "Please wait…"
          : hasPasswordSet
            ? "Log in"
            : "Set password"}
      </button>
    </form>
  );
}
