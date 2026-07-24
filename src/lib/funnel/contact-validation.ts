import { z } from "zod";

const textField = (max: number) =>
  z.string().trim().min(1, "Required").max(max);

export const contactFormSchema = z.object({
  first_name: textField(100),
  last_name: textField(100),
  email: z.string().trim().max(320).email("Please enter a valid email address"),
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
  consent_to_contact: z.literal(true, {
    message: "You must agree to be contacted to proceed",
  }),
  marketing_consent: z.boolean().optional(),
});

export type ContactFormData = z.input<typeof contactFormSchema>;

export function validateContactForm(
  data: Record<string, unknown>,
): { valid: boolean; errors: Record<string, string> } {
  const result = contactFormSchema.safeParse(data);
  if (result.success) {
    return { valid: true, errors: {} };
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }
  return { valid: false, errors };
}
