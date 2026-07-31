import { describe, it, expect } from "vitest";
import { exitPopupLeadSchema } from "@/lib/validation/api-schemas";
import { splitName } from "@/components/exit-popup/exit-popup";

const SESSION_ID = "123e4567-e89b-12d3-a456-426614174000";

const validPayload = {
  session_id: SESSION_ID,
  contact: {
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@example.com",
  },
  consent: {
    consent_to_contact: true,
    marketing_consent: false,
    consent_text_version: "exit-popup-v1",
  },
};

describe("exitPopupLeadSchema", () => {
  it("accepts a valid name/email-only payload", () => {
    const result = exitPopupLeadSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("accepts an optional phone and zip code", () => {
    const result = exitPopupLeadSchema.safeParse({
      ...validPayload,
      contact: {
        ...validPayload.contact,
        phone: "+1 555 123 4567",
        zip_code: "90210",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = exitPopupLeadSchema.safeParse({
      ...validPayload,
      contact: { ...validPayload.contact, first_name: "" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing name", () => {
    const result = exitPopupLeadSchema.safeParse({
      ...validPayload,
      contact: {
        last_name: validPayload.contact.last_name,
        email: validPayload.contact.email,
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = exitPopupLeadSchema.safeParse({
      ...validPayload,
      contact: { ...validPayload.contact, email: "not-an-email" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing email", () => {
    const result = exitPopupLeadSchema.safeParse({
      ...validPayload,
      contact: {
        first_name: validPayload.contact.first_name,
        last_name: validPayload.contact.last_name,
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid phone", () => {
    const result = exitPopupLeadSchema.safeParse({
      ...validPayload,
      contact: { ...validPayload.contact, phone: "abc" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects consent when false", () => {
    const result = exitPopupLeadSchema.safeParse({
      ...validPayload,
      consent: { ...validPayload.consent, consent_to_contact: false },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing session_id", () => {
    const result = exitPopupLeadSchema.safeParse({
      contact: validPayload.contact,
      consent: validPayload.consent,
    });
    expect(result.success).toBe(false);
  });
});

describe("splitName", () => {
  it("splits a first + last name on the first space", () => {
    expect(splitName("Jane Doe")).toEqual({ first_name: "Jane", last_name: "Doe" });
  });

  it("treats a multi-word name's remainder as the last name", () => {
    expect(splitName("Mary Jane Watson")).toEqual({
      first_name: "Mary",
      last_name: "Jane Watson",
    });
  });

  it("keeps a single-word name with an empty last name", () => {
    expect(splitName("Madonna")).toEqual({ first_name: "Madonna", last_name: "" });
  });

  it("trims surrounding whitespace", () => {
    expect(splitName("  Jane   Doe  ")).toEqual({ first_name: "Jane", last_name: "Doe" });
  });

  it("handles an empty string", () => {
    expect(splitName("")).toEqual({ first_name: "", last_name: "" });
  });
});
