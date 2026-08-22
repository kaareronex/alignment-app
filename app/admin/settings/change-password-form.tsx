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
        <label className="im-label">Current password</label>
        <input
          type="password"
          name="currentPassword"
          required
          className="im-input"
        />
      </div>
      <div>
        <label className="im-label">New password</label>
        <input
          type="password"
          name="newPassword"
          required
          minLength={8}
          className="im-input"
        />
      </div>
      <div>
        <label className="im-label">Confirm new password</label>
        <input
          type="password"
          name="confirmNewPassword"
          required
          minLength={8}
          className="im-input"
        />
      </div>

      {state?.error && (
        <p className="text-sm" style={{ color: "var(--im-deep-red, #451f23)" }}>
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="text-sm" style={{ color: "var(--im-blue-green)" }}>
          Password changed.
        </p>
      )}

      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
