import type { Synthesis, SynthesisAlignmentLevel } from "../../types";
import ExportMarkdownButton from "./export-markdown-button";

const ALIGNMENT_LABELS: Record<SynthesisAlignmentLevel, string> = {
  consensus: "Consensus",
  partial: "Partial",
  divided: "Divided",
};

const ALIGNMENT_COLORS: Record<SynthesisAlignmentLevel, string> = {
  consensus: "var(--im-blue-green)",
  partial: "var(--im-yellow, #e4b73c)",
  divided: "var(--im-deep-red, #451f23)",
};

export default function SynthesisView({
  projectName,
  synthesis,
}: {
  projectName: string;
  synthesis: Synthesis;
}) {
  const generatedAt = new Date(synthesis.generated_at).toLocaleString("en-GB");

  return (
    <div className="space-y-8">
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-[2px] border p-3 text-sm"
        style={{ borderColor: "var(--im-blue-green-light)", backgroundColor: "var(--im-light-grey)", color: "var(--im-ash)" }}
      >
        <span>
          Generated {generatedAt} from {synthesis.content.sessionCount}{" "}
          completed session
          {synthesis.content.sessionCount === 1 ? "" : "s"}.
        </span>
        <ExportMarkdownButton projectName={projectName} synthesis={synthesis} />
      </div>

      <section className="im-card space-y-2">
        <h2 className="im-display text-lg" style={{ color: "var(--im-black)" }}>
          Top priorities to discuss
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm" style={{ color: "var(--im-ash)" }}>
          {synthesis.content.topPriorities.map((p, i) => (
            <li key={i}>{p.text}</li>
          ))}
        </ul>
      </section>

      {synthesis.content.dimensions.map((dim) => (
        <section key={dim.dimensionId} className="im-card space-y-3">
          <h2 className="im-display text-lg" style={{ color: "var(--im-black)" }}>
            {dim.label}
          </h2>
          <p className="text-sm font-bold" style={{ color: "var(--im-black)" }}>
            {dim.keyPoint}
          </p>

          {dim.alignment ? (
            <div className="flex items-start gap-2">
              <span
                className="shrink-0 rounded-[2px] px-2 py-0.5 text-xs font-bold uppercase text-white"
                style={{ backgroundColor: ALIGNMENT_COLORS[dim.alignment.level] }}
              >
                {ALIGNMENT_LABELS[dim.alignment.level]}
              </span>
              <p className="text-sm" style={{ color: "var(--im-ash)" }}>
                {dim.alignment.summary}
              </p>
            </div>
          ) : (
            <p className="text-sm italic" style={{ color: "var(--im-grey)" }}>
              Too few participants to assess alignment.
            </p>
          )}

          <p className="text-sm" style={{ color: "var(--im-ash)" }}>{dim.narrative}</p>

          {dim.participantBases.length > 0 && (
            <details>
              <summary
                className="cursor-pointer text-sm font-bold"
                style={{ color: "var(--im-blue-green)" }}
              >
                See the basis for this ({dim.participantBases.length}{" "}
                participant{dim.participantBases.length === 1 ? "" : "s"})
              </summary>
              <ul
                className="mt-2 list-disc space-y-1 pl-5 text-sm"
                style={{ color: "var(--im-ash)" }}
              >
                {dim.participantBases.map((basis, i) => (
                  <li key={i}>
                    <span className="font-bold">{basis.ref}: </span>
                    {basis.paraphrase}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      ))}

      <section className="im-card space-y-4">
        <h2 className="im-display text-lg" style={{ color: "var(--im-black)" }}>
          Workshop plan for your session ({synthesis.content.workshopPlan.totalMinutes} min)
        </h2>

        <div>
          <h3 className="text-sm font-bold" style={{ color: "var(--im-blue-green)" }}>
            Opening ({synthesis.content.workshopPlan.openingMinutes} min)
          </h3>
          <p className="text-sm" style={{ color: "var(--im-ash)" }}>
            {synthesis.content.workshopPlan.openingFraming}
          </p>
        </div>

        {synthesis.content.workshopPlan.agendaItems.map((item, i) => (
          <div
            key={i}
            className="space-y-1 border-t pt-3"
            style={{ borderColor: "var(--im-blue-green-near-white)" }}
          >
            <h3 className="text-sm font-bold" style={{ color: "var(--im-black)" }}>
              {item.priorityText} ({item.minutes} min)
            </h3>
            <p className="text-sm" style={{ color: "var(--im-ash)" }}>
              <span className="font-bold">Discussion prompt: </span>
              {item.discussionPrompt}
            </p>
            <p className="text-sm" style={{ color: "var(--im-ash)" }}>
              <span className="font-bold">Hypothesis: </span>
              {item.hypothesis}
            </p>
            <p className="text-sm" style={{ color: "var(--im-ash)" }}>
              <span className="font-bold">Exercise: </span>
              {item.exercise}
            </p>
          </div>
        ))}

        <div className="border-t pt-3" style={{ borderColor: "var(--im-blue-green-near-white)" }}>
          <h3 className="text-sm font-bold" style={{ color: "var(--im-blue-green)" }}>
            Closing ({synthesis.content.workshopPlan.closingMinutes} min)
          </h3>
          <p className="whitespace-pre-line text-sm" style={{ color: "var(--im-ash)" }}>
            {synthesis.content.workshopPlan.closingTemplate}
          </p>
        </div>
      </section>
    </div>
  );
}
