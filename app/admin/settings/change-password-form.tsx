"use client";

import { useActionState } from "react";
import { changePassword } from "../auth-actions";

export default function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState(
    changePassword,
    undefined
  );

  return (
    <form action={formAction} className="max-w-sm space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">
          Current password
        </label>
        <input
          type="password"
          name="currentPassword"
          required
          className="w-full rounded border border-neutral-300 p-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">
          New password
        </label>
        <input
          type="password"
          name="newPassword"
          required
          minLength={8}
          className="w-full rounded border border-neutral-300 p-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">
          Confirm new password
        </label>
        <input
          type="password"
          name="confirmNewPassword"
          required
          minLength={8}
          className="w-full rounded border border-neutral-300 p-2"
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && (
        <p className="text-sm text-green-600">Password changed.</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
