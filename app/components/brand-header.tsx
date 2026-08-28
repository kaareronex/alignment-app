/**
 * Groundwork wordmark + Implement logo, shared by the admin and
 * participant-facing shells. "dark" is the Anthracite admin header (white
 * logo badge); "light" is the participant-facing pages (black logo on
 * transparent).
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
      className="flex items-center justify-between px-6 py-4 sm:px-8"
    >
      <span
        className="im-brand-wordmark"
        style={{ color: isDark ? "var(--im-white)" : "var(--im-black)" }}
      >
        Groundwork
      </span>
      <img
        src={isDark ? "/brand/logo_full_white.png" : "/brand/logo_full_black.png"}
        alt="Implement Consulting Group"
        style={{ height: "26px", width: "auto" }}
      />
    </header>
  );
}
