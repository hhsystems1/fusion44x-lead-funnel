import { describe, it, expect } from "vitest";
import {
  contactFormSchema,
  validateContactForm,
  isContactFormReady,
  type ContactFormData,
} from "@/lib/funnel/contact-validation";

const validData: ContactFormData = {
  first_name: "John",
  last_name: "Doe",
  email: "john@example.com",
  phone: "+15551234567",
  zip_code: "90210",
  consent_to_contact: true,
};

describe("contactFormSchema", () => {
  it("accepts valid data", () => {
    const result = contactFormSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("accepts optional fields", () => {
    const result = contactFormSchema.safeParse({
      ...validData,
      preferred_contact_method: "email",
      marketing_consent: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing first_name", () => {
    const result = contactFormSchema.safeParse(
      Object.fromEntries(
        Object.entries(validData).filter(([k]) => k !== "first_name"),
      ),
    );
    expect(result.success).toBe(false);
  });

  it("rejects missing last_name", () => {
    const result = contactFormSchema.safeParse(
      Object.fromEntries(
        Object.entries(validData).filter(([k]) => k !== "last_name"),
      ),
    );
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = contactFormSchema.safeParse({
      ...validData,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects phone with invalid characters", () => {
    const result = contactFormSchema.safeParse({
      ...validData,
      phone: "555-ABC-1234",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing zip_code", () => {
    const result = contactFormSchema.safeParse(
      Object.fromEntries(
        Object.entries(validData).filter(([k]) => k !== "zip_code"),
      ),
    );
    expect(result.success).toBe(false);
  });

  it("requires consent_to_contact to be true", () => {
    const result = contactFormSchema.safeParse({
      ...validData,
      consent_to_contact: false,
    });
    expect(result.success).toBe(false);
  });

  it("accepts marketing_consent as optional boolean", () => {
    const result = contactFormSchema.safeParse({
      ...validData,
      marketing_consent: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid preferred_contact_method", () => {
    for (const method of ["email", "phone", "text"] as const) {
      const result = contactFormSchema.safeParse({
        ...validData,
        preferred_contact_method: method,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid preferred_contact_method", () => {
    const result = contactFormSchema.safeParse({
      ...validData,
      preferred_contact_method: "fax",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty first_name after trim", () => {
    const result = contactFormSchema.safeParse({
      ...validData,
      first_name: "   ",
    });
    expect(result.success).toBe(false);
  });
});

describe("validateContactForm", () => {
  it("returns valid for correct data", () => {
    const result = validateContactForm(validData as unknown as Record<string, unknown>);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns errors for invalid data", () => {
    const result = validateContactForm({ first_name: "", zip_code: "" });
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors).length).toBeGreaterThan(0);
  });

  it("includes consent error when false", () => {
    const result = validateContactForm({
      ...validData,
      consent_to_contact: false,
    } as unknown as Record<string, unknown>);
    expect(result.valid).toBe(false);
    expect(result.errors.consent_to_contact).toBeDefined();
  });

  it("reports readiness based on full required input", () => {
    expect(isContactFormReady(validData as unknown as Record<string, unknown>)).toBe(true);
    expect(
      isContactFormReady({
        ...validData,
        consent_to_contact: false,
      } as unknown as Record<string, unknown>),
    ).toBe(false);
    expect(
      isContactFormReady({
        ...validData,
        preferred_contact_method: "",
      } as unknown as Record<string, unknown>),
    ).toBe(true);
  });
});
