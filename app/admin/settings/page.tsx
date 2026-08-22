import ChangePasswordForm from "./change-password-form";

export const dynamic = "force-dynamic";

export default function AdminSettingsPage() {
  return (
    <div>
      <h1 className="im-display mb-6 text-2xl" style={{ color: "var(--im-black)" }}>
        Settings
      </h1>
      <ChangePasswordForm />
    </div>
  );
}
