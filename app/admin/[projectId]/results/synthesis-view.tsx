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
      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">
        <span>
          Generated {generatedAt} from {synthesis.content.sessionCount}{" "}
          completed session
          {synthesis.content.sessionCount === 1 ? "" : "s"}.
        </span>
        <ExportMarkdownButton projectName={projectName} synthesis={synthesis} />
      </div>

      <section className="space-y-2 rounded border border-neutral-200 p-4">
        <h2 className="text-lg font-semibold">Top priorities to discuss</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {synthesis.content.topPriorities.map((p, i) => (
            <li key={i}>{p.text}</li>
          ))}
        </ul>
      </section>

      {synthesis.content.dimensions.map((dim) => (
        <section key={dim.dimensionId} className="space-y-3 rounded border border-neutral-200 p-4">
          <h2 className="text-lg font-semibold">{dim.label}</h2>
          <p className="text-sm text-neutral-700">{dim.narrative}</p>

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
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
                <tr key={row.roleLabel} className="border-b border-neutral-100">
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

      <section className="space-y-4 rounded border border-neutral-200 p-4">
        <h2 className="text-lg font-semibold">
          Workshop plan for your session ({synthesis.content.workshopPlan.totalMinutes} min)
        </h2>

        <div>
          <h3 className="text-sm font-semibold text-neutral-500">
            Opening ({synthesis.content.workshopPlan.openingMinutes} min)
          </h3>
          <p className="text-sm text-neutral-700">
            {synthesis.content.workshopPlan.openingFraming}
          </p>
        </div>

        {synthesis.content.workshopPlan.agendaItems.map((item, i) => (
          <div key={i} className="space-y-1 border-t border-neutral-100 pt-3">
            <h3 className="text-sm font-semibold">
              {item.priorityText} ({item.minutes} min)
            </h3>
            <p className="text-sm text-neutral-700">
              <span className="font-medium">Discussion prompt: </span>
              {item.discussionPrompt}
            </p>
            <p className="text-sm text-neutral-700">
              <span className="font-medium">Hypothesis: </span>
              {item.hypothesis}
            </p>
            <p className="text-sm text-neutral-700">
              <span className="font-medium">Exercise: </span>
              {item.exercise}
            </p>
          </div>
        ))}

        <div className="border-t border-neutral-100 pt-3">
          <h3 className="text-sm font-semibold text-neutral-500">
            Closing ({synthesis.content.workshopPlan.closingMinutes} min)
          </h3>
          <p className="whitespace-pre-line text-sm text-neutral-700">
            {synthesis.content.workshopPlan.closingTemplate}
          </p>
        </div>
      </section>
    </div>
  );
}
