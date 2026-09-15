import type { SynthesisAlignmentLevel } from "../../types";

export const ALIGNMENT_LABELS: Record<SynthesisAlignmentLevel, string> = {
  consensus: "Consensus",
  partial: "Partial",
  divided: "Divided",
};

export const ALIGNMENT_COLORS: Record<SynthesisAlignmentLevel, string> = {
  consensus: "var(--im-blue-green)",
  partial: "var(--im-yellow, #e4b73c)",
  divided: "var(--im-deep-red, #451f23)",
};
