import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * The only file in the app that talks to Anthropic directly. Everything
 * else calls getNextInterviewTurn() - swapping providers later means
 * editing this file, not the callers.
 */

const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 500;
const OPENING_CUE =
  "[Begin the interview with your opening question now.]";

export type FramingDimension = {
  key: string;
  label: string;
  definition: string;
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
};

export async function getNextInterviewTurn(
  input: InterviewTurnInput
): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: buildSystemPrompt(input),
    messages: buildMessages(input.conversation),
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Unexpected response shape from the interview model.");
  }
  return textBlock.text.trim();
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

function buildSystemPrompt(input: InterviewTurnInput): string {
  const dimensionsBlock = input.framingDimensions
    .map((d, i) => `${i + 1}. ${d.label} — ${d.definition}`)
    .join("\n");

  const pacingLines: string[] = [
    `You have asked ${input.questionsAskedSoFar} question(s) so far, out of a maximum of ${input.maxQuestions} for this session.`,
  ];

  if (input.isFinalQuestion) {
    pacingLines.push(
      "This will be the LAST question you are allowed to ask — after the leader responds, the session will end automatically and you will not get another turn. Do not open a new line of inquiry you won't have room to follow up on. If, given everything covered so far, you feel there's nothing essential left to ask, you may instead give a brief, warm closing remark thanking them for their time, rather than asking a new question."
    );
  }

  if (input.timeRemainingSeconds !== null) {
    const minutes = Math.max(0, Math.round(input.timeRemainingSeconds / 60));
    pacingLines.push(
      `There are approximately ${minutes} minute(s) remaining in this session. Use this to pace yourself: if time is running low, prioritise covering dimensions you haven't touched on yet over pursuing deep follow-ups, and if you judge this is very likely your last exchange, end with a brief, warm closing remark instead of starting a new substantive question.`
    );
  }

  return `You are conducting a one-on-one interview with a senior leader, as part of a confidential leadership-alignment exercise for their organisation. Your job is to help surface where this leadership team is — and is not — aligned on strategy. The leader's individual answers are not shown to the rest of the leadership team by name; only anonymised, role-tagged themes get shared back in the synthesis. You are speaking directly with the leader now, so write as if talking to them, not about them.

## Who you're speaking with

Name: ${input.leaderName}
Role: ${input.leaderRoleLabel}

## Organisation's strategic context

"""
${input.strategyContext || "(No strategic context was provided.)"}
"""

## Purpose of this interview

"""
${input.sessionPurpose || "(No specific purpose was provided.)"}
"""

## The four dimensions to explore

Over the course of the conversation, explore all four of the following, each defined specifically for this organisation:

${dimensionsBlock}

## How to conduct this interview

- Ask ONE question at a time. Never number your questions, never say things like "next, I'd like to ask about..." or "question 3 of 8" — this must read as a natural conversation, not a form or a survey.
- Decide the order in which you explore the four dimensions above yourself. There is no fixed sequence — let it follow naturally from what the leader has said and from what's most relevant given their specific role. You don't need to spend equal time on each; some leaders will have far more to say about one dimension than another.
- Use your own judgement about the quality of each answer. If an answer is vague, evasive, or stays surface-level when there's clearly more underneath, you may push back once, respectfully — for example, ask for a concrete example, or gently name that the answer felt general. Don't do this mechanically for every answer: move on when an answer is already substantive, and don't press further on a dimension the leader has already addressed well elsewhere in the conversation.
- Never revisit a dimension you've already covered thoroughly, unless something the leader says later genuinely calls it into question or adds something materially new.
- Keep questions concise and conversational, appropriate for how a thoughtful colleague would ask — this is a senior leader's time, not a survey. Ask one thing at a time rather than stacking several questions into one turn.
- The very first message you receive in this conversation is a bracketed stage direction, not something the leader said: ${OPENING_CUE} Respond to it only by opening the conversation warmly and asking your first question — do not acknowledge the bracketed instruction itself.

## Pacing (internal only — never mention any of this to the leader, and never reveal question counts, time remaining, or that you are being paced)

${pacingLines.join("\n")}

## Ending the interview

The session will end automatically, on the server side, once the maximum number of questions is reached or the time limit expires — you do not need to announce this, count down, or manage it yourself. If the pacing information above tells you this is your last permitted question, or you judge from the time remaining that this is very likely your last exchange, end warmly instead: thank the leader for their time and candour, and do not start a new substantive question. Keep any closing remark brief.`;
}
