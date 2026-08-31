export default function IntroScreen({
  minutesText,
  onContinue,
}: {
  minutesText: string;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-8">
      <h1 className="im-display text-3xl" style={{ color: "var(--im-black)" }}>
        Before you begin
      </h1>

      <div className="im-card space-y-4">
        <p style={{ color: "var(--im-ash)" }}>
          You&apos;ve been invited to take part in a Groundwork interview -
          a short, honest conversation with an AI interviewer, not a form to
          fill in. It takes {minutesText}, and works best as an unscripted
          chat about how you really see things.
        </p>
        <p style={{ color: "var(--im-ash)" }}>
          <strong>Your individual answers are always anonymous.</strong> You
          pick your own name only to get access to the interview - what you
          say is never shown to anyone with your name attached. Only your
          role or function is used when the results are shared back with the
          leadership team, and even then, only when at least one other
          person shares that same role, so you can&apos;t be singled out by
          it either.
        </p>
        <p style={{ color: "var(--im-ash)" }}>
          On the next screen, you&apos;ll choose the language for your
          interview — the AI interviewer will conduct the whole conversation
          in it from the first question onwards.
        </p>
      </div>

      <button type="button" onClick={onContinue} className="btn-primary">
        Continue
      </button>
    </div>
  );
}
