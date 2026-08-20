import ChangePasswordForm from "./change-password-form";

export const dynamic = "force-dynamic";

export default function AdminSettingsPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>
      <ChangePasswordForm />
    </div>
  );
}
