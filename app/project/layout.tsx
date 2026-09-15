import BrandHeader from "../components/brand-header";

/**
 * Deliberately no admin nav here (no "Projects" list, no "Settings", no
 * "Log out") - unlike app/admin/layout.tsx, this shell is reached with a
 * project-scoped access token, not an admin session, and must not offer any
 * link back into the real admin surface.
 */
export default function ProjectAccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col" style={{ backgroundColor: "var(--im-light-grey)" }}>
      <BrandHeader variant="dark" />
      <main className="mx-auto w-full max-w-3xl flex-1 p-8">{children}</main>
    </div>
  );
}
