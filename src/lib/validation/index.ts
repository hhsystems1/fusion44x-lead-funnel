import type { LeadSubmission } from "@/types/lead";
import { validateEmail, validatePhone } from "@/lib/security";

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateLeadSubmission(
  data: Partial<LeadSubmission>,
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.full_name || data.full_name.trim().length < 2) {
    errors.full_name = "Full name is required (minimum 2 characters)";
  }

  if (!data.email || !validateEmail(data.email)) {
    errors.email = "A valid email address is required";
  }

  if (!data.phone || !validatePhone(data.phone)) {
    errors.phone = "A valid phone number is required (10–15 digits)";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
