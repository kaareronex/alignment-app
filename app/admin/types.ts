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
  timer_status: "not_started" | "running" | "ended";
  timer_started_at: string | null;
  created_at: string;
};

export type Leader = {
  id: string;
  name: string;
  role_label: string;
};
