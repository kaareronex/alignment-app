import Link from "next/link";
import { logout } from "./auth-actions";

export default function AdminNav() {
  return (
    <nav className="mb-6 flex items-center justify-between border-b border-neutral-200 pb-4">
      <div className="flex gap-4 text-sm">
        <Link href="/admin" className="hover:underline">
          Projects
        </Link>
        <Link href="/admin/settings" className="hover:underline">
          Settings
        </Link>
      </div>
      <form action={logout}>
        <button
          type="submit"
          className="text-sm text-neutral-500 hover:underline"
        >
          Log out
        </button>
      </form>
    </nav>
  );
}
