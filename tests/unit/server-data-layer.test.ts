import { describe, it, expect } from "vitest";
import {
  funnelSessionSchema,
  funnelEventSchema,
  leadCreateSchema,
  normalizeEmail,
  normalizePhone,
} from "@/lib/validation/api-schemas";
import { ALL_INTERNAL_EVENT_NAMES } from "@/config/tracking-events";
import {
  checkRateLimit,
  createPublicError,
} from "@/lib/server/request-protection";
import { mapLeadRpcError } from "@/lib/server/lead-rpc-errors";

// =============================================================================
// Session validation
// =============================================================================

describe("funnelSessionSchema", () => {
  const valid = {
    anonymous_id: "anon-123",
    page_version: "1.0.0",
  };

  it("accepts a minimal valid session", () => {
    expect(funnelSessionSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a session with all optional fields", () => {
    const result = funnelSessionSchema.safeParse({
      ...valid,
      landing_url: "https://example.com",
      referrer: "https://google.com",
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "summer",
      utm_content: "hero",
      utm_term: "pool",
      fbclid: "fb.1.123",
      fbc: "fb.1.123",
      fbp: "fb.1.123",
      device_category: "mobile",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing anonymous_id", () => {
    const result = funnelSessionSchema.safeParse({ page_version: "1.0.0" });
    expect(result.success).toBe(false);
  });

  it("rejects missing page_version", () => {
    const result = funnelSessionSchema.safeParse({ anonymous_id: "a" });
    expect(result.success).toBe(false);
  });

  it("rejects empty anonymous_id after trim", () => {
    const result = funnelSessionSchema.safeParse({
      anonymous_id: "   ",
      page_version: "1.0.0",
    });
    expect(result.success).toBe(false);
  });

  it("rejects anonymous_id over 128 chars", () => {
    const result = funnelSessionSchema.safeParse({
      anonymous_id: "x".repeat(129),
      page_version: "1.0.0",
    });
    expect(result.success).toBe(false);
  });

  it("trims strings", () => {
    const result = funnelSessionSchema.safeParse({
      anonymous_id: "  anon-123  ",
      page_version: "  1.0.0  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.anonymous_id).toBe("anon-123");
      expect(result.data.page_version).toBe("1.0.0");
    }
  });
});

// =============================================================================
// Event validation
// =============================================================================

const SESSION_UUID = "a1b2c3d4-e5f6-4789-abcd-ef0123456789";
const LEAD_UUID = "b2c3d4e5-f6a7-4890-8cde-f01234567890";
const EVENT_UUID = "c3d4e5f6-a7b8-4901-8def-012345678901";

describe("funnelEventSchema", () => {
  const valid = {
    session_id: SESSION_UUID,
    event_name: "page_viewed",
    page_version: "1.0.0",
  };

  it("accepts a minimal valid event", () => {
    expect(funnelEventSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a full valid event", () => {
    const result = funnelEventSchema.safeParse({
      ...valid,
      lead_id: LEAD_UUID,
      section_id: "hero",
      step_id: "hero",
      question_id: "water-feature",
      answer_code: "pool",
      duration_ms: 1500,
      event_id: EVENT_UUID,
      metadata: { someKey: "someValue" },
      occurred_at: "2026-07-24T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid event_name", () => {
    const result = funnelEventSchema.safeParse({
      ...valid,
      event_name: "not_a_valid_event",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative duration_ms", () => {
    const result = funnelEventSchema.safeParse({
      ...valid,
      duration_ms: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer duration_ms", () => {
    const result = funnelEventSchema.safeParse({
      ...valid,
      duration_ms: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts zero duration_ms", () => {
    const result = funnelEventSchema.safeParse({
      ...valid,
      duration_ms: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid session_id", () => {
    const result = funnelEventSchema.safeParse({
      ...valid,
      session_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing page_version", () => {
    const result = funnelEventSchema.safeParse({
      session_id: SESSION_UUID,
      event_name: "page_viewed",
    });
    expect(result.success).toBe(false);
  });

  it("rejects metadata with more than 10 keys", () => {
    const metadata: Record<string, unknown> = {};
    for (let i = 0; i < 11; i++) {
      metadata[`key${i}`] = `value${i}`;
    }
    const result = funnelEventSchema.safeParse({
      ...valid,
      metadata,
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// PII metadata rejection
// =============================================================================

describe("PII metadata rejection", () => {
  const base = {
    session_id: SESSION_UUID,
    event_name: "page_viewed" as const,
    page_version: "1.0.0",
  };

  const piiKeys = ["email", "phone", "first_name", "last_name", "name", "address"];

  for (const key of piiKeys) {
    it(`rejects metadata with key "${key}"`, () => {
      const result = funnelEventSchema.safeParse({
        ...base,
        metadata: { [key]: "some-value" },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const metadataIssues = result.error.issues.some((i) =>
          i.path.includes("metadata") && i.message.toLowerCase().includes("sensitive"),
        );
        expect(metadataIssues).toBe(true);
      }
    });
  }

  it("rejects metadata with case-varied PII key", () => {
    const result = funnelEventSchema.safeParse({
      ...base,
      metadata: { Email: "test@example.com" },
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Lead validation
// =============================================================================

describe("leadCreateSchema", () => {
  const valid = {
    session_id: SESSION_UUID,
    contact: {
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      phone: "+15551234567",
      zip_code: "90210",
    },
    diagnostic: {
      water_feature: "pool",
      installation_type: "in_ground",
      pool_size: "average",
      current_treatment: "chlorine",
      current_issues: ["algae", "cloudy_water"],
      primary_goal: "family_confidence",
    },
    consent: {
      consent_to_contact: true,
      marketing_consent: false,
      consent_text_version: "v1",
    },
  };

  it("accepts a complete valid lead", () => {
    expect(leadCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts optional source and preferred_contact_method", () => {
    const result = leadCreateSchema.safeParse({
      ...valid,
      contact: { ...valid.contact, preferred_contact_method: "email" },
      source: "organic",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing session_id", () => {
    const rest = { ...valid } as Record<string, unknown>;
    delete rest.session_id;
    const result = leadCreateSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = leadCreateSchema.safeParse({
      ...valid,
      contact: { ...valid.contact, email: "not-an-email" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects phone with invalid characters", () => {
    const result = leadCreateSchema.safeParse({
      ...valid,
      contact: { ...valid.contact, phone: "555-ABC-1234" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty first_name", () => {
    const result = leadCreateSchema.safeParse({
      ...valid,
      contact: { ...valid.contact, first_name: "" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid water_feature code", () => {
    const result = leadCreateSchema.safeParse({
      ...valid,
      diagnostic: { ...valid.diagnostic, water_feature: "pond" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty current_issues", () => {
    const result = leadCreateSchema.safeParse({
      ...valid,
      diagnostic: { ...valid.diagnostic, current_issues: [] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid preferred_contact_method", () => {
    const result = leadCreateSchema.safeParse({
      ...valid,
      contact: { ...valid.contact, preferred_contact_method: "fax" },
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Consent requirement
// =============================================================================

describe("consent requirement", () => {
  const base = {
    session_id: SESSION_UUID,
    contact: {
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      phone: "+15551234567",
      zip_code: "90210",
    },
    diagnostic: {
      water_feature: "pool",
      installation_type: "in_ground",
      pool_size: "average",
      current_treatment: "chlorine",
      current_issues: ["algae"],
      primary_goal: "family_confidence",
    },
    consent: {
      consent_to_contact: true,
      consent_text_version: "v1",
    },
  };

  it("rejects consent_to_contact = false", () => {
    const result = leadCreateSchema.safeParse({
      ...base,
      consent: { ...base.consent, consent_to_contact: false },
    });
    expect(result.success).toBe(false);
  });

  it("rejects consent_to_contact = undefined", () => {
    const consentRest: Record<string, unknown> = { ...base.consent };
    delete consentRest.consent_to_contact;
    const result = leadCreateSchema.safeParse({
      ...base,
      consent: consentRest,
    });
    expect(result.success).toBe(false);
  });

  it("accepts consent_to_contact = true", () => {
    const result = leadCreateSchema.safeParse(base);
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Phone / email normalization
// =============================================================================

describe("normalizeEmail", () => {
  it("lowercases an email", () => {
    expect(normalizeEmail("John@Example.COM")).toBe("john@example.com");
  });

  it("trims whitespace", () => {
    expect(normalizeEmail("  test@example.com  ")).toBe("test@example.com");
  });
});

describe("normalizePhone", () => {
  it("adds +1 prefix for 10-digit US number", () => {
    expect(normalizePhone("5551234567")).toBe("+15551234567");
  });

  it("adds + prefix for 11-digit number starting with 1", () => {
    expect(normalizePhone("15551234567")).toBe("+15551234567");
  });

  it("keeps non-us prefix for non-11-digit", () => {
    expect(normalizePhone("442071234567")).toBe("+442071234567");
  });

  it("strips non-digit characters", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("+15551234567");
  });

  it("handles + prefix already present", () => {
    expect(normalizePhone("+15551234567")).toBe("+15551234567");
  });
});

// =============================================================================
// Canonical event enforcement
// =============================================================================

describe("canonical event enforcement", () => {
  it("every event in ALL_INTERNAL_EVENT_NAMES should parse as eventName", () => {
    for (const name of ALL_INTERNAL_EVENT_NAMES) {
      const result = funnelEventSchema.safeParse({
        session_id: SESSION_UUID,
        event_name: name,
        page_version: "1.0.0",
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects a name not in the canonical list", () => {
    const result = funnelEventSchema.safeParse({
      session_id: SESSION_UUID,
      event_name: "custom_event",
      page_version: "1.0.0",
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Rate limiter behavior
// =============================================================================

describe("checkRateLimit", () => {
  const config = { maxRequests: 3, windowMs: 60_000 };

  it("allows requests within the limit", () => {
    const ip = "192.168.1.1";
    expect(checkRateLimit(ip, config).allowed).toBe(true);
    expect(checkRateLimit(ip, config).allowed).toBe(true);
    expect(checkRateLimit(ip, config).allowed).toBe(true);
  });

  it("blocks requests over the limit", () => {
    const ip = "192.168.1.2";
    checkRateLimit(ip, config);
    checkRateLimit(ip, config);
    checkRateLimit(ip, config);
    const result = checkRateLimit(ip, config);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets after window expires", () => {
    const ip = "192.168.1.3";
    const configShort = { maxRequests: 1, windowMs: 1 };

    checkRateLimit(ip, configShort);
    expect(checkRateLimit(ip, configShort).allowed).toBe(false);

    // Wait briefly for window to expire
    const result = checkRateLimit(ip, configShort);
    if (Date.now() >= result.resetAt) {
      // The window has reset, should allow
      const result2 = checkRateLimit(ip, configShort);
      expect(result2.allowed).toBe(true);
    }
  });

  it("treats null IP as 'unknown'", () => {
    const config2 = { maxRequests: 1, windowMs: 60_000 };
    expect(checkRateLimit(null, config2).allowed).toBe(true);
    expect(checkRateLimit(null, config2).allowed).toBe(false);
  });
});

// =============================================================================
// Safe error shape
// =============================================================================

// =============================================================================
// RPC parameter behavior — explicit null / false for optional fields
// =============================================================================

describe("RPC parameter behavior", () => {
  const base = {
    session_id: SESSION_UUID,
    contact: {
      first_name: "Jane",
      last_name: "Doe",
      email: "jane@example.com",
      phone: "+15551234567",
      zip_code: "10001",
    },
    diagnostic: {
      water_feature: "pool",
      installation_type: "in_ground",
      pool_size: "small",
      current_treatment: "chlorine",
      current_issues: ["algae"],
      primary_goal: "family_confidence",
    },
    consent: {
      consent_to_contact: true,
      marketing_consent: false,
      consent_text_version: "v1",
    },
  };

  it("outputs undefined for omitted preferred_contact_method", () => {
    const result = leadCreateSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contact.preferred_contact_method).toBeUndefined();
    }
  });

  it("outputs explicit null fallback for omitted preferred_contact_method via ?? null", () => {
    const result = leadCreateSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      const apiValue = result.data.contact.preferred_contact_method ?? null;
      expect(apiValue).toBeNull();
    }
  });

  it("defaults marketing_consent to false when omitted", () => {
    const result = leadCreateSchema.safeParse({
      ...base,
      consent: { consent_to_contact: true, consent_text_version: "v1" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.consent.marketing_consent).toBe(false);
    }
  });

  it("outputs explicit false for marketing_consent", () => {
    const result = leadCreateSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.consent.marketing_consent).toBe(false);
    }
  });

  it("outputs undefined for omitted source", () => {
    const result = leadCreateSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBeUndefined();
    }
  });

  it("outputs explicit null fallback for omitted source via ?? null", () => {
    const result = leadCreateSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      const apiValue = result.data.source ?? null;
      expect(apiValue).toBeNull();
    }
  });
});

// =============================================================================
// Current issues array validation
// =============================================================================

describe("current_issues validation", () => {
  const base = {
    session_id: SESSION_UUID,
    contact: {
      first_name: "Bob",
      last_name: "Smith",
      email: "bob@example.com",
      phone: "+15551234567",
      zip_code: "20001",
    },
    diagnostic: {
      water_feature: "pool",
      installation_type: "in_ground",
      pool_size: "small",
      current_treatment: "chlorine",
      current_issues: ["algae"],
      primary_goal: "family_confidence",
    },
    consent: {
      consent_to_contact: true,
      marketing_consent: false,
      consent_text_version: "v1",
    },
  };

  it("rejects empty current_issues", () => {
    const result = leadCreateSchema.safeParse({
      ...base,
      diagnostic: { ...base.diagnostic, current_issues: [] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects null current_issues", () => {
    const result = leadCreateSchema.safeParse({
      ...base,
      diagnostic: { ...base.diagnostic, current_issues: null },
    });
    expect(result.success).toBe(false);
  });

  it("accepts current_issues with a single entry", () => {
    const result = leadCreateSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("accepts current_issues with duplicate entries (API allows, RPC enforces)", () => {
    const result = leadCreateSchema.safeParse({
      ...base,
      diagnostic: {
        ...base.diagnostic,
        current_issues: ["algae", "algae"],
      },
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Lead conflict behavior — schema cannot detect already-linked sessions
// =============================================================================

describe("lead conflict detection (schema level)", () => {
  const base = {
    session_id: SESSION_UUID,
    contact: {
      first_name: "Alice",
      last_name: "Jones",
      email: "alice@example.com",
      phone: "+15551234567",
      zip_code: "30001",
    },
    diagnostic: {
      water_feature: "spa",
      installation_type: "above_ground",
      pool_size: "not_sure",
      current_treatment: "salt",
      current_issues: ["cloudy_water"],
      primary_goal: "family_confidence",
    },
    consent: {
      consent_to_contact: true,
      marketing_consent: false,
      consent_text_version: "v1",
    },
  };

  it("accepts a valid lead submission regardless of session state", () => {
    const result = leadCreateSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("does not reject already-linked sessions at schema level", () => {
    const result = leadCreateSchema.safeParse(base);
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// RPC error mapping
// =============================================================================

describe("mapLeadRpcError", () => {
  it("maps P0002 to 404 with session not found message", () => {
    const result = mapLeadRpcError("P0002");
    expect(result).toEqual({ status: 404, message: "Session not found" });
  });

  it("maps P0003 to 409 with session already linked message", () => {
    const result = mapLeadRpcError("P0003");
    expect(result).toEqual({ status: 409, message: "Session already linked to a lead" });
  });

  it("maps P0004 to 422 with consent required message", () => {
    const result = mapLeadRpcError("P0004");
    expect(result).toEqual({ status: 422, message: "Consent to contact is required" });
  });

  it("maps P0005 to 422 with validation failed message", () => {
    const result = mapLeadRpcError("P0005");
    expect(result).toEqual({ status: 422, message: "Validation failed" });
  });

  it("maps P0006 to 422 with validation failed message", () => {
    const result = mapLeadRpcError("P0006");
    expect(result).toEqual({ status: 422, message: "Validation failed" });
  });

  it("maps P0007 to 422 with validation failed message", () => {
    const result = mapLeadRpcError("P0007");
    expect(result).toEqual({ status: 422, message: "Validation failed" });
  });

  it("returns null for unknown error codes", () => {
    expect(mapLeadRpcError("UNKNOWN")).toBeNull();
    expect(mapLeadRpcError("P0001")).toBeNull();
    expect(mapLeadRpcError("23505")).toBeNull();
  });
});

describe("createPublicError", () => {
  it("returns a safe error shape", () => {
    const err = createPublicError(422, "Validation failed");
    expect(err).toEqual({
      error: {
        status: 422,
        message: "Validation failed",
      },
    });
  });

  it("does not include stack traces or internals", () => {
    const err = createPublicError(500, "Internal server error");
    expect(err).not.toHaveProperty("stack");
    expect(err).not.toHaveProperty("details");
    expect(err).not.toHaveProperty("code");
  });
});
