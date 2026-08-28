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
 * Anonymity is enforced by the caller, not by prompting: participant names
 * are never passed in here, and any role_label unique to a single
 * participant in the session set must already have been collapsed to a
 * generic tag (e.g. "Other participants") by the caller before building
 * this input. The model only ever sees whatever roleTag it's given.
 *
 * "Participant" is display terminology only - field/variable names below
 * (leaderId, etc.) intentionally match the underlying leaders table and
 * stay as-is; see CLAUDE.md.
 */

const MODEL = "claude-opus-4-8";
// Raised alongside the workshop plan addition - one narrative+breakdown per
// dimension plus a full agenda item per priority is a lot more output than
// the original dimensions-and-priorities-only response.
const MAX_TOKENS = 16384;

export type SynthesisMessageInput = {
  sender: "assistant" | "leader";
  content: string;
  dimensionId: string | null;
};

export type SynthesisSessionInput = {
  /** Opaque participant id, used only to key the output back to a role tag. */
  leaderId: string;
  /** Real role_label if 2+ participants in this run share it, else a generic tag. */
  roleTag: string;
  messages: SynthesisMessageInput[];
};

export type SynthesisInput = {
  strategyContext: string;
  sessionPurpose: string;
  framingDimensions: FramingDimension[];
  sessions: SynthesisSessionInput[];
  /** Context only - exact per-item time allocation is computed by the caller. */
  workshopDurationMinutes: number;
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

export type SynthesisTopPriorityOutput = {
  text: string;
  primaryDimensionId: string | null;
};

export type WorkshopAgendaItemOutput = {
  discussionPrompt: string;
  hypothesis: string;
  exercise: string;
};

export type WorkshopPlanOutput = {
  openingFraming: string;
  agendaItems: WorkshopAgendaItemOutput[];
  closingTemplate: string;
};

export type SynthesisOutput = {
  dimensions: SynthesisDimensionOutput[];
  topPriorities: SynthesisTopPriorityOutput[];
  workshopPlan: WorkshopPlanOutput;
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
      .describe("The participant ref this position belongs to."),
    category: z
      .enum(SYNTHESIS_POSITION_CATEGORIES)
      .describe(
        "This participant's position on this dimension specifically: 'aligned' (clearly in line with the emerging consensus), 'mixed' (hedging, partial, or genuinely in-between), 'concerned' (clearly worried, opposed, or flagging a problem), or 'not_addressed' (the interview never meaningfully touched this dimension for this participant)."
      ),
  });

  const dimensionSchema = z.object({
    dimensionId: z.enum(dimIds),
    narrative: z
      .string()
      .describe(
        "3-6 sentences, in English (UK), on what's really being said on this dimension: where there's genuine consensus, where there's disagreement, and anything participants seem to be dancing around or avoiding. Refer to participants only by the role tag they were given below - never invent a name or a more specific title than the tag provided."
      ),
    positions: z
      .array(positionSchema)
      .describe(
        `Exactly one entry per participant ref, covering all of: ${leaderIds.join(", ")}.`
      ),
  });

  const topPrioritySchema = z.object({
    text: z
      .string()
      .describe(
        "A concrete priority or open question this leadership team should discuss first to reach alignment - not restating a per-dimension narrative, but pointing at what matters most to resolve given everything above."
      ),
    primaryDimensionId: z
      .enum(dimIds)
      .nullable()
      .describe(
        "The single dimension this priority relates to most, used to weight how much workshop time it gets - or null if it's genuinely cross-cutting and doesn't map to one dimension more than others."
      ),
  });

  const agendaItemSchema = z.object({
    discussionPrompt: z
      .string()
      .describe(
        "A direct, specific question to open the group's discussion on this priority - concrete enough to ask out loud in the room, not a restatement of the priority text."
      ),
    hypothesis: z
      .string()
      .describe(
        'One testable hypothesis phrased for the room, in the literal form "We believe X - confirm or challenge this," where X is a specific, falsifiable claim drawn from the synthesis findings for this priority.'
      ),
    exercise: z
      .string()
      .describe(
        "One concrete facilitation exercise suited to a senior leadership group, e.g. silent writing before discussion, a spectrum/positioning line, small-group breakouts, a fishbowl, dot-voting. Must vary the mechanic across agenda items - do not reuse the same exercise type for every priority."
      ),
  });

  return z.object({
    dimensions: z
      .array(dimensionSchema)
      .describe(
        `Exactly one entry per dimension id, covering all of, in this order: ${dimIds.join(", ")}.`
      ),
    topPriorities: z
      .array(topPrioritySchema)
      .describe(
        "3-6 top priorities, drawing across all dimensions, in priority order."
      ),
    workshopPlan: z.object({
      openingFraming: z
        .string()
        .describe(
          "A short (3-5 sentence), anonymised summary of the honest overall picture across the team, phrased to make it safe to name disagreement out loud in the room - set a tone of candour without pointing at any individual."
        ),
      agendaItems: z
        .array(agendaItemSchema)
        .describe(
          "Exactly one entry per top priority, in the exact same order as topPriorities - agendaItems[i] corresponds to topPriorities[i]."
        ),
      closingTemplate: z
        .string()
        .describe(
          "A short, literal fill-in-live template for the facilitator to capture what the group actually agreed before they leave - structured as repeatable short lines of Decision / Owner / Next step, not prose. Ready to project and fill in during the session, not a description of what to do."
        ),
    }),
  });
}

export async function getSynthesis(
  input: SynthesisInput
): Promise<SynthesisOutput> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const leaderIds = input.sessions.map((s) => s.leaderId);
  const format = zodOutputFormat(
    buildSynthesisSchema(input.framingDimensions, leaderIds)
  );

  // create() + manual stop_reason check, not parse() - see the equivalent
  // comment in lib/ai/interview-model.ts. The workshop plan addition makes
  // this response substantially longer, so a truncated/incomplete response
  // is worth surfacing clearly rather than as an opaque JSON parse error.
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: buildSystemPrompt(input),
    messages: [{ role: "user", content: "Generate the synthesis now." }],
    output_config: { format },
  });

  if (response.stop_reason !== "end_turn") {
    throw new Error(
      `Synthesis model response did not finish normally (stop_reason: "${response.stop_reason}") - the response is incomplete and cannot be used.`
    );
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock) {
    throw new Error("Synthesis model response contained no text content block.");
  }

  return format.parse(textBlock.text);
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
      return `### Participant ref: ${s.leaderId} (role tag: ${s.roleTag})\n${lines}`;
    })
    .join("\n\n");

  return `You are synthesising a set of confidential one-on-one alignment interviews into a report for the team that commissioned them. You never spoke with these participants yourself - you are reading full transcripts of interviews already conducted by another AI interviewer, one participant at a time, and your job is to find the cross-participant picture: where this team agrees, where it doesn't, and what it seems to be avoiding.

## Anonymity - read this first

You are given each participant only as an opaque ref (a participant id) plus a role tag. Some role tags are the participant's real role; others have deliberately been replaced with a generic tag like "Other participants" because that role is unique to one person in this set and naming it would identify them. You have no way to tell which is which, and you must not try to guess or reconstruct a real role from context - always refer to participants using only the exact ref/tag given below, never a name, and never a more specific title than the tag provided, even if the participant mentions their own title in their answers.

## Language

Transcripts may be in different languages from each other and from this prompt - each interview was conducted in whatever language that participant used. Read every transcript for its actual meaning regardless of language, translating faithfully rather than processing only the literal words (idioms, hedging, and emphasis don't always translate word-for-word). Regardless of what language(s) the transcripts are in, everything you produce - every narrative, priority, and workshop plan section - must be written entirely in English (UK), since that's what the consultant reading this report uses.

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

For EACH dimension listed above, write a short qualitative narrative (consensus vs disagreement vs what's being avoided) and classify every single participant ref's position on that dimension specifically.

Then produce the top priorities: 3-6 concrete priorities or open questions this team should discuss first to reach alignment, drawing across all dimensions - not a per-dimension summary restated, but what matters most given the whole picture, each tagged with the single dimension it relates to most (or null if genuinely cross-cutting).

Finally, produce a workshop plan for a facilitator to run a live session with this leadership team, roughly ${input.workshopDurationMinutes} minutes long (exact per-item timing will be calculated separately - focus on content, not minutes):
- An opening framing that makes it safe to name disagreement in the room.
- One agenda item per top priority (same order), each with a discussion prompt, a "we believe X - confirm or challenge this" hypothesis grounded in what the interviews actually showed, and one concrete facilitation exercise - vary the exercise mechanic across items rather than repeating the same one.
- A closing template the facilitator can fill in live to capture what was actually agreed.

Be direct and specific rather than diplomatic-vague throughout - this report and plan are for the team itself, and their value is in naming real disagreement and avoidance clearly, while still only ever referring to participants by the ref/tag given.`;
}
