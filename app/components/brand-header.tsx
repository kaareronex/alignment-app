/**
 * Plain-text Groundwork wordmark, shared by the admin and participant-facing
 * shells. "dark" is the dark admin header; "light" is the participant-facing
 * pages (dark text on a white bar).
 */
export default function BrandHeader({
  variant,
}: {
  variant: "dark" | "light";
}) {
  const isDark = variant === "dark";

  return (
    <header
      style={{
        backgroundColor: isDark ? "var(--im-black)" : "var(--im-white)",
        borderBottom: isDark ? "none" : "1px solid var(--im-blue-green-light)",
      }}
      className="flex items-center px-6 py-4 sm:px-8"
    >
      <span
        className="im-brand-wordmark"
        style={{ color: isDark ? "var(--im-white)" : "var(--im-black)" }}
      >
        Groundwork
      </span>
    </header>
  );
}
