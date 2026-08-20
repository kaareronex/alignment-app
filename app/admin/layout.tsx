import { getAdminSession } from "@/lib/admin-session";
import AdminNav from "./admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  return (
    <main className="mx-auto max-w-3xl p-8">
      {session && <AdminNav />}
      {children}
    </main>
  );
}
