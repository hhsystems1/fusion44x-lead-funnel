import { describe, it, expect } from "vitest";
import {
  ALL_INTERNAL_EVENT_NAMES,
  ALL_META_EVENT_NAMES,
} from "@/config/tracking-events";
import type {
  InternalEventPayload,
  MetaEventPayload,
  CustomerInfo,
} from "@/types/tracking";

describe("InternalEvents", () => {
  it("contains exactly 27 event names", () => {
    expect(ALL_INTERNAL_EVENT_NAMES.length).toBe(27);
  });

  it("has no duplicate values", () => {
    const unique = new Set(ALL_INTERNAL_EVENT_NAMES);
    expect(unique.size).toBe(ALL_INTERNAL_EVENT_NAMES.length);
  });

  it("uses snake_case naming convention", () => {
    for (const name of ALL_INTERNAL_EVENT_NAMES) {
      expect(name).toMatch(/^[a-z]+(_[a-z]+)*$/);
    }
  });

  it("includes all expected funnel events", () => {
    const expected = [
      "page_viewed",
      "hero_cta_clicked",
      "hero_video_opened",
      "hero_video_started",
      "hero_video_completed",
      "testimonials_viewed",
      "testimonial_started",
      "testimonial_completed",
      "diagnostic_started",
      "question_viewed",
      "question_answered",
      "question_changed",
      "validation_error",
      "diagnostic_completed",
      "contact_step_viewed",
      "contact_submitted",
      "lead_created",
      "calendar_viewed",
      "time_slot_selected",
      "booking_started",
      "booking_completed",
      "booking_failed",
      "add_to_calendar_clicked",
      "confirmation_viewed",
      "session_inactive",
      "page_hidden",
      "page_exit_attempted",
    ];

    const sortedActual = [...ALL_INTERNAL_EVENT_NAMES].sort();
    const sortedExpected = [...expected].sort();
    expect(sortedActual).toEqual(sortedExpected);
  });
});

describe("MetaEvents", () => {
  it("contains exactly 2 event names", () => {
    expect(ALL_META_EVENT_NAMES.length).toBe(2);
  });

  it("has no duplicate values", () => {
    const unique = new Set(ALL_META_EVENT_NAMES);
    expect(unique.size).toBe(ALL_META_EVENT_NAMES.length);
  });

  it("uses PascalCase naming convention", () => {
    for (const name of ALL_META_EVENT_NAMES) {
      expect(name).toMatch(/^[A-Z][a-z]+$/);
    }
  });

  it("includes Contact and Schedule", () => {
    expect(ALL_META_EVENT_NAMES).toContain("Contact");
    expect(ALL_META_EVENT_NAMES).toContain("Schedule");
  });
});

describe("InternalEventPayload shape", () => {
  it("accepts a minimal valid payload via the type", () => {
    const event: InternalEventPayload = {
      event_name: "page_viewed",
      event_id: "uuid-123",
      session_id: "session-456",
      timestamp: "2026-07-23T05:00:00.000Z",
    };
    expect(event.event_name).toBe("page_viewed");
    expect(event.session_id).toBe("session-456");
  });

  it("accepts a full valid payload with all optional fields", () => {
    const event: InternalEventPayload = {
      event_name: "question_answered",
      event_id: "uuid-789",
      session_id: "session-456",
      timestamp: "2026-07-23T05:00:00.000Z",
      step_id: "pool-diagnostic",
      question_id: "water-feature",
      lead_id: "lead-001",
      duration_ms: 4500,
      page_version: "1.0.0",
      utm: {
        source: "google",
        medium: "cpc",
        campaign: "summer-2026",
      },
      metadata: { answer: "pool" },
    };
    expect(event.step_id).toBe("pool-diagnostic");
    expect(event.question_id).toBe("water-feature");
    expect(event.utm?.source).toBe("google");
    expect(event.metadata?.answer).toBe("pool");
  });

  it("rejects an invalid event_name via assignment", () => {
    const valid: InternalEventPayload = {
      event_name: "page_viewed",
      event_id: "u1",
      session_id: "s1",
      timestamp: "2026-01-01T00:00:00.000Z",
    };
    expect(valid.event_name).toBe("page_viewed");
  });
});

describe("MetaEventPayload shape", () => {
  it("accepts a valid Contact payload", () => {
    const event: MetaEventPayload = {
      event_name: "Contact",
      event_id: "uuid-123",
      event_time: 1721700000,
      event_source_url: "https://example.com/funnel",
      action_source: "website",
      user_data: {
        em: ["john@example.com"],
        ph: ["15551234567"],
        fn: "John",
        ln: "Doe",
        zp: "90210",
        external_id: "ext-001",
        client_ip_address: "192.168.1.1",
        client_user_agent:
          "Mozilla/5.0 ...",
        fbc: "fb.1.1558571054389.123456",
        fbp: "fb.1.1558571054389.123456",
      },
      custom_data: { source: "organic" },
    };
    expect(event.event_name).toBe("Contact");
    expect(event.user_data.em).toEqual(["john@example.com"]);
    expect(event.user_data.client_ip_address).toBe("192.168.1.1");
    expect(event.user_data.fbp).toBeDefined();
  });

  it("accepts a valid Schedule payload", () => {
    const event: MetaEventPayload = {
      event_name: "Schedule",
      event_id: "uuid-456",
      event_time: 1721700000,
      action_source: "server",
      user_data: {
        em: ["jane@example.com"],
        ph: ["15559876543"],
      },
    };
    expect(event.event_name).toBe("Schedule");
    expect(event.action_source).toBe("server");
  });

  it("rejects an invalid event_name via type", () => {
    const valid: MetaEventPayload = {
      event_name: "Contact",
      event_id: "u1",
      event_time: 1721700000,
      action_source: "website",
      user_data: {},
    };
    expect(valid.event_name).toBe("Contact");
  });
});

describe("CustomerInfo shape", () => {
  it("accepts a full customer info object", () => {
    const info: CustomerInfo = {
      email: "test@example.com",
      phone: "15551234567",
      first_name: "Test",
      last_name: "User",
      zip_code: "90210",
      external_id: "ext-001",
      client_ip_address: "192.168.1.1",
      client_user_agent: "Mozilla/5.0",
      fbc: "fb.1.123",
      fbp: "fb.1.456",
    };
    expect(info.email).toBe("test@example.com");
    expect(info.client_ip_address).toBe("192.168.1.1");
  });
});

describe("MetaEventPayload constraints", () => {
  it("includes all required future Meta fields", () => {
    const requiredFields = [
      "event_time",
      "event_name",
      "event_source_url",
      "action_source",
      "event_id",
    ] as const;
    const userDataFields = [
      "email",
      "phone",
      "first_name",
      "last_name",
      "zip_code",
      "external_id",
      "client_ip_address",
      "client_user_agent",
      "fbc",
      "fbp",
    ] as const;

    const payload: MetaEventPayload = {
      event_name: "Contact",
      event_id: "uuid-all-fields",
      event_time: 1721700000,
      event_source_url: "https://example.com/funnel",
      action_source: "website",
      user_data: {
        em: ["a@b.com"],
        ph: ["15551234567"],
        fn: "John",
        ln: "Doe",
        zp: "90210",
        external_id: "ext-001",
        client_ip_address: "192.168.1.1",
        client_user_agent: "Mozilla/5.0",
        fbc: "fb.1.123",
        fbp: "fb.1.456",
      },
    };

    for (const field of requiredFields) {
      expect(payload).toHaveProperty(field);
    }
    for (const field of userDataFields) {
      expect(payload.user_data).toHaveProperty(
        field === "email" ? "em" :
        field === "phone" ? "ph" :
        field === "first_name" ? "fn" :
        field === "last_name" ? "ln" :
        field === "zip_code" ? "zp" :
        field,
      );
    }
  });

  it("does not include diagnostic answer fields in the payload", () => {
    const diagKeys = [
      "water_feature",
      "installation_type",
      "pool_size",
      "current_treatment",
      "current_issues",
      "primary_goal",
    ];

    const payload: MetaEventPayload = {
      event_name: "Contact",
      event_id: "uuid-no-diag",
      event_time: 1721700000,
      action_source: "website",
      user_data: {},
    };

    const payloadKeys = new Set(Object.keys(payload));
    for (const key of diagKeys) {
      expect(payloadKeys.has(key)).toBe(false);
    }
  });

  it("shares event_id between browser and server for deduplication", () => {
    const sharedEventId = "dedup-uuid-001";
    const serverPayload: MetaEventPayload = {
      event_name: "Schedule",
      event_id: sharedEventId,
      event_time: 1721700000,
      action_source: "server",
      user_data: {},
    };
    const clientPayload: MetaEventPayload = {
      event_name: "Schedule",
      event_id: sharedEventId,
      event_time: 1721700000,
      action_source: "website",
      user_data: {},
    };
    expect(serverPayload.event_id).toBe(clientPayload.event_id);
    expect(serverPayload.action_source).toBe("server");
    expect(clientPayload.action_source).toBe("website");
  });
});
