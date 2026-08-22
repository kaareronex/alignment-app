import type { Synthesis, SynthesisPositionCategory } from "../../types";
import ExportMarkdownButton from "./export-markdown-button";

const CATEGORY_LABELS: Record<SynthesisPositionCategory, string> = {
  aligned: "Clearly aligned",
  mixed: "Mixed / hedging",
  concerned: "Clearly concerned",
  not_addressed: "Didn't meaningfully address",
};

const CATEGORY_ORDER: SynthesisPositionCategory[] = [
  "aligned",
  "mixed",
  "concerned",
  "not_addressed",
];

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
          <p className="text-sm" style={{ color: "var(--im-ash)" }}>{dim.narrative}</p>

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--im-blue-green-light)", color: "var(--im-grey)" }}>
                <th className="py-1 pr-2 font-medium">Role</th>
                {CATEGORY_ORDER.map((c) => (
                  <th key={c} className="py-1 pr-2 font-medium">
                    {CATEGORY_LABELS[c]}
                  </th>
                ))}
                <th className="py-1 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {dim.breakdown.map((row) => (
                <tr
                  key={row.roleLabel}
                  className="border-b"
                  style={{ borderColor: "var(--im-blue-green-near-white)", color: "var(--im-black)" }}
                >
                  <td className="py-1 pr-2">{row.roleLabel}</td>
                  {CATEGORY_ORDER.map((c) => (
                    <td key={c} className="py-1 pr-2">
                      {row[c]}
                    </td>
                  ))}
                  <td className="py-1">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
