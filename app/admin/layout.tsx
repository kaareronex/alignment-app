import { getAdminSession } from "@/lib/admin-session";
import BrandHeader from "../components/brand-header";
import AdminNav from "./admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  return (
    <div className="flex min-h-full flex-col" style={{ backgroundColor: "var(--im-light-grey)" }}>
      <BrandHeader variant="dark" />
      <main className="mx-auto w-full max-w-3xl flex-1 p-8">
        {session && <AdminNav />}
        {children}
      </main>
    </div>
  );
}
