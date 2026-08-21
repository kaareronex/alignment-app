export type FramingDimension = {
  id: string;
  label: string;
  description: string;
};

export const MIN_DIMENSIONS = 2;
export const MAX_DIMENSIONS = 6;

// Ids are opaque on purpose (not slugs of the label) - framing dimensions
// aren't shown to leaders directly, and the id is sent to the browser
// (for progress-bar mapping) even though the label/description aren't.
export const DEFAULT_FRAMING_DIMENSIONS: FramingDimension[] = [
  {
    id: "c0906d26-2d33-48e8-815d-9db29c33404e",
    label: "Disagreement",
    description:
      "Areas where the leaders genuinely disagree on direction, priority, or interpretation — not just different wording for the same thing.",
  },
  {
    id: "aa567b05-7817-43d7-925c-f8d08dfdd8b2",
    label: "Out of scope",
    description:
      "Topics or decisions outside this leadership team's mandate — something for others (e.g. the board or another department) to decide.",
  },
  {
    id: "d6972fce-5aa4-4e15-bf04-78ccb27d96d8",
    label: "Important",
    description:
      "What matters most to whether the strategy succeeds — what should be prioritised highest, regardless of how hard it is to address.",
  },
  {
    id: "e21e0c87-6cf8-4f0f-88c0-ef2345e71bc9",
    label: "Success",
    description:
      "What it looks like when the strategy has been implemented successfully — the concrete signs that the goal has been reached.",
  },
];
