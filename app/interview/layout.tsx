import BrandHeader from "../components/brand-header";

export default function InterviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col" style={{ backgroundColor: "var(--im-egg)" }}>
      <BrandHeader variant="light" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 sm:px-8">
        {children}
      </main>
    </div>
  );
}
