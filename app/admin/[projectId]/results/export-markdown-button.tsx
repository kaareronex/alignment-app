"use client";

import type { Synthesis, SynthesisPositionCategory } from "../../types";

const CATEGORY_LABELS: Record<SynthesisPositionCategory, string> = {
  aligned: "Clearly aligned",
  mixed: "Mixed / hedging",
  concerned: "Clearly concerned",
  not_addressed: "Didn't meaningfully address",
};

function toMarkdown(projectName: string, synthesis: Synthesis): string {
  const generatedAt = new Date(synthesis.generated_at).toLocaleString("en-GB");
  const lines: string[] = [];

  lines.push(`# Alignment synthesis — ${projectName}`);
  lines.push("");
  lines.push(
    `Generated ${generatedAt} from ${synthesis.content.sessionCount} completed session${
      synthesis.content.sessionCount === 1 ? "" : "s"
    }.`
  );
  lines.push("");
  lines.push("## Top priorities to discuss");
  lines.push("");
  for (const p of synthesis.content.topPriorities) {
    lines.push(`- ${p.text}`);
  }
  lines.push("");

  for (const dim of synthesis.content.dimensions) {
    lines.push(`## ${dim.label}`);
    lines.push("");
    lines.push(dim.narrative);
    lines.push("");
    lines.push("| Role | " + Object.values(CATEGORY_LABELS).join(" | ") + " | Total |");
    lines.push("| --- | --- | --- | --- | --- | --- |");
    for (const row of dim.breakdown) {
      lines.push(
        `| ${row.roleLabel} | ${row.aligned} | ${row.mixed} | ${row.concerned} | ${row.not_addressed} | ${row.total} |`
      );
    }
    lines.push("");
  }

  const plan = synthesis.content.workshopPlan;
  lines.push(`## Workshop plan for your session (${plan.totalMinutes} min)`);
  lines.push("");
  lines.push(`### Opening (${plan.openingMinutes} min)`);
  lines.push("");
  lines.push(plan.openingFraming);
  lines.push("");
  for (const item of plan.agendaItems) {
    lines.push(`### ${item.priorityText} (${item.minutes} min)`);
    lines.push("");
    lines.push(`**Discussion prompt:** ${item.discussionPrompt}`);
    lines.push("");
    lines.push(`**Hypothesis:** ${item.hypothesis}`);
    lines.push("");
    lines.push(`**Exercise:** ${item.exercise}`);
    lines.push("");
  }
  lines.push(`### Closing (${plan.closingMinutes} min)`);
  lines.push("");
  lines.push(plan.closingTemplate);
  lines.push("");

  return lines.join("\n");
}

export default function ExportMarkdownButton({
  projectName,
  synthesis,
}: {
  projectName: string;
  synthesis: Synthesis;
}) {
  function handleClick() {
    const markdown = toMarkdown(projectName, synthesis);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = projectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    a.href = url;
    a.download = `synthesis-${slug || "project"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
    >
      Export as markdown
    </button>
  );
}
