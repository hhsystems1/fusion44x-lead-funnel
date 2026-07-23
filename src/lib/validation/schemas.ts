import { z } from "zod";
import {
  WATER_FEATURE_CODES,
  INSTALLATION_TYPE_CODES,
  POOL_SIZE_CODES,
  CURRENT_TREATMENT_CODES,
  CURRENT_ISSUES_CODES,
  PRIMARY_GOAL_CODES,
} from "@/types/funnel";

// =============================================================================
// Individual answer schemas
// =============================================================================

export const waterFeatureSchema = z.enum(WATER_FEATURE_CODES);

export const installationTypeSchema = z.enum(INSTALLATION_TYPE_CODES);

export const poolSizeSchema = z.enum(POOL_SIZE_CODES);

export const currentTreatmentSchema = z.enum(CURRENT_TREATMENT_CODES);

export const currentIssuesSchema = z.array(z.enum(CURRENT_ISSUES_CODES));

export const primaryGoalSchema = z.enum(PRIMARY_GOAL_CODES);

// =============================================================================
// Diagnostic answers schema (all questions)
// =============================================================================

export const diagnosticAnswersSchema = z.object({
  water_feature: waterFeatureSchema,
  installation_type: installationTypeSchema,
  pool_size: poolSizeSchema,
  current_treatment: currentTreatmentSchema,
  current_issues: currentIssuesSchema.optional(),
  primary_goal: primaryGoalSchema,
});

export type DiagnosticAnswersInput = z.input<typeof diagnosticAnswersSchema>;
export type DiagnosticAnswersOutput = z.output<typeof diagnosticAnswersSchema>;

// =============================================================================
// Contact information schemas
// =============================================================================

export const contactNameSchema = z
  .string()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be under 100 characters");

export const contactEmailSchema = z
  .string()
  .email("A valid email address is required")
  .max(320);

export const contactPhoneSchema = z
  .string()
  .min(10, "Phone number must have at least 10 digits")
  .max(20, "Phone number is too long")
  .regex(
    /^[\d\s\-().+]+$/,
    "Phone number can only contain digits, spaces, and the characters -().+",
  );

export const contactInfoSchema = z.object({
  full_name: contactNameSchema,
  email: contactEmailSchema,
  phone: contactPhoneSchema,
});

export type ContactInfoInput = z.input<typeof contactInfoSchema>;
export type ContactInfoOutput = z.output<typeof contactInfoSchema>;

// =============================================================================
// Combined lead submission schema
// =============================================================================

export const leadSubmissionSchema = z.object({
  full_name: contactNameSchema,
  email: contactEmailSchema,
  phone: contactPhoneSchema,
  diagnostic_answers: diagnosticAnswersSchema.optional(),
});

export type LeadSubmissionInput = z.input<typeof leadSubmissionSchema>;
export type LeadSubmissionOutput = z.output<typeof leadSubmissionSchema>;
