import { z } from "zod";
import {
  ALL_INTERNAL_EVENT_NAMES,
} from "@/config/tracking-events";
import {
  WATER_FEATURE_CODES,
  INSTALLATION_TYPE_CODES,
  POOL_SIZE_CODES,
  CURRENT_TREATMENT_CODES,
  CURRENT_ISSUES_CODES,
  PRIMARY_GOAL_CODES,
} from "@/types/funnel";

const textField = (max: number) =>
  z.string().trim().min(1, "Required").max(max);

const optionalTextField = (max: number) =>
  z.string().trim().max(max).optional();

const uuidField = z.string().uuid();

export const funnelSessionSchema = z.object({
  anonymous_id: textField(128),
  page_version: textField(32),
  landing_url: optionalTextField(2048),
  referrer: optionalTextField(2048),
  utm_source: optionalTextField(256),
  utm_medium: optionalTextField(256),
  utm_campaign: optionalTextField(256),
  utm_content: optionalTextField(256),
  utm_term: optionalTextField(256),
  fbclid: optionalTextField(512),
  fbc: optionalTextField(512),
  fbp: optionalTextField(512),
  device_category: optionalTextField(64),
});

export type FunnelSessionInput = z.input<typeof funnelSessionSchema>;

export const eventNameSchema = z.enum(
  ALL_INTERNAL_EVENT_NAMES as [string, ...string[]],
);

const PII_KEYS = [
  "email",
  "phone",
  "first_name",
  "last_name",
  "name",
  "address",
] as const;

const metadataSchema = z
  .record(z.string(), z.unknown())
  .superRefine((val, ctx) => {
    const keys = Object.keys(val);
    if (keys.length > 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Metadata must have at most 10 keys",
      });
      return;
    }
    for (const key of keys) {
      const lower = key.toLowerCase();
      if ((PII_KEYS as readonly string[]).includes(lower)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Metadata must not contain sensitive field: ${key}`,
          path: [key],
        });
      }
    }
  });

export const funnelEventSchema = z.object({
  session_id: uuidField,
  lead_id: uuidField.optional(),
  event_name: eventNameSchema,
  section_id: optionalTextField(128),
  step_id: optionalTextField(128),
  question_id: optionalTextField(128),
  answer_code: optionalTextField(128),
  duration_ms: z
    .number()
    .int("duration_ms must be an integer")
    .nonnegative("duration_ms must not be negative")
    .optional(),
  page_version: textField(32),
  event_id: uuidField.optional(),
  metadata: metadataSchema.optional(),
  occurred_at: z.string().datetime().optional(),
});

export type FunnelEventInput = z.input<typeof funnelEventSchema>;

const waterFeatureSchema = z.enum(WATER_FEATURE_CODES);
const installationTypeSchema = z.enum(INSTALLATION_TYPE_CODES);
const poolSizeSchema = z.enum(POOL_SIZE_CODES);
const currentTreatmentSchema = z.enum(CURRENT_TREATMENT_CODES);
const currentIssuesSchema = z.array(z.enum(CURRENT_ISSUES_CODES)).min(1);
const primaryGoalSchema = z.enum(PRIMARY_GOAL_CODES);

export const leadCreateSchema = z.object({
  session_id: uuidField,
  event_id: uuidField.optional(),
  contact: z.object({
    first_name: textField(100),
    last_name: textField(100),
    email: z.string().trim().max(320).email("Invalid email address"),
    phone: z
      .string()
      .trim()
      .min(1, "Required")
      .max(30)
      .regex(
        /^[\d\s\-().+]+$/,
        "Phone can only contain digits, spaces, and the characters -().+",
      ),
    zip_code: textField(20),
    preferred_contact_method: z.enum(["email", "phone", "text"]).optional(),
  }),
  diagnostic: z.object({
    water_feature: waterFeatureSchema,
    installation_type: installationTypeSchema,
    pool_size: poolSizeSchema,
    current_treatment: currentTreatmentSchema,
    current_issues: currentIssuesSchema,
    primary_goal: primaryGoalSchema,
  }),
  consent: z.object({
    consent_to_contact: z
      .boolean()
      .refine((val) => val === true, "consent_to_contact must be true"),
    marketing_consent: z.boolean().default(false),
    consent_text_version: textField(32),
  }),
  source: optionalTextField(128),
});

export type LeadCreateInput = z.input<typeof leadCreateSchema>;

export const exitPopupLeadSchema = z.object({
  session_id: uuidField,
  event_id: uuidField.optional(),
  contact: z.object({
    first_name: textField(100),
    last_name: textField(100),
    email: z.string().trim().max(320).email("Invalid email address"),
    phone: z
      .string()
      .trim()
      .max(30)
      .regex(
        /^[\d\s\-().+]*$/,
        "Phone can only contain digits, spaces, and the characters -().+",
      )
      .optional()
      .default(""),
    zip_code: optionalTextField(20),
  }),
  consent: z.object({
    consent_to_contact: z
      .boolean()
      .refine((val) => val === true, "consent_to_contact must be true"),
    marketing_consent: z.boolean().default(false),
    consent_text_version: textField(32),
  }),
  source: optionalTextField(128),
});

export type ExitPopupLeadInput = z.input<typeof exitPopupLeadSchema>;

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  return `+${digits}`;
}
