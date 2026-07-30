import { describe, it, expect } from "vitest";
import { createMetaUserData, createMetaPayload, tryCreateMetaCapiClient } from "@/lib/meta";
import { hashEmail, hashPhone, hashName, hashZipCode } from "@/lib/meta/hash";

describe("createMetaUserData", () => {
  it("hashes em, ph, fn, ln, zp and passes raw fields through", () => {
    const result = createMetaUserData({
      email: "Test@Example.com",
      phone: "(212) 555-0100",
      first_name: "John",
      last_name: "Doe",
      zip_code: "10001",
      client_ip_address: "1.2.3.4",
      client_user_agent: "Mozilla/5.0",
      fbc: "fb.1.123.abc",
      fbp: "fb.1.123.def",
    });

    expect(result.em).toEqual([hashEmail("Test@Example.com")]);
    expect(result.ph).toEqual([hashPhone("(212) 555-0100")]);
    expect(result.fn).toBe(hashName("John"));
    expect(result.ln).toBe(hashName("Doe"));
    expect(result.zp).toBe(hashZipCode("10001"));
    expect(result.client_ip_address).toBe("1.2.3.4");
    expect(result.client_user_agent).toBe("Mozilla/5.0");
    expect(result.fbc).toBe("fb.1.123.abc");
    expect(result.fbp).toBe("fb.1.123.def");
  });

  it("omits optional fields when not provided", () => {
    const result = createMetaUserData({
      email: "test@test.com",
      phone: "5550100",
    });

    expect(result.em).toBeDefined();
    expect(result.ph).toBeDefined();
    expect(result.fn).toBeUndefined();
    expect(result.ln).toBeUndefined();
    expect(result.zp).toBeUndefined();
    expect(result.client_ip_address).toBeUndefined();
    expect(result.client_user_agent).toBeUndefined();
    expect(result.fbc).toBeUndefined();
    expect(result.fbp).toBeUndefined();
  });

  it("returns empty object when no fields provided", () => {
    const result = createMetaUserData({
      email: "",
      phone: "",
    });

    // Empty string is falsy, so these shouldn't be set
    expect(result.em).toBeUndefined();
    expect(result.ph).toBeUndefined();
  });

  it("normalizes phone before hashing", () => {
    const result = createMetaUserData({
      email: "a@b.com",
      phone: "+1 (212) 555-0100",
    });
    // hashPhone strips non-digits: +1 (212) 555-0100 → 12125550100
    expect(result.ph).toEqual([hashPhone("+1 (212) 555-0100")]);
  });
});

describe("createMetaPayload", () => {
  const minimalCustomerInfo = {
    email: "test@test.com",
    phone: "5550100",
  };

  it("builds a valid Meta event payload structure", () => {
    const payload = createMetaPayload({
      event_name: "Contact",
      event_id: "550e8400-e29b-41d4-a716-446655440000",
      action_source: "website",
      customer_info: minimalCustomerInfo,
    });

    expect(payload.event_name).toBe("Contact");
    expect(payload.event_id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(payload.event_time).toBeGreaterThan(0);
    expect(payload.action_source).toBe("website");
    expect(payload.user_data).toBeDefined();
    expect(payload.event_source_url).toBeUndefined();
    expect(payload.custom_data).toBeUndefined();
  });

  it("includes event_source_url and custom_data when provided", () => {
    const payload = createMetaPayload({
      event_name: "Schedule",
      event_id: "id-2",
      event_source_url: "https://fusion44x.com/booking",
      action_source: "website",
      customer_info: minimalCustomerInfo,
      custom_data: { appointment_type: "consultation" },
    });

    expect(payload.event_source_url).toBe("https://fusion44x.com/booking");
    expect(payload.custom_data).toEqual({ appointment_type: "consultation" });
  });

  it("hashes user_data via createMetaUserData", () => {
    const payload = createMetaPayload({
      event_name: "Contact",
      event_id: "id-3",
      action_source: "website",
      customer_info: {
        email: "User@Domain.com",
        phone: "555-0100",
      },
    });

    expect(payload.user_data.em).toEqual([hashEmail("User@Domain.com")]);
    expect(payload.user_data.ph).toEqual([hashPhone("555-0100")]);
  });
});

describe("tryCreateMetaCapiClient", () => {
  it("returns null when META_CAPI_ACCESS_TOKEN is not set", () => {
    // In test env, process.env.META_CAPI_ACCESS_TOKEN won't be set
    const client = tryCreateMetaCapiClient();
    expect(client).toBeNull();
  });
});
