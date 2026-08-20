export const FRAMING_DIMENSIONS = [
  { key: "uenighed", label: "Disagreement" },
  { key: "ikke_vores_bord", label: "Out of scope" },
  { key: "vigtigt", label: "Important" },
  { key: "lykkedes", label: "Success" },
] as const;

export const DEFAULT_FRAMING_DEFINITIONS: Record<string, string> = {
  uenighed:
    "Areas where the leaders genuinely disagree on direction, priority, or interpretation — not just different wording for the same thing.",
  ikke_vores_bord:
    "Topics or decisions outside this leadership team's mandate — something for others (e.g. the board or another department) to decide.",
  vigtigt:
    "What matters most to whether the strategy succeeds — what should be prioritised highest, regardless of how hard it is to address.",
  lykkedes:
    "What it looks like when the strategy has been implemented successfully — the concrete signs that the goal has been reached.",
};
