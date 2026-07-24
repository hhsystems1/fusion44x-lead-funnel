import { describe, it, expect, beforeEach, vi } from "vitest";

const fetchSpy = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = fetchSpy;
});

import { submitLead, buildLeadPayload } from "@/lib/funnel/api";
import type { DiagnosticAnswers } from "@/types/funnel";

describe("buildLeadPayload", () => {
  it("builds a valid lead payload from contact and diagnostic data", () => {
    const payload = buildLeadPayload({
      session_id: "session-uuid",
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      phone: "+15551234567",
      zip_code: "90210",
      diagnostic_answers: {
        water_feature: "pool",
        installation_type: "in_ground",
        pool_size: "10000_to_20000",
        current_treatment: "chlorine",
        current_issues: ["algae"],
        primary_goal: "clearer_water",
      },
      marketing_consent: true,
    });

    expect(payload.session_id).toBe("session-uuid");
    expect(payload.contact.first_name).toBe("John");
    expect(payload.contact.last_name).toBe("Doe");
    expect(payload.diagnostic.water_feature).toBe("pool");
    expect(payload.diagnostic.current_issues).toEqual(["algae"]);
    expect(payload.consent.consent_to_contact).toBe(true);
    expect(payload.consent.marketing_consent).toBe(true);
    expect(payload.consent.consent_text_version).toBe("v1");
  });

  it("includes optional preferred_contact_method", () => {
    const payload = buildLeadPayload({
      session_id: "s1",
      first_name: "A",
      last_name: "B",
      email: "a@b.com",
      phone: "5551234567",
      zip_code: "10001",
      preferred_contact_method: "email",
      diagnostic_answers: {} as DiagnosticAnswers,
      marketing_consent: false,
    });

    expect(payload.contact.preferred_contact_method).toBe("email");
  });

  it("handles empty diagnostic answers gracefully", () => {
    const payload = buildLeadPayload({
      session_id: "s1",
      first_name: "A",
      last_name: "B",
      email: "a@b.com",
      phone: "5551234567",
      zip_code: "10001",
      diagnostic_answers: {} as DiagnosticAnswers,
      marketing_consent: false,
    });

    expect(payload.diagnostic.water_feature).toBe("");
    expect(payload.diagnostic.current_issues).toEqual([]);
  });
});

describe("submitLead", () => {
  const payload = buildLeadPayload({
    session_id: "session-uuid",
    first_name: "John",
    last_name: "Doe",
    email: "john@example.com",
    phone: "+15551234567",
    zip_code: "90210",
    diagnostic_answers: {
      water_feature: "pool",
      installation_type: "in_ground",
      pool_size: "10000_to_20000",
      current_treatment: "chlorine",
      current_issues: ["algae"],
      primary_goal: "clearer_water",
    },
    marketing_consent: false,
  });

  it("returns lead_id on success", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ lead_id: "lead-uuid" }),
    });

    const result = await submitLead(payload);
    expect(result.lead_id).toBe("lead-uuid");
    expect(result.status).toBe(201);
  });

  it("returns duplicate flag on 409", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 409,
    });

    const result = await submitLead(payload);
    expect(result.duplicate).toBe(true);
    expect(result.status).toBe(409);
  });

  it("returns status for other errors", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await submitLead(payload);
    expect(result.lead_id).toBeUndefined();
    expect(result.duplicate).toBeUndefined();
    expect(result.status).toBe(500);
  });
});
