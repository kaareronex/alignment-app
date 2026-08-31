import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

/**
 * The only file in the app that talks to Anthropic directly. Everything
 * else calls getNextInterviewTurn() - swapping providers later means
 * editing this file, not the callers.
 */

// Temporarily Sonnet while iterating (cheaper/faster, and worth checking
// whether it also reduces the corrupted-output pattern under investigation).
// lib/ai/synthesis-model.ts stays on Opus - it runs once per project, not
// once per exchange, and needs the stronger reasoning.
const MODEL = "claude-sonnet-5";
// 1024 was not actually generous: a growing conversation plus a
// substantive follow-up question, wrapped in the structured-output JSON,
// can run past it - which truncates the response mid-JSON and fails to
// parse. 4096 is a safer floor; see the stop_reason check below for what
// happens if a response still runs past it.
const MAX_TOKENS = 4096;
const OPENING_CUE =
  "[Begin the interview with your opening question now.]";

export type FramingDimension = {
  id: string;
  label: string;
  description: string;
};

export type ConversationMessage = {
  sender: "assistant" | "leader";
  content: string;
};

export type InterviewTurnInput = {
  strategyContext: string;
  sessionPurpose: string;
  framingDimensions: FramingDimension[];
  leaderName: string;
  leaderRoleLabel: string;
  /** Full conversation so far, oldest first. Empty for the opening turn. */
  conversation: ConversationMessage[];
  questionsAskedSoFar: number;
  maxQuestions: number;
  /** True when this is the last question the model is allowed to ask. */
  isFinalQuestion: boolean;
  /** Null if this project has no time limit. */
  timeRemainingSeconds: number | null;
  /**
   * English name of the language the participant explicitly chose before
   * the interview began (e.g. "Danish"), or null for sessions created
   * before this selection step existed - those fall back to the older
   * detect-from-first-answer behaviour.
   */
  interviewLanguageLabel: string | null;
};

export type InterviewTurnOutput = {
  /** leadIn + nextQuestion combined - the full text shown to the participant. */
  message: string;
  leaderWantsToStop: boolean;
  /** Id of the dimension this exchange primarily addressed, or null. */
  dimensionAddressed: string | null;
};

// Question marks across the languages this app supports (lib/languages.ts) -
// used to sanity-check that "nextQuestion" actually reads as a question
// rather than the model just reflecting on the answer with nothing new
// asked. Not exhaustive linguistics, just enough to catch the common case.
const QUESTION_MARK_CHARS = ["?", "？", "؟"];

function looksLikeQuestion(text: string): boolean {
  return QUESTION_MARK_CHARS.some((mark) => text.includes(mark));
}

function buildInterviewTurnSchema(dimensions: FramingDimension[]) {
  const ids = dimensions.map((d) => d.id) as [string, ...string[]];
  const legend = dimensions.map((d) => `"${d.id}" (${d.label})`).join(", ");

  return z.object({
    leadIn: z
      .string()
      .nullable()
      .describe(
        "An optional brief (at most one or two sentences) acknowledgment of or reflection on what the participant just said, shown right before nextQuestion. Null if you're moving straight to the question with no lead-in. This field alone is never enough on its own - it must not contain your actual question."
      ),
    nextQuestion: z
      .string()
      .describe(
        "REQUIRED, never empty. Either (a) the next genuine, direct question you're asking the participant, ending in a question mark - not a restatement of their last answer with nothing new asked - or (b), ONLY when isClosingRemark is true, a brief warm closing remark ending the interview instead of a question."
      ),
    isClosingRemark: z
      .boolean()
      .describe(
        "True only if nextQuestion above is a closing remark ending the interview rather than a real question - see the Ending sections for when this applies. False on every normal turn, including ones with a leadIn."
      ),
    leaderWantsToStop: z
      .boolean()
      .describe(
        "True only if the participant's last message clearly asked to end the whole interview, not just declined to elaborate on the current question. See system prompt for the distinction."
      ),
    dimensionAddressed: z
      .enum(ids)
      .nullable()
      .describe(
        `The id of the dimension this exchange (your question plus what you're following up on) primarily addressed, or null if it doesn't clearly focus on one. Valid ids: ${legend}.`
      ),
  });
}

type RawTurn = {
  leadIn: string | null;
  nextQuestion: string;
  isClosingRemark: boolean;
  leaderWantsToStop: boolean;
  dimensionAddressed: string | null;
};

async function requestInterviewTurn(
  client: Anthropic,
  input: InterviewTurnInput
): Promise<RawTurn> {
  const format = zodOutputFormat(buildInterviewTurnSchema(input.framingDimensions));

  // Using create() instead of parse() so stop_reason can be checked before
  // attempting to parse the content - parse() would otherwise try to
  // JSON.parse a response truncated by max_tokens and throw an opaque
  // "unterminated string" error that hides the actual cause.
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // Two blocks, not one string: everything up to and including the
    // cache_control breakpoint (role/task, strategy context, dimensions,
    // conduct/ending instructions) is identical on every turn of the same
    // interview, so it's marked cacheable. Only the pacing block - question
    // count, final-question flag, time remaining - actually changes turn to
    // turn, so it's appended after the breakpoint, uncached.
    system: [
      { type: "text", text: buildStableSystemPrompt(input), cache_control: { type: "ephemeral" } },
      { type: "text", text: buildPacingSuffix(input) },
    ],
    messages: buildMessages(input.conversation),
    output_config: { format },
  });

  // Anything other than "end_turn" means the response is incomplete and
  // unsafe to parse - most commonly "max_tokens" (raise MAX_TOKENS) or
  // "model_context_window_exceeded" (the growing conversation history plus
  // MAX_TOKENS of reserved output no longer fits the model's context
  // window - the same fix doesn't apply; the conversation itself needs
  // trimming/summarising once it gets this long).
  if (response.stop_reason !== "end_turn") {
    throw new Error(
      `Interview model response did not finish normally (stop_reason: "${response.stop_reason}") - the response is incomplete and cannot be used.`
    );
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock) {
    throw new Error("Interview model response contained no text content block.");
  }

  // Parsed by hand rather than via format.parse(), which validates the
  // whole object atomically against the zod schema (including the
  // dimensionAddressed enum) and throws on any mismatch. The enum in the
  // schema still guides the model via the API's structured-output
  // constraint, but it isn't airtight in practice - a handful of live
  // load-test runs produced a dimensionAddressed value outside the given
  // ids, which crashed the whole turn even though the rest of the response
  // was fine. dimensionAddressed only drives an internal progress
  // indicator, so an unrecognised value is treated as "no dimension
  // identified" instead of losing the participant's turn over it.
  let rawParsed: unknown;
  try {
    rawParsed = JSON.parse(textBlock.text);
  } catch (error) {
    throw new Error(
      `Failed to parse structured output as JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (
    typeof rawParsed !== "object" ||
    rawParsed === null ||
    typeof (rawParsed as Record<string, unknown>).nextQuestion !== "string"
  ) {
    throw new Error("Interview model response was missing a usable nextQuestion.");
  }

  const record = rawParsed as Record<string, unknown>;
  const validDimensionIds = input.framingDimensions.map((d) => d.id);
  const dimensionAddressed =
    typeof record.dimensionAddressed === "string" &&
    validDimensionIds.includes(record.dimensionAddressed)
      ? record.dimensionAddressed
      : null;

  return {
    leadIn:
      typeof record.leadIn === "string" && record.leadIn.trim() ? record.leadIn.trim() : null,
    nextQuestion: (record.nextQuestion as string).trim(),
    isClosingRemark: record.isClosingRemark === true,
    leaderWantsToStop: record.leaderWantsToStop === true,
    dimensionAddressed,
  };
}

// The structured-output schema constrains nextQuestion to be present, but
// not to actually BE a question - a handful of live runs produced a
// response that only reflected on the participant's last answer ("That
// makes sense, thanks for sharing that.") with nothing new asked, silently
// stalling the interview. Closing remarks are exempt: by definition they
// don't ask anything.
function hasUsableQuestionOrClosing(turn: RawTurn): boolean {
  if (!turn.nextQuestion) return false;
  return turn.isClosingRemark || looksLikeQuestion(turn.nextQuestion);
}

export async function getNextInterviewTurn(
  input: InterviewTurnInput
): Promise<InterviewTurnOutput> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let turn = await requestInterviewTurn(client, input);
  if (!hasUsableQuestionOrClosing(turn)) {
    console.warn(
      `Interview model produced no usable question (nextQuestion: ${JSON.stringify(turn.nextQuestion)}, isClosingRemark: ${turn.isClosingRemark}) - retrying once.`
    );
    turn = await requestInterviewTurn(client, input);
  }
  if (!hasUsableQuestionOrClosing(turn)) {
    throw new Error(
      "Interview model failed to produce a real question after retrying once."
    );
  }

  return {
    message: [turn.leadIn, turn.nextQuestion].filter(Boolean).join(" "),
    leaderWantsToStop: turn.leaderWantsToStop,
    dimensionAddressed: turn.dimensionAddressed,
  };
}

function buildMessages(
  conversation: ConversationMessage[]
): Anthropic.MessageParam[] {
  if (conversation.length === 0) {
    return [{ role: "user", content: OPENING_CUE }];
  }
  return conversation.map((m) => ({
    role: m.sender === "leader" ? "user" : "assistant",
    content: m.content,
  }));
}

// Everything here is identical across every turn of the same interview
// (same participant, same project) - the part worth caching. Pacing numbers
// are deliberately kept out of this string; see buildPacingSuffix.
function buildStableSystemPrompt(input: InterviewTurnInput): string {
  const dimensionsBlock = input.framingDimensions
    .map((d, i) => `${i + 1}. ${d.label} — ${d.description}`)
    .join("\n");

  return `You are conducting a one-on-one interview with a participant, as part of a confidential alignment exercise for their organisation. Your job is to help surface where this team is — and is not — aligned on strategy. The participant's individual answers are not shown to the rest of the team by name; only anonymised, role-tagged themes get shared back in the synthesis. You are speaking directly with the participant now, so write as if talking to them, not about them.

## Who you're speaking with

Name: ${input.leaderName}
Role: ${input.leaderRoleLabel}

## Language

${
  input.interviewLanguageLabel
    ? `The participant explicitly chose ${input.interviewLanguageLabel} as the language for this interview before it began. Conduct the whole conversation - every question, follow-up, moment of respectful push-back, and the closing remark - in ${input.interviewLanguageLabel} starting from your very first message. Do not wait for a signal from their answers and do not default to English first - open directly in ${input.interviewLanguageLabel}. If the participant nonetheless answers in a different language, follow them there naturally rather than rigidly enforcing their original choice, but return to ${input.interviewLanguageLabel} as the default if they switch back or it's ambiguous.`
    : `Detect the language the participant is actually answering in, starting from their first substantive response, and from then on conduct the whole conversation - every question, follow-up, moment of respectful push-back, and the closing remark - in that same language. The opening question (before they've said anything yet) and any answer too short or ambiguous to reliably signal a language (e.g. "yes", "ok", a single word) don't count as a signal - default to English (UK) until a clearer answer establishes one. If the participant switches language partway through, follow them there too rather than staying locked to whichever language you detected first.`
}

This only changes what language you speak to the participant in: the framing dimensions and the pacing guidance given to you below are written in English (UK) by the admin who configured this project, and you should keep reading and reasoning over them normally regardless of what language you're currently speaking.

## Organisation's strategic context

"""
${input.strategyContext || "(No strategic context was provided.)"}
"""

## Purpose of this interview

"""
${input.sessionPurpose || "(No specific purpose was provided.)"}
"""

## The dimensions to explore

Over the course of the conversation, explore all of the following dimensions, each defined specifically for this organisation:

${dimensionsBlock}

## How to conduct this interview

- Ask ONE question at a time. Never number your questions, never say things like "next, I'd like to ask about..." or "question 3 of 8" — this must read as a natural conversation, not a form or a survey.
- Decide the order in which you explore the dimensions above yourself. There is no fixed sequence — let it follow naturally from what the participant has said and from what's most relevant given their specific role. You don't need to spend equal time on each; some participants will have far more to say about one dimension than another.
- Use your own judgement about the quality of each answer. If an answer is vague, evasive, or stays surface-level when there's clearly more underneath, you may push back once, respectfully — for example, ask for a concrete example, or gently name that the answer felt general. Don't do this mechanically for every answer: move on when an answer is already substantive, and don't press further on a dimension the participant has already addressed well elsewhere in the conversation.
- Never revisit a dimension you've already covered thoroughly, unless something the participant says later genuinely calls it into question or adds something materially new.
- Keep questions concise and conversational, appropriate for how a thoughtful colleague would ask — this is the participant's time, not a survey. Ask one thing at a time rather than stacking several questions into one turn.
- The very first message you receive in this conversation is a bracketed stage direction, not something the participant said: ${OPENING_CUE} Respond to it only by opening the conversation warmly and asking your first question — do not acknowledge the bracketed instruction itself.
- Every response also includes a "dimensionAddressed" field: set it to the id of whichever single dimension this exchange was primarily about, or null if it was general/introductory and didn't clearly focus on one. This is used only for an internal progress indicator — never mention dimension ids, names, or this field to the participant.

## Response format

What you say to the participant is split across two fields, shown to them back to back as a single message:

- "leadIn": optional, at most one or two sentences acknowledging or reflecting on what they just said. Use it when a brief acknowledgment helps the conversation feel natural - not on every turn.
- "nextQuestion": REQUIRED, and must be a genuine, direct question ending in a question mark. Never leave the participant with only a reflection and nothing asked of them — every normal turn must move the conversation forward with an actual question, not just a comment on their last answer. The one exception is a closing remark (see below), which is not a question and doesn't need to read like one.

## Ending the interview

The session will end automatically, on the server side, once the maximum number of questions is reached or the time limit expires — you do not need to announce this, count down, or manage it yourself. If the pacing guidance given below tells you this is your last permitted question, or you judge from the time remaining that this is very likely your last exchange, end warmly instead: thank the participant for their time and candour, and do not start a new substantive question. Keep any closing remark brief. Put it in "nextQuestion" and set "isClosingRemark" to true.

## Ending early if the participant wants to stop

Independently of the pacing below, every response you give includes a "leaderWantsToStop" field. Set it to true only if the participant's most recent message clearly indicates they want to end the interview altogether — for example "let's wrap this up", "I need to go", "I don't want to continue", or an explicit request to stop. When you set it to true, "nextQuestion" should be a brief, warm closing remark thanking them (with "isClosingRemark" set to true), not a new question.

Do NOT set it to true just because an answer was short, vague, or the participant said something like "I don't have anything else to add" about the current question specifically — that means move on from this question, not end the interview. When in doubt, set it to false and continue normally.`;
}

// Changes every turn (question count, final-question flag, time remaining),
// so it's kept out of the cached block above and appended after it instead.
function buildPacingSuffix(input: InterviewTurnInput): string {
  const pacingLines: string[] = [
    `You have asked ${input.questionsAskedSoFar} question(s) so far, out of a maximum of ${input.maxQuestions} for this session.`,
  ];

  if (input.isFinalQuestion) {
    pacingLines.push(
      "This will be the LAST question you are allowed to ask — after the participant responds, the session will end automatically and you will not get another turn. Do not open a new line of inquiry you won't have room to follow up on. If, given everything covered so far, you feel there's nothing essential left to ask, you may instead give a brief, warm closing remark thanking them for their time, rather than asking a new question."
    );
  }

  if (input.timeRemainingSeconds !== null) {
    const minutes = Math.max(0, Math.round(input.timeRemainingSeconds / 60));
    pacingLines.push(
      `There are approximately ${minutes} minute(s) remaining in this session. Use this to pace yourself: if time is running low, prioritise covering dimensions you haven't touched on yet over pursuing deep follow-ups, and if you judge this is very likely your last exchange, end with a brief, warm closing remark instead of starting a new substantive question.`
    );
  }

  return `## Pacing (internal only — never mention any of this to the participant, and never reveal question counts, time remaining, or that you are being paced)

${pacingLines.join("\n")}`;
}
