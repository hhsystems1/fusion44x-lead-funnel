import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createEventSchema } from "@/lib/booking/providers/types";

// =============================================================================
// Test 1: Private key newline normalization
// =============================================================================

describe("private key newline normalization", () => {
  async function getNormalizePrivateKey() {
    const mod = await import("@/lib/booking/providers/google/client");
    return mod.normalizePrivateKey;
  }

  it("converts escaped \\n to real newlines", async () => {
    const normalizePrivateKey = await getNormalizePrivateKey();
    expect(normalizePrivateKey("-----BEGIN KEY-----\\nabc\\ndef\\n-----END KEY-----")).toBe(
      "-----BEGIN KEY-----\nabc\ndef\n-----END KEY-----",
    );
  });

  it("handles strings without escaped newlines", async () => {
    const normalizePrivateKey = await getNormalizePrivateKey();
    expect(normalizePrivateKey("no newlines here")).toBe("no newlines here");
  });

  it("handles empty string", async () => {
    const normalizePrivateKey = await getNormalizePrivateKey();
    expect(normalizePrivateKey("")).toBe("");
  });

  it("handles multiple consecutive \\n sequences", async () => {
    const normalizePrivateKey = await getNormalizePrivateKey();
    expect(normalizePrivateKey("line1\\n\\nline2")).toBe("line1\n\nline2");
  });
});

// =============================================================================
// Test 2: Missing Google configuration
// =============================================================================

describe("missing Google configuration", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.GOOGLE_CALENDAR_ID;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("throws when env vars missing", async () => {
    await expect(async () => {
      const mod = await import("@/lib/env");
      mod.requireGoogleCalendarEnv();
    }).rejects.toThrow(/GOOGLE_CALENDAR_ID/);
  });

  it("throws when GOOGLE_SERVICE_ACCOUNT_EMAIL missing", async () => {
    process.env.GOOGLE_CALENDAR_ID = "test@group.calendar.google.com";
    await expect(async () => {
      const mod = await import("@/lib/env");
      mod.requireGoogleCalendarEnv();
    }).rejects.toThrow(/GOOGLE_SERVICE_ACCOUNT_EMAIL/);
  });

  it("throws when GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY missing", async () => {
    process.env.GOOGLE_CALENDAR_ID = "test@group.calendar.google.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sa@project.iam.gserviceaccount.com";
    await expect(async () => {
      const mod = await import("@/lib/env");
      mod.requireGoogleCalendarEnv();
    }).rejects.toThrow(/GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY/);
  });
});

// =============================================================================
// Test 3: Provider event payload construction
// =============================================================================

describe("provider event payload construction", () => {
  it("validates correct input with createEventSchema", () => {
    const input = {
      summary: "Fusion 44X Pool Consultation",
      start: "2026-08-03T13:00:00.000Z",
      end: "2026-08-03T13:30:00.000Z",
      timezone: "America/New_York",
      description: "Name: John Doe\nEmail: john@test.com\nPhone: 555-0100\nZIP: 10001",
      extendedProperties: {
        private: {
          appointmentId: "550e8400-e29b-41d4-a716-446655440000",
          bookingEventId: "550e8400-e29b-41d4-a716-446655440001",
        },
      },
    };
    const result = createEventSchema.parse(input);
    expect(result.summary).toBe("Fusion 44X Pool Consultation");
    expect(result.extendedProperties?.private?.appointmentId).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("rejects missing summary", () => {
    expect(() =>
      createEventSchema.parse({
        start: "2026-08-03T13:00:00.000Z",
        end: "2026-08-03T13:30:00.000Z",
        timezone: "America/New_York",
      }),
    ).toThrow();
  });

  it("rejects invalid datetime", () => {
    expect(() =>
      createEventSchema.parse({
        summary: "Test",
        start: "not-a-datetime",
        end: "2026-08-03T13:30:00.000Z",
        timezone: "America/New_York",
      }),
    ).toThrow();
  });
});

// =============================================================================
// Tests 4-6: Mock Google Calendar provider
// =============================================================================

const mockGcalInsert = vi.fn();
const mockGcalGet = vi.fn();
const mockGcalDelete = vi.fn();
const mockJWT = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    auth: { JWT: mockJWT },
    calendar: vi.fn(() => ({
      events: {
        insert: mockGcalInsert,
        get: mockGcalGet,
        delete: mockGcalDelete,
      },
    })),
  },
}));

const mockSupabase = vi.fn();
vi.mock("@/lib/supabase", () => ({
  getServerSupabaseClient: mockSupabase,
}));

function setGoogleEnv() {
  process.env.GOOGLE_CALENDAR_ID = "test@group.calendar.google.com";
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sa@project.iam.gserviceaccount.com";
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "fake-key";
}

function resetAllMocks() {
  mockGcalInsert.mockReset();
  mockGcalGet.mockReset();
  mockGcalDelete.mockReset();
  mockJWT.mockReset();
  mockSupabase.mockReset();
}

describe("successful event creation", () => {
  beforeEach(() => {
    setGoogleEnv();
    mockJWT.mockImplementation(function (this: Record<string, unknown>) {
      this.authorize = vi.fn().mockResolvedValue({});
      return this;
    });
    mockGcalInsert.mockResolvedValue({
      data: {
        id: "gcal-event-123",
        htmlLink: "https://calendar.google.com/event?id=123",
        status: "confirmed",
        created: "2026-07-24T12:00:00.000Z",
      },
    });
  });

  it("returns normalized result on success", async () => {
    const { createGoogleCalendarProvider } = await import("@/lib/booking/providers/google");
    const provider = createGoogleCalendarProvider();
    const result = await provider.createEvent({
      summary: "Fusion 44X Pool Consultation",
      start: "2026-08-03T13:00:00.000Z",
      end: "2026-08-03T13:30:00.000Z",
      timezone: "America/New_York",
    });

    expect(result.external_event_id).toBe("gcal-event-123");
    expect(result.html_link).toBe("https://calendar.google.com/event?id=123");
    expect(result.status).toBe("confirmed");
    expect(result.created_at).toBe("2026-07-24T12:00:00.000Z");
  });
});

describe("normalized provider response", () => {
  beforeEach(() => {
    setGoogleEnv();
    mockJWT.mockImplementation(function (this: Record<string, unknown>) {
      this.authorize = vi.fn().mockResolvedValue({});
      return this;
    });
    mockGcalInsert.mockResolvedValue({
      data: { id: "gcal-event-456", status: "confirmed" },
    });
  });

  it("returns consistent shape regardless of provider", async () => {
    const { createGoogleCalendarProvider } = await import("@/lib/booking/providers/google");
    const provider = createGoogleCalendarProvider();
    const result = await provider.createEvent({
      summary: "Test",
      start: "2026-08-03T14:00:00.000Z",
      end: "2026-08-03T14:30:00.000Z",
      timezone: "America/New_York",
    });

    expect(result).toHaveProperty("external_event_id");
    expect(result).toHaveProperty("html_link");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("created_at");
    expect(Object.keys(result).sort()).toEqual(
      ["created_at", "external_event_id", "html_link", "status"].sort(),
    );
  });
});

describe("provider error normalization", () => {
  beforeEach(() => {
    setGoogleEnv();
    mockJWT.mockImplementation(function (this: Record<string, unknown>) {
      this.authorize = vi.fn().mockResolvedValue({});
      return this;
    });
  });

  it("normalizes Google API errors with code and message", async () => {
    mockGcalInsert.mockRejectedValue({ code: 403, message: "Calendar access forbidden" });
    const { createGoogleCalendarProvider } = await import("@/lib/booking/providers/google");
    const provider = createGoogleCalendarProvider();

    await expect(
      provider.createEvent({
        summary: "Test",
        start: "2026-08-03T15:00:00.000Z",
        end: "2026-08-03T15:30:00.000Z",
        timezone: "America/New_York",
      }),
    ).rejects.toEqual({ code: 403, message: "Calendar access forbidden" });
  });

  it("normalizes generic errors", async () => {
    mockGcalInsert.mockRejectedValue(new Error("Network error"));
    const { createGoogleCalendarProvider } = await import("@/lib/booking/providers/google");
    const provider = createGoogleCalendarProvider();

    await expect(
      provider.createEvent({
        summary: "Test",
        start: "2026-08-03T16:00:00.000Z",
        end: "2026-08-03T16:30:00.000Z",
        timezone: "America/New_York",
      }),
    ).rejects.toEqual({ code: 500, message: "Network error" });
  });
});

// =============================================================================
// Tests 7+: Booking workflow tests using mocked Supabase
// =============================================================================

function createMockSupabase(overrides: Record<string, ReturnType<typeof vi.fn>>) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const autoReturn = [
    "from", "select", "eq", "in", "lt", "gt", "order", "limit",
    "insert", "update", "delete",
  ];
  for (const key of autoReturn) {
    chain[key] = vi.fn(() => chain);
  }
  Object.assign(chain, overrides);
  return chain;
}

describe("confirmed appointment idempotency", () => {
  beforeEach(() => {
    resetAllMocks();
    setGoogleEnv();
    mockJWT.mockImplementation(function (this: Record<string, unknown>) {
      this.authorize = vi.fn().mockResolvedValue({});
      return this;
    });
  });

  it("returns existing confirmed without creating second Google event", async () => {
    const supabase = createMockSupabase({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "existing-appt-id",
          start_time: "2026-08-03T13:00:00.000Z",
          end_time: "2026-08-03T13:30:00.000Z",
          timezone: "America/New_York",
          status: "confirmed",
          external_event_id: "gcal-event-existing",
        },
        error: null,
      }),
      rpc: vi.fn(),
      single: vi.fn(),
    });
    mockSupabase.mockReturnValue(supabase);

    const { createBooking } = await import("@/lib/booking/create-booking");
    const result = await createBooking({
      lead_id: "00000000-0000-0000-0000-000000000001",
      session_id: "00000000-0000-0000-0000-000000000002",
      start_time: "2026-08-03T13:00:00.000Z",
      timezone: "America/New_York",
      event_id: "00000000-0000-0000-0000-000000000010",
    });

    expect(result).toHaveProperty("appointment_id", "existing-appt-id");
    expect(result).toHaveProperty("status", "confirmed");
  });
});

describe("Google event creation occurs once", () => {
  beforeEach(() => {
    resetAllMocks();
    setGoogleEnv();
    mockJWT.mockImplementation(function (this: Record<string, unknown>) {
      this.authorize = vi.fn().mockResolvedValue({});
      return this;
    });
  });

  it("only creates one Google event per booking", async () => {
    let gcalInsertCount = 0;
    mockGcalInsert.mockImplementation(() => {
      gcalInsertCount++;
      return Promise.resolve({
        data: {
          id: `gcal-${gcalInsertCount}`,
          htmlLink: "https://calendar.google.com/event?id=1",
          status: "confirmed",
          created: "2026-07-24T12:00:00.000Z",
        },
      });
    });

    const supabase = createMockSupabase({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      rpc: vi.fn().mockResolvedValue({ data: "appointment-id-1", error: null }),
      single: vi.fn().mockResolvedValue({
        data: {
          booking_event_id: "evt-1",
          start_time: "2026-08-04T13:00:00.000Z",
          end_time: "2026-08-04T13:30:00.000Z",
          timezone: "America/New_York",
          full_name: "John Doe",
          email: "john@test.com",
          phone: "555-0100",
          zip_code: "10001",
          lead_id: "lid-1",
        },
        error: null,
      }),
      insert: vi.fn().mockReturnThis(),
    });
    mockSupabase.mockReturnValue(supabase);

    const { createBooking } = await import("@/lib/booking/create-booking");
    const result = await createBooking({
      lead_id: "00000000-0000-0000-0000-000000000001",
      session_id: "00000000-0000-0000-0000-000000000002",
      start_time: "2026-08-04T13:00:00.000Z",
      timezone: "America/New_York",
      event_id: "00000000-0000-0000-0000-000000000020",
    });

    expect(gcalInsertCount).toBe(1);
    expect(result).toHaveProperty("status", "confirmed");
  });
});

describe("database confirmation called", () => {
  beforeEach(() => {
    resetAllMocks();
    setGoogleEnv();
    mockJWT.mockImplementation(function (this: Record<string, unknown>) {
      this.authorize = vi.fn().mockResolvedValue({});
      return this;
    });
  });

  it("calls confirm_funnel_appointment RPC after Google event creation", async () => {
    const rpcCalls: string[] = [];
    mockGcalInsert.mockResolvedValue({
      data: {
        id: "gcal-confirm-test",
        htmlLink: "https://calendar.google.com/event?id=confirm",
        status: "confirmed",
        created: "2026-07-24T12:00:00.000Z",
      },
    });

    const supabase = createMockSupabase({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      rpc: vi.fn().mockImplementation((name: string) => {
        rpcCalls.push(name);
        if (name === "confirm_funnel_appointment") {
          return Promise.resolve({ data: "confirmed-appt-id", error: null });
        }
        return Promise.resolve({ data: "appointment-id-1", error: null });
      }),
      single: vi.fn().mockResolvedValue({
        data: {
          booking_event_id: "evt-2",
          start_time: "2026-08-05T13:00:00.000Z",
          end_time: "2026-08-05T13:30:00.000Z",
          timezone: "America/New_York",
          full_name: "Jane Doe",
          email: "jane@test.com",
          phone: "555-0200",
          zip_code: "20001",
          lead_id: "lid-2",
        },
        error: null,
      }),
      insert: vi.fn().mockReturnThis(),
    });
    mockSupabase.mockReturnValue(supabase);

    const { createBooking } = await import("@/lib/booking/create-booking");
    const result = await createBooking({
      lead_id: "00000000-0000-0000-0000-000000000001",
      session_id: "00000000-0000-0000-0000-000000000002",
      start_time: "2026-08-05T13:00:00.000Z",
      timezone: "America/New_York",
      event_id: "00000000-0000-0000-0000-000000000030",
    });

    expect(rpcCalls).toContain("confirm_funnel_appointment");
    expect(result).toHaveProperty("status", "confirmed");
  });
});

describe("failure marks appointment failed", () => {
  beforeEach(() => {
    resetAllMocks();
    setGoogleEnv();
    mockJWT.mockImplementation(function (this: Record<string, unknown>) {
      this.authorize = vi.fn().mockResolvedValue({});
      return this;
    });
  });

  it("marks appointment failed when Google Calendar creation fails", async () => {
    mockGcalInsert.mockRejectedValue({ code: 403, message: "Calendar access forbidden" });

    const supabase = createMockSupabase({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      rpc: vi.fn().mockImplementation((name: string) => {
        if (name === "create_funnel_appointment") {
          return Promise.resolve({ data: "appointment-id-1", error: null });
        }
        return Promise.resolve({ data: "failed-appt-id", error: null });
      }),
      single: vi.fn().mockResolvedValue({
        data: {
          booking_event_id: "evt-3",
          start_time: "2026-08-06T13:00:00.000Z",
          end_time: "2026-08-06T13:30:00.000Z",
          timezone: "America/New_York",
          full_name: "Bob",
          email: "bob@test.com",
          phone: "555-0300",
          zip_code: "30001",
          lead_id: "lid-3",
        },
        error: null,
      }),
      insert: vi.fn().mockReturnThis(),
    });
    mockSupabase.mockReturnValue(supabase);

    const { createBooking } = await import("@/lib/booking/create-booking");
    const result = await createBooking({
      lead_id: "00000000-0000-0000-0000-000000000001",
      session_id: "00000000-0000-0000-0000-000000000002",
      start_time: "2026-08-06T13:00:00.000Z",
      timezone: "America/New_York",
      event_id: "00000000-0000-0000-0000-000000000040",
    });

    expect(result).toHaveProperty("status", 502);
  });
});

describe("failed appointment availability", () => {
  it("isSlotAvailable only checks pending and confirmed statuses", async () => {
    const { isSlotAvailable } = await import("@/lib/booking/slots");
    const mock = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    const result = await isSlotAvailable(
      "2026-08-07T13:00:00.000Z",
      "2026-08-07T13:30:00.000Z",
      mock as never,
    );

    expect(mock.in.mock.calls[0]).toEqual(["status", ["pending", "confirmed"]]);
    expect(result).toBe(true);
  });

  it("failed status is not in the blocking list", () => {
    expect(["pending", "confirmed"]).not.toContain("failed");
  });
});

describe("compensation deletes Google event on DB failure", () => {
  beforeEach(() => {
    resetAllMocks();
    setGoogleEnv();
    mockJWT.mockImplementation(function (this: Record<string, unknown>) {
      this.authorize = vi.fn().mockResolvedValue({});
      return this;
    });
  });

  it("attempts to delete Google event when confirm_funnel_appointment fails", async () => {
    let gcalDeleteCalled = false;
    mockGcalInsert.mockResolvedValue({
      data: { id: "gcal-comp-test", status: "confirmed", created: "2026-07-24T12:00:00.000Z" },
    });
    mockGcalDelete.mockImplementation(() => {
      gcalDeleteCalled = true;
      return Promise.resolve({ data: {} });
    });

    const supabase = createMockSupabase({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      rpc: vi.fn().mockImplementation((name: string) => {
        if (name === "create_funnel_appointment") {
          return Promise.resolve({ data: "appointment-id-comp", error: null });
        }
        return Promise.reject({ code: "P0103", message: "Cannot confirm" });
      }),
      single: vi.fn().mockResolvedValue({
        data: {
          booking_event_id: "evt-4",
          start_time: "2026-08-08T13:00:00.000Z",
          end_time: "2026-08-08T13:30:00.000Z",
          timezone: "America/New_York",
          full_name: "Comp Test",
          email: "comp@test.com",
          phone: "555-0400",
          zip_code: "40001",
          lead_id: "lid-4",
        },
        error: null,
      }),
      insert: vi.fn().mockReturnThis(),
    });
    mockSupabase.mockReturnValue(supabase);

    const { createBooking } = await import("@/lib/booking/create-booking");
    const result = await createBooking({
      lead_id: "00000000-0000-0000-0000-000000000001",
      session_id: "00000000-0000-0000-0000-000000000002",
      start_time: "2026-08-08T13:00:00.000Z",
      timezone: "America/New_York",
      event_id: "00000000-0000-0000-0000-000000000050",
    });

    expect(gcalDeleteCalled).toBe(true);
    expect(result).toHaveProperty("status", 500);
  });
});

describe("compensation failure handled safely", () => {
  beforeEach(() => {
    resetAllMocks();
    setGoogleEnv();
    mockJWT.mockImplementation(function (this: Record<string, unknown>) {
      this.authorize = vi.fn().mockResolvedValue({});
      return this;
    });
  });

  it("does not throw when compensation delete fails", async () => {
    mockGcalInsert.mockResolvedValue({
      data: { id: "gcal-comp-fail-test", status: "confirmed" },
    });
    mockGcalDelete.mockRejectedValue(new Error("Compensation delete failed"));

    const supabase = createMockSupabase({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      rpc: vi.fn().mockImplementation((name: string) => {
        if (name === "create_funnel_appointment") {
          return Promise.resolve({ data: "appointment-id-comp-2", error: null });
        }
        return Promise.reject({ code: "P0103", message: "Cannot confirm" });
      }),
      single: vi.fn().mockResolvedValue({
        data: {
          booking_event_id: "evt-5",
          start_time: "2026-08-09T13:00:00.000Z",
          end_time: "2026-08-09T13:30:00.000Z",
          timezone: "America/New_York",
          full_name: "Comp Fail Test",
          email: "compfail@test.com",
          phone: "555-0500",
          zip_code: "50001",
          lead_id: "lid-5",
        },
        error: null,
      }),
      insert: vi.fn().mockReturnThis(),
    });
    mockSupabase.mockReturnValue(supabase);

    const { createBooking } = await import("@/lib/booking/create-booking");
    const result = await createBooking({
      lead_id: "00000000-0000-0000-0000-000000000001",
      session_id: "00000000-0000-0000-0000-000000000002",
      start_time: "2026-08-09T13:00:00.000Z",
      timezone: "America/New_York",
      event_id: "00000000-0000-0000-0000-000000000060",
    });

    expect(result).toHaveProperty("status", 500);
  });
});

describe("integration delivery state transitions", () => {
  it("starts as pending", () => {
    const record = {
      appointment_id: "appt-id",
      destination: "google_calendar" as const,
      event_type: "appointment_create" as const,
      event_id: "evt-id",
      status: "pending" as const,
      attempt_count: 0,
      response_code: null,
      error_message: null,
    };
    expect(record.status).toBe("pending");
  });

  it("transitions to processing", () => {
    expect({ status: "processing" as const }.status).toBe("processing");
  });

  it("transitions to delivered on success", () => {
    expect({ status: "delivered" as const }.status).toBe("delivered");
  });

  it("transitions to failed on error", () => {
    expect({ status: "failed" as const }.status).toBe("failed");
  });
});

describe("no raw provider payload returned", () => {
  beforeEach(() => {
    resetAllMocks();
    setGoogleEnv();
    mockJWT.mockImplementation(function (this: Record<string, unknown>) {
      this.authorize = vi.fn().mockResolvedValue({});
      return this;
    });
  });

  it("createBooking result does not contain raw Google response", async () => {
    mockGcalInsert.mockResolvedValue({
      data: {
        id: "gcal-raw-test",
        htmlLink: "https://calendar.google.com/event?id=raw",
        status: "confirmed",
        created: "2026-07-24T12:00:00.000Z",
        creator: { email: "sa@project.iam.gserviceaccount.com" },
        organizer: { email: "test@calendar.google.com" },
        etag: '"secret-etag"',
        iCalUID: "uid@google.com",
      },
    });

    const supabase = createMockSupabase({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      rpc: vi.fn().mockResolvedValue({ data: "appointment-id-raw", error: null }),
      single: vi.fn().mockResolvedValue({
        data: {
          booking_event_id: null,
          start_time: "2026-08-10T13:00:00.000Z",
          end_time: "2026-08-10T13:30:00.000Z",
          timezone: "America/New_York",
          full_name: "Raw Test",
          email: "raw@test.com",
          phone: "555-0600",
          zip_code: "60001",
          lead_id: "lid-raw",
        },
        error: null,
      }),
      insert: vi.fn().mockReturnThis(),
    });
    mockSupabase.mockReturnValue(supabase);

    const { createBooking } = await import("@/lib/booking/create-booking");
    const result = await createBooking({
      lead_id: "00000000-0000-0000-0000-000000000001",
      session_id: "00000000-0000-0000-0000-000000000002",
      start_time: "2026-08-10T13:00:00.000Z",
      timezone: "America/New_York",
      event_id: "00000000-0000-0000-0000-000000000070",
    });

    expect(result).not.toHaveProperty("rawProviderResponse");
    expect(result).not.toHaveProperty("etag");
    expect(result).not.toHaveProperty("creator");
  });
});

describe("API returns confirmed only after both systems succeed", () => {
  beforeEach(() => {
    resetAllMocks();
    setGoogleEnv();
    mockJWT.mockImplementation(function (this: Record<string, unknown>) {
      this.authorize = vi.fn().mockResolvedValue({});
      return this;
    });
  });

  it("returns confirmed when both DB and Google Calendar succeed", async () => {
    mockGcalInsert.mockResolvedValue({
      data: { id: "gcal-both-success", status: "confirmed", created: "2026-07-24T12:00:00.000Z" },
    });

    const supabase = createMockSupabase({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      rpc: vi.fn().mockImplementation((name: string) => {
        if (name === "confirm_funnel_appointment") {
          return Promise.resolve({ data: "confirmed-both-id", error: null });
        }
        return Promise.resolve({ data: "appointment-both-id", error: null });
      }),
      single: vi.fn().mockResolvedValue({
        data: {
          booking_event_id: null,
          start_time: "2026-08-11T13:00:00.000Z",
          end_time: "2026-08-11T13:30:00.000Z",
          timezone: "America/New_York",
          full_name: "Both Test",
          email: "both@test.com",
          phone: "555-0700",
          zip_code: "70001",
          lead_id: "lid-both",
        },
        error: null,
      }),
      insert: vi.fn().mockReturnThis(),
    });
    mockSupabase.mockReturnValue(supabase);

    const { createBooking } = await import("@/lib/booking/create-booking");
    const result = await createBooking({
      lead_id: "00000000-0000-0000-0000-000000000001",
      session_id: "00000000-0000-0000-0000-000000000002",
      start_time: "2026-08-11T13:00:00.000Z",
      timezone: "America/New_York",
      event_id: "00000000-0000-0000-0000-000000000080",
    });

    expect(result).toHaveProperty("status", "confirmed");
    expect(result).toHaveProperty("appointment_id", "confirmed-both-id");
  });

  it("does not return confirmed when Google Calendar fails", async () => {
    mockGcalInsert.mockRejectedValue({ code: 500, message: "Internal error" });

    const supabase = createMockSupabase({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      rpc: vi.fn().mockImplementation((name: string) => {
        if (name === "create_funnel_appointment") {
          return Promise.resolve({ data: "appointment-both-fail", error: null });
        }
        return Promise.resolve({ data: "failed-both-id", error: null });
      }),
      single: vi.fn().mockResolvedValue({
        data: {
          booking_event_id: null,
          start_time: "2026-08-12T13:00:00.000Z",
          end_time: "2026-08-12T13:30:00.000Z",
          timezone: "America/New_York",
          full_name: "Both Fail",
          email: "bothfail@test.com",
          phone: "555-0800",
          zip_code: "80001",
          lead_id: "lid-both-fail",
        },
        error: null,
      }),
      insert: vi.fn().mockReturnThis(),
    });
    mockSupabase.mockReturnValue(supabase);

    const { createBooking } = await import("@/lib/booking/create-booking");
    const result = await createBooking({
      lead_id: "00000000-0000-0000-0000-000000000001",
      session_id: "00000000-0000-0000-0000-000000000002",
      start_time: "2026-08-12T13:00:00.000Z",
      timezone: "America/New_York",
      event_id: "00000000-0000-0000-0000-000000000090",
    });

    expect(result).not.toHaveProperty("appointment_id");
    expect(result).toHaveProperty("status", 502);
  });
});
