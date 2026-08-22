import type { FramingDimension } from "./framing-defaults";

export type Project = {
  id: string;
  name: string;
  status: "draft" | "active" | "closed";
  strategy_context: string | null;
  session_purpose: string | null;
  framing_definitions: FramingDimension[];
  max_questions: number;
  access_mode: "lobby" | "open";
  time_limit_enabled: boolean;
  time_limit_minutes: number | null;
  workshop_duration_minutes: number;
  timer_status: "not_started" | "running" | "ended";
  timer_started_at: string | null;
  created_at: string;
};

export type Leader = {
  id: string;
  name: string;
  role_label: string;
};

export type SynthesisPositionCategory =
  | "aligned"
  | "mixed"
  | "concerned"
  | "not_addressed";

export type SynthesisDimensionBreakdownEntry = {
  roleLabel: string;
  aligned: number;
  mixed: number;
  concerned: number;
  not_addressed: number;
  total: number;
};

export type SynthesisDimension = {
  dimensionId: string;
  label: string;
  narrative: string;
  breakdown: SynthesisDimensionBreakdownEntry[];
};

export type SynthesisTopPriority = {
  text: string;
  primaryDimensionId: string | null;
};

export type WorkshopAgendaItem = {
  priorityText: string;
  discussionPrompt: string;
  hypothesis: string;
  exercise: string;
  minutes: number;
};

export type WorkshopPlan = {
  totalMinutes: number;
  openingFraming: string;
  openingMinutes: number;
  agendaItems: WorkshopAgendaItem[];
  closingMinutes: number;
  closingTemplate: string;
};

export type SynthesisContent = {
  sessionCount: number;
  dimensions: SynthesisDimension[];
  topPriorities: SynthesisTopPriority[];
  workshopPlan: WorkshopPlan;
};

export type Synthesis = {
  id: string;
  project_id: string;
  generated_at: string;
  content: SynthesisContent;
};
