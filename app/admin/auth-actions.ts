"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import {
  createAdminSessionCookie,
  clearAdminSessionCookie,
  requireAdminSession,
} from "@/lib/admin-session";

const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_COST_FACTOR = 12;

export type AuthFormState = { error?: string; success?: boolean } | undefined;

async function getAppSettings() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("id, admin_password_hash")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { id: string; admin_password_hash: string } | null;
}

export async function submitAdminPassword(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const existing = await getAppSettings();

  if (!existing) {
    // First run: no password set yet, so this submission sets it.
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    if (password.length < MIN_PASSWORD_LENGTH) {
      return {
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      };
    }
    if (password !== confirmPassword) {
      return { error: "Passwords do not match." };
    }

    const hash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("app_settings")
      .insert({ admin_password_hash: hash });
    if (error) throw new Error(error.message);

    await createAdminSessionCookie();
    redirect("/admin");
  }

  const isValid = await bcrypt.compare(password, existing.admin_password_hash);
  if (!isValid) {
    return { error: "Incorrect password." };
  }

  await createAdminSessionCookie();
  redirect("/admin");
}

export async function logout() {
  await clearAdminSessionCookie();
  redirect("/admin/login");
}

export async function changePassword(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  await requireAdminSession();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmNewPassword = String(formData.get("confirmNewPassword") ?? "");

  const existing = await getAppSettings();
  if (!existing) {
    return { error: "No admin password is set yet." };
  }

  const isValid = await bcrypt.compare(
    currentPassword,
    existing.admin_password_hash
  );
  if (!isValid) {
    return { error: "Current password is incorrect." };
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (newPassword !== confirmNewPassword) {
    return { error: "New passwords do not match." };
  }

  const hash = await bcrypt.hash(newPassword, BCRYPT_COST_FACTOR);
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("app_settings")
    .update({ admin_password_hash: hash })
    .eq("id", existing.id);
  if (error) throw new Error(error.message);

  return { success: true };
}
