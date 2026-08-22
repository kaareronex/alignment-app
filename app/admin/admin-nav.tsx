import Link from "next/link";
import { logout } from "./auth-actions";

export default function AdminNav() {
  return (
    <nav
      className="mb-6 flex items-center justify-between border-b pb-4"
      style={{ borderColor: "var(--im-blue-green-light)" }}
    >
      <div className="flex gap-4 text-sm">
        <Link href="/admin" className="im-link">
          Projects
        </Link>
        <Link href="/admin/settings" className="im-link">
          Settings
        </Link>
      </div>
      <form action={logout}>
        <button type="submit" className="btn-text">
          Log out
        </button>
      </form>
    </nav>
  );
}
