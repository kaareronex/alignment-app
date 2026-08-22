import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { FramingDimension } from "./interview-model";

/**
 * Synthesis generation - the second (and only other) place this app talks
 * to Anthropic directly, alongside lib/ai/interview-model.ts. Kept in its
 * own file for the same reason: a future provider swap touches exactly two
 * files.
 *
 * Anonymity is enforced by the caller, not by prompting: leader names are
 * never passed in here, and any role_label unique to a single leader in
 * the session set must already have been collapsed to a generic tag
 * (e.g. "Other leaders") by the caller before building this input. The
 * model only ever sees whatever roleTag it's given.
 */

const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 8192;

export type SynthesisMessageInput = {
  sender: "assistant" | "leader";
  content: string;
  dimensionId: string | null;
};

export type SynthesisSessionInput = {
  /** Opaque leader id, used only to key the output back to a role tag. */
  leaderId: string;
  /** Real role_label if 2+ leaders in this run share it, else a generic tag. */
  roleTag: string;
  messages: SynthesisMessageInput[];
};

export type SynthesisInput = {
  strategyContext: string;
  sessionPurpose: string;
  framingDimensions: FramingDimension[];
  sessions: SynthesisSessionInput[];
};

export const SYNTHESIS_POSITION_CATEGORIES = [
  "aligned",
  "mixed",
  "concerned",
  "not_addressed",
] as const;

export type SynthesisPositionCategory =
  (typeof SYNTHESIS_POSITION_CATEGORIES)[number];

export type SynthesisDimensionOutput = {
  dimensionId: string;
  narrative: string;
  positions: { leaderId: string; category: SynthesisPositionCategory }[];
};

export type SynthesisOutput = {
  dimensions: SynthesisDimensionOutput[];
  topPriorities: string[];
};

function buildSynthesisSchema(
  dimensions: FramingDimension[],
  leaderIds: string[]
) {
  const dimIds = dimensions.map((d) => d.id) as [string, ...string[]];
  const lIds = leaderIds as [string, ...string[]];

  const positionSchema = z.object({
    leaderId: z
      .enum(lIds)
      .describe("The leader ref this position belongs to."),
    category: z
      .enum(SYNTHESIS_POSITION_CATEGORIES)
      .describe(
        "This leader's position on this dimension specifically: 'aligned' (clearly in line with the emerging consensus), 'mixed' (hedging, partial, or genuinely in-between), 'concerned' (clearly worried, opposed, or flagging a problem), or 'not_addressed' (the interview never meaningfully touched this dimension for this leader)."
      ),
  });

  const dimensionSchema = z.object({
    dimensionId: z.enum(dimIds),
    narrative: z
      .string()
      .describe(
        "3-6 sentences on what's really being said on this dimension: where there's genuine consensus, where there's disagreement, and anything leaders seem to be dancing around or avoiding. Refer to leaders only by the role tag they were given below - never invent a name or a more specific title than the tag provided."
      ),
    positions: z
      .array(positionSchema)
      .describe(
        `Exactly one entry per leader ref, covering all of: ${leaderIds.join(", ")}.`
      ),
  });

  return z.object({
    dimensions: z
      .array(dimensionSchema)
      .describe(
        `Exactly one entry per dimension id, covering all of, in this order: ${dimIds.join(", ")}.`
      ),
    topPriorities: z
      .array(z.string())
      .describe(
        "3-6 concrete priorities or questions this leadership team should discuss first to reach alignment, drawing across all dimensions - not restating the per-dimension narratives, but pointing at what matters most to resolve given everything above."
      ),
  });
}

export async function getSynthesis(
  input: SynthesisInput
): Promise<SynthesisOutput> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const leaderIds = input.sessions.map((s) => s.leaderId);

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: buildSystemPrompt(input),
    messages: [{ role: "user", content: "Generate the synthesis now." }],
    output_config: {
      format: zodOutputFormat(
        buildSynthesisSchema(input.framingDimensions, leaderIds)
      ),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Failed to parse structured output from the synthesis model.");
  }
  return response.parsed_output;
}

function buildSystemPrompt(input: SynthesisInput): string {
  const dimensionsBlock = input.framingDimensions
    .map((d, i) => `${i + 1}. id="${d.id}" — ${d.label}: ${d.description}`)
    .join("\n");

  const transcriptsBlock = input.sessions
    .map((s) => {
      const lines = s.messages
        .map(
          (m) =>
            `[${m.sender}${m.dimensionId ? `, re: ${m.dimensionId}` : ""}] ${m.content}`
        )
        .join("\n");
      return `### Leader ref: ${s.leaderId} (role tag: ${s.roleTag})\n${lines}`;
    })
    .join("\n\n");

  return `You are synthesising a set of confidential one-on-one leadership-alignment interviews into a report for the same leadership team. You never spoke with these leaders yourself - you are reading full transcripts of interviews already conducted by another AI interviewer, one leader at a time, and your job is to find the cross-leader picture: where this team agrees, where it doesn't, and what it seems to be avoiding.

## Anonymity - read this first

You are given each leader only as an opaque ref (a leader id) plus a role tag. Some role tags are the leader's real role; others have deliberately been replaced with a generic tag like "Other leaders" because that role is unique to one person in this set and naming it would identify them. You have no way to tell which is which, and you must not try to guess or reconstruct a real role from context - always refer to leaders using only the exact ref/tag given below, never a name, and never a more specific title than the tag provided, even if the leader mentions their own title in their answers.

## Organisation's strategic context

"""
${input.strategyContext || "(No strategic context was provided.)"}
"""

## Purpose of this interview round

"""
${input.sessionPurpose || "(No specific purpose was provided.)"}
"""

## Framing dimensions

${dimensionsBlock}

## Transcripts

${transcriptsBlock}

## What to produce

For EACH dimension listed above, write a short qualitative narrative (consensus vs disagreement vs what's being avoided) and classify every single leader ref's position on that dimension specifically. Then write one final cross-cutting list of the top priorities or open questions this team should discuss first to reach alignment, drawing across all dimensions - not a per-dimension summary restated, but what matters most given the whole picture.

Be direct and specific rather than diplomatic-vague - this report is for the leadership team itself, and its value is in naming real disagreement and avoidance clearly, while still only ever referring to leaders by the ref/tag given.`;
}
