import { z } from "zod";

// =============================================================================
// Lead Pipeline Stages
// =============================================================================
// Stored in leads.stage. Null means the lead has not been staged yet.

export const LEAD_STAGES = [
  "contacted",
  "no_show",
  "follow_up",
  "won",
  "lost",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  contacted: "Contacted",
  no_show: "No Show",
  follow_up: "Follow-up",
  won: "Won",
  lost: "Lost",
};

export const leadStageSchema = z.enum(LEAD_STAGES).nullable();

export function leadStageLabel(stage: string | null): string {
  if (!stage) return "Unstaged";
  return LEAD_STAGE_LABELS[stage as LeadStage] ?? stage;
}

// =============================================================================
// Appointment Stages
// =============================================================================
// Mapped to appointments.status ('no_show' | 'completed'), which are already
// allowed by the appointments_status_check constraint.

export const APPOINTMENT_STAGES = ["no_show", "completed"] as const;

export type AppointmentStage = (typeof APPOINTMENT_STAGES)[number];

export const APPOINTMENT_STAGE_LABELS: Record<AppointmentStage, string> = {
  no_show: "No Show",
  completed: "Complete",
};

export const appointmentStageSchema = z.enum(APPOINTMENT_STAGES);

export function appointmentStageLabel(stage: string | null): string {
  if (!stage) return "Unstaged";
  return APPOINTMENT_STAGE_LABELS[stage as AppointmentStage] ?? stage;
}
