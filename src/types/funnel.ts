// =============================================================================
// Funnel Steps
// =============================================================================

export const FUNNEL_STEPS = {
  HERO: "hero",
  VIDEO_TESTIMONIALS: "video-testimonials",
  HOW_IT_WORKS: "how-it-works",
  POOL_DIAGNOSTIC: "pool-diagnostic",
  CONTACT_INFORMATION: "contact-information",
  BOOKING: "booking",
  CONFIRMATION: "confirmation",
} as const;

export type FunnelStepId =
  (typeof FUNNEL_STEPS)[keyof typeof FUNNEL_STEPS];

export const FUNNEL_STEP_ORDER: readonly FunnelStepId[] = [
  FUNNEL_STEPS.HERO,
  FUNNEL_STEPS.VIDEO_TESTIMONIALS,
  FUNNEL_STEPS.HOW_IT_WORKS,
  FUNNEL_STEPS.POOL_DIAGNOSTIC,
  FUNNEL_STEPS.CONTACT_INFORMATION,
  FUNNEL_STEPS.BOOKING,
  FUNNEL_STEPS.CONFIRMATION,
] as const;

// =============================================================================
// Diagnostic Question IDs (stable identifiers)
// =============================================================================

export const DIAGNOSTIC_QUESTION_IDS = {
  WATER_FEATURE: "water-feature",
  INSTALLATION_TYPE: "installation-type",
  POOL_SIZE: "pool-size",
  CURRENT_TREATMENT: "current-treatment",
  CURRENT_ISSUES: "current-issues",
  PRIMARY_GOAL: "primary-goal",
} as const;

export type DiagnosticQuestionId =
  (typeof DIAGNOSTIC_QUESTION_IDS)[keyof typeof DIAGNOSTIC_QUESTION_IDS];

// =============================================================================
// Answer Codes (stable values stored in database)
// =============================================================================

export const WATER_FEATURE_CODES = [
  "pool",
  "spa",
  "pool_and_spa",
] as const;

export type WaterFeatureCode = (typeof WATER_FEATURE_CODES)[number];

export const INSTALLATION_TYPE_CODES = [
  "in_ground",
  "above_ground",
  "not_sure",
] as const;

export type InstallationTypeCode =
  (typeof INSTALLATION_TYPE_CODES)[number];

export const POOL_SIZE_CODES = [
  "small",
  "medium",
  "large",
  "not_sure",
] as const;

export type PoolSizeCode = (typeof POOL_SIZE_CODES)[number];

export const CURRENT_TREATMENT_CODES = [
  "chlorine",
  "salt",
  "other",
  "not_sure",
] as const;

export type CurrentTreatmentCode = (typeof CURRENT_TREATMENT_CODES)[number];

export const CURRENT_ISSUES_CODES = [
  "chemical_smell",
  "skin_eye_irritation",
  "cloudy_water",
  "algae",
  "scaling_staining",
  "frequent_adjustment",
  "high_cost",
  "children_pet_concerns",
  "other",
] as const;

export type CurrentIssueCode = (typeof CURRENT_ISSUES_CODES)[number];

export const PRIMARY_GOAL_CODES = [
  "family_confidence",
  "eliminate_chemicals",
  "tired_of_balancing",
  "algae_quality_problems",
  "simpler_routine",
] as const;

export type PrimaryGoalCode = (typeof PRIMARY_GOAL_CODES)[number];

export type QuestionType = "single-select" | "multi-select";

// =============================================================================
// Answer Option
// =============================================================================

export interface AnswerOption<TCode extends string = string> {
  code: TCode;
  label: string;
}

// =============================================================================
// Question Definition
// =============================================================================

export interface DiagnosticQuestion {
  id: DiagnosticQuestionId;
  type: QuestionType;
  required: boolean;
  title: string;
  subtitle?: string;
  options: AnswerOption[];
}

// =============================================================================
// Collected Diagnostic Answers
// =============================================================================

export interface DiagnosticAnswers {
  water_feature?: WaterFeatureCode;
  installation_type?: InstallationTypeCode;
  pool_size?: PoolSizeCode;
  current_treatment?: CurrentTreatmentCode;
  current_issues?: CurrentIssueCode[];
  primary_goal?: PrimaryGoalCode;
}

// =============================================================================
// Funnel State
// =============================================================================

export type SubmissionState =
  | "idle"
  | "submitting"
  | "success"
  | "duplicate"
  | "error";

// =============================================================================
// Booking Error Codes (safe, machine-readable — never expose raw server data)
// =============================================================================

export const BOOKING_ERROR_CODES = {
  MISSING_FIELDS: "missing_fields",
  CONFLICT: "conflict",
  SERVER_ERROR: "server_error",
  NETWORK_ERROR: "network_error",
  UNKNOWN_ERROR: "unknown_error",
} as const;

export type BookingErrorCode =
  (typeof BOOKING_ERROR_CODES)[keyof typeof BOOKING_ERROR_CODES];

export interface FunnelState {
  current_step: FunnelStepId;
  session_id: string | null;
  lead_id: string | null;
  first_name: string | null;
  email: string | null;
  diagnostic_answers: DiagnosticAnswers;
  completed_steps: FunnelStepId[];
  submission_state: SubmissionState;
  validation_errors: Record<string, string>;
  diag_current_index: number;
  hydration_ready: boolean;
  // Booking state
  selected_date: string | null;
  selected_slot_start: string | null;
  selected_slot_end: string | null;
  appointment_id: string | null;
  booking_submission_state: SubmissionState;
  booking_error: string | null;
  booking_error_code: BookingErrorCode | null;
  booking_api_code: string | null;
}
