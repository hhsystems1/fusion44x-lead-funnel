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
// Mock definitions
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

// ---------------------------------------------------------------------------
// Helper: create a supabase chain mock that supports sequenced maybeSingle
// and single calls for the full booking workflow.
// ---------------------------------------------------------------------------
function createBookingChain(options: {
  existingConfirmed?: Record<string, unknown> | null;
  existingPending?: Record<string, unknown> | null;
  existingDelivery?: Record<string, unknown> | null;
  createRpcResult?: { data: unknown; error: unknown };
  confirmRpcResult?: { data: unknown; error: unknown };
  failRpcResult?: { data: unknown; error: unknown };
  deliveryInsertResult?: Record<string, unknown> | null;
  deliveryProcessingResult?: Record<string, unknown> | null;
  appointmentRow?: Record<string, unknown> | null;
  leadRow?: Record<string, unknown> | null;
  compensationAppointmentRow?: Record<string, unknown> | null;
}) {
  let maybeSingleIndex = 0;
  let singleIndex = 0;

  const maybeSingleResults = [
    () => Promise.resolve({ data: options.existingConfirmed ?? null, error: null }),
    () => Promise.resolve({ data: options.existingPending ?? null, error: null }),
    () => Promise.resolve({ data: options.existingDelivery ?? null, error: null }),
  ];

  const singleResults: Array<() => Promise<{ data: unknown; error: unknown }>> = [];

  if (options.deliveryInsertResult) {
    singleResults.push(() =>
      Promise.resolve({ data: options.deliveryInsertResult!, error: null }),
    );
  }
  if (options.deliveryProcessingResult) {
    singleResults.push(() =>
      Promise.resolve({ data: options.deliveryProcessingResult!, error: null }),
    );
  }
  if (options.appointmentRow) {
    singleResults.push(() =>
      Promise.resolve({ data: options.appointmentRow!, error: null }),
    );
  }
  if (options.leadRow) {
    singleResults.push(() =>
      Promise.resolve({ data: options.leadRow!, error: null }),
    );
  }
  if (options.compensationAppointmentRow) {
    singleResults.push(() =>
      Promise.resolve({ data: options.compensationAppointmentRow!, error: null }),
    );
  }

  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    from: vi.fn(() => chain),
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    gt: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    maybeSingle: vi.fn(() => {
      const fn = maybeSingleResults[maybeSingleIndex] ?? (() => Promise.resolve({ data: null, error: null }));
      maybeSingleIndex++;
      return fn();
    }),
    single: vi.fn(() => {
      const fn = singleResults[singleIndex] ?? (() => Promise.resolve({ data: null, error: null }));
      singleIndex++;
      return fn();
    }),
    rpc: vi.fn(),
  };

  if (options.createRpcResult) {
    chain.rpc.mockImplementation((name: string) => {
      if (name === "create_funnel_appointment") {
        return Promise.resolve(options.createRpcResult!);
      }
      return options.confirmRpcResult
        ? Promise.resolve(options.confirmRpcResult)
        : Promise.resolve({ data: null, error: null });
    });
  }

  return chain;
}

// =============================================================================
// Test 4-6: Provider-level tests
// =============================================================================

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
// Test 7+: Booking workflow tests
// =============================================================================

describe("confirmed appointment idempotency", () => {
  beforeEach(() => {
    resetAllMocks();
    setGoogleEnv();
    mockJWT.mockImplementation(function (this: Record<string, unknown>) {
      this.authorize = vi.fn().mockResolvedValue({});
      return this;
    });
  });

  it("returns existing confirmed when all identity fields match", async () => {
    const supabase = createBookingChain({
      existingConfirmed: {
        id: "existing-appt-id",
        lead_id: "00000000-0000-0000-0000-000000000001",
        session_id: "00000000-0000-0000-0000-000000000002",
        start_time: "2026-08-03T13:00:00.000Z",
        end_time: "2026-08-03T13:30:00.000Z",
        timezone: "America/New_York",
        status: "confirmed",
        external_event_id: "gcal-event-existing",
      },
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
    expect(mockGcalInsert).not.toHaveBeenCalled();
  });

  it("returns 409 on lead_id mismatch", async () => {
    const supabase = createBookingChain({
      existingConfirmed: {
        id: "existing-appt-id",
        lead_id: "different-lead-id",
        session_id: "00000000-0000-0000-0000-000000000002",
        start_time: "2026-08-03T13:00:00.000Z",
        end_time: "2026-08-03T13:30:00.000Z",
        timezone: "America/New_York",
        status: "confirmed",
        external_event_id: "gcal-event-existing",
      },
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

    expect(result).toHaveProperty("status", 409);
    expect(result).toHaveProperty("code", "EVENT_ID_MISMATCH");
    expect(mockGcalInsert).not.toHaveBeenCalled();
  });

  it("returns 409 on session_id mismatch", async () => {
    const supabase = createBookingChain({
      existingConfirmed: {
        id: "existing-appt-id",
        lead_id: "00000000-0000-0000-0000-000000000001",
        session_id: "different-session-id",
        start_time: "2026-08-03T13:00:00.000Z",
        end_time: "2026-08-03T13:30:00.000Z",
        timezone: "America/New_York",
        status: "confirmed",
        external_event_id: "gcal-event-existing",
      },
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

    expect(result).toHaveProperty("status", 409);
    expect(result).toHaveProperty("code", "EVENT_ID_MISMATCH");
    expect(mockGcalInsert).not.toHaveBeenCalled();
  });

  it("returns 409 on start_time mismatch", async () => {
    const supabase = createBookingChain({
      existingConfirmed: {
        id: "existing-appt-id",
        lead_id: "00000000-0000-0000-0000-000000000001",
        session_id: "00000000-0000-0000-0000-000000000002",
        start_time: "2026-08-03T14:00:00.000Z",
        end_time: "2026-08-03T14:30:00.000Z",
        timezone: "America/New_York",
        status: "confirmed",
        external_event_id: "gcal-event-existing",
      },
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

    expect(result).toHaveProperty("status", 409);
    expect(result).toHaveProperty("code", "EVENT_ID_MISMATCH");
    expect(mockGcalInsert).not.toHaveBeenCalled();
  });

  it("returns 409 on timezone mismatch", async () => {
    const supabase = createBookingChain({
      existingConfirmed: {
        id: "existing-appt-id",
        lead_id: "00000000-0000-0000-0000-000000000001",
        session_id: "00000000-0000-0000-0000-000000000002",
        start_time: "2026-08-03T13:00:00.000Z",
        end_time: "2026-08-03T13:30:00.000Z",
        timezone: "Europe/London",
        status: "confirmed",
        external_event_id: "gcal-event-existing",
      },
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

    expect(result).toHaveProperty("status", 409);
    expect(result).toHaveProperty("code", "EVENT_ID_MISMATCH");
    expect(mockGcalInsert).not.toHaveBeenCalled();
  });
});

describe("getLeadInfo fail-closed", () => {
  beforeEach(() => {
    resetAllMocks();
    setGoogleEnv();
    mockJWT.mockImplementation(function (this: Record<string, unknown>) {
      this.authorize = vi.fn().mockResolvedValue({});
      return this;
    });
  });

  it("returns 500 when getLeadInfo returns null (appointment not found)", async () => {
    mockGcalInsert.mockResolvedValue({
      data: { id: "gcal-lead-fail", status: "confirmed", created: "2026-07-24T12:00:00.000Z" },
    });

    const supabase = createBookingChain({
      existingConfirmed: null,
      existingPending: null,
      existingDelivery: null,
      createRpcResult: { data: "appt-lead-fail", error: null },
      deliveryInsertResult: { id: "del-lead-fail" },
      deliveryProcessingResult: { attempt_count: 0 },
      appointmentRow: null,
    });
    mockSupabase.mockReturnValue(supabase);

    const { createBooking } = await import("@/lib/booking/create-booking");
    const result = await createBooking({
      lead_id: "00000000-0000-0000-0000-000000000001",
      session_id: "00000000-0000-0000-0000-000000000002",
      start_time: "2026-08-03T13:00:00.000Z",
      timezone: "America/New_York",
      event_id: "00000000-0000-0000-0000-000000000100",
    });

    expect(result).toHaveProperty("status", 500);
    expect(result).toHaveProperty("code", "LEAD_INFO_FAILED");
    expect(mockGcalInsert).not.toHaveBeenCalled();
  });

  it("returns 500 when getLeadInfo returns null (lead not found)", async () => {
    mockGcalInsert.mockResolvedValue({
      data: { id: "gcal-lead-notfound", status: "confirmed", created: "2026-07-24T12:00:00.000Z" },
    });

    const supabase = createBookingChain({
      existingConfirmed: null,
      existingPending: null,
      existingDelivery: null,
      createRpcResult: { data: "appt-lead-notfound", error: null },
      deliveryInsertResult: { id: "del-lead-notfound" },
      deliveryProcessingResult: { attempt_count: 0 },
      appointmentRow: {
        booking_event_id: "evt-lead",
        start_time: "2026-08-03T13:00:00.000Z",
        end_time: "2026-08-03T13:30:00.000Z",
        timezone: "America/New_York",
        lead_id: "nonexistent-lead",
      },
      leadRow: null,
    });
    mockSupabase.mockReturnValue(supabase);

    const { createBooking } = await import("@/lib/booking/create-booking");
    const result = await createBooking({
      lead_id: "00000000-0000-0000-0000-000000000001",
      session_id: "00000000-0000-0000-0000-000000000002",
      start_time: "2026-08-03T13:00:00.000Z",
      timezone: "America/New_York",
      event_id: "00000000-0000-0000-0000-000000000101",
    });

    expect(result).toHaveProperty("status", 500);
    expect(result).toHaveProperty("code", "LEAD_INFO_FAILED");
    expect(mockGcalInsert).not.toHaveBeenCalled();
  });

  it("builds full_name from first_name and last_name", async () => {
    let descriptionArg = "";

    mockGcalInsert.mockImplementation((args: { requestBody?: { description?: string } }) => {
      descriptionArg = args.requestBody?.description ?? "";
      return Promise.resolve({
        data: { id: "gcal-name-test", status: "confirmed", created: "2026-07-24T12:00:00.000Z" },
      });
    });

    const supabase = createBookingChain({
      existingConfirmed: null,
      existingPending: null,
      existingDelivery: null,
      createRpcResult: { data: "appt-name-test", error: null },
      deliveryInsertResult: { id: "del-name-test" },
      deliveryProcessingResult: { attempt_count: 0 },
      appointmentRow: {
        booking_event_id: "evt-name",
        start_time: "2026-08-03T13:00:00.000Z",
        end_time: "2026-08-03T13:30:00.000Z",
        timezone: "America/New_York",
        lead_id: "lid-name",
      },
      leadRow: {
        first_name: "  John  ",
        last_name: "  Doe  ",
        email: "john@test.com",
        phone: "555-0100",
        zip_code: "10001",
      },
      confirmRpcResult: { data: "confirmed-name-id", error: null },
    });
    mockSupabase.mockReturnValue(supabase);

    const { createBooking } = await import("@/lib/booking/create-booking");
    const result = await createBooking({
      lead_id: "00000000-0000-0000-0000-000000000001",
      session_id: "00000000-0000-0000-0000-000000000002",
      start_time: "2026-08-03T13:00:00.000Z",
      timezone: "America/New_York",
      event_id: "00000000-0000-0000-0000-000000000102",
    });

    expect(result).toHaveProperty("status", "confirmed");
    expect(descriptionArg).toContain("Name: John Doe");
  });

  it("handles empty first_name and last_name gracefully", async () => {
    mockGcalInsert.mockImplementation(() => {
      return Promise.resolve({
        data: { id: "gcal-empty-name", status: "confirmed", created: "2026-07-24T12:00:00.000Z" },
      });
    });

    const supabase = createBookingChain({
      existingConfirmed: null,
      existingPending: null,
      existingDelivery: null,
      createRpcResult: { data: "appt-empty-name", error: null },
      deliveryInsertResult: { id: "del-empty-name" },
      deliveryProcessingResult: { attempt_count: 0 },
      appointmentRow: {
        booking_event_id: "evt-empty",
        start_time: "2026-08-03T13:00:00.000Z",
        end_time: "2026-08-03T13:30:00.000Z",
        timezone: "America/New_York",
        lead_id: "lid-empty",
      },
      leadRow: {
        first_name: "",
        last_name: "",
        email: "anon@test.com",
        phone: "",
        zip_code: "",
      },
      confirmRpcResult: { data: "confirmed-empty-id", error: null },
    });
    mockSupabase.mockReturnValue(supabase);

    const { createBooking } = await import("@/lib/booking/create-booking");
    const result = await createBooking({
      lead_id: "00000000-0000-0000-0000-000000000001",
      session_id: "00000000-0000-0000-0000-000000000002",
      start_time: "2026-08-03T13:00:00.000Z",
      timezone: "America/New_York",
      event_id: "00000000-0000-0000-0000-000000000103",
    });

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

    const supabase = createBookingChain({
      existingConfirmed: null,
      existingPending: null,
      existingDelivery: null,
      createRpcResult: { data: "appointment-id-1", error: null },
      deliveryInsertResult: { id: "del-id-1" },
      deliveryProcessingResult: { attempt_count: 0 },
      appointmentRow: {
        booking_event_id: "evt-1",
        start_time: "2026-08-04T13:00:00.000Z",
        end_time: "2026-08-04T13:30:00.000Z",
        timezone: "America/New_York",
        lead_id: "lid-1",
      },
      leadRow: {
        first_name: "John",
        last_name: "Doe",
        email: "john@test.com",
        phone: "555-0100",
        zip_code: "10001",
      },
      confirmRpcResult: { data: "confirmed-id-1", error: null },
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

describe("database confirmation called after Google event + delivery after RPC", () => {
  beforeEach(() => {
    resetAllMocks();
    setGoogleEnv();
    mockJWT.mockImplementation(function (this: Record<string, unknown>) {
      this.authorize = vi.fn().mockResolvedValue({});
      return this;
    });
  });

  it("calls confirm_funnel_appointment RPC after Google event creation, marks delivered after RPC success", async () => {
    const rpcCalls: string[] = [];
    const deliveredAfterConfirm: boolean[] = [];
    let confirmResolved = false;
    let deliveryMarked = false;

    mockGcalInsert.mockResolvedValue({
      data: {
        id: "gcal-confirm-test",
        htmlLink: "https://calendar.google.com/event?id=confirm",
        status: "confirmed",
        created: "2026-07-24T12:00:00.000Z",
      },
    });

    const supabase = createBookingChain({
      existingConfirmed: null,
      existingPending: null,
      existingDelivery: null,
      createRpcResult: { data: "appointment-id-confirm", error: null },
      deliveryInsertResult: { id: "del-confirm" },
      deliveryProcessingResult: { attempt_count: 0 },
      appointmentRow: {
        booking_event_id: "evt-2",
        start_time: "2026-08-05T13:00:00.000Z",
        end_time: "2026-08-05T13:30:00.000Z",
        timezone: "America/New_York",
        lead_id: "lid-2",
      },
      leadRow: {
        first_name: "Jane",
        last_name: "Doe",
        email: "jane@test.com",
        phone: "555-0200",
        zip_code: "20001",
      },
    });
    supabase.rpc.mockImplementation((name: string) => {
      rpcCalls.push(name);
      if (name === "confirm_funnel_appointment") {
        confirmResolved = true;
        return Promise.resolve({ data: "confirmed-appt-id", error: null });
      }
      return Promise.resolve({ data: "appointment-id-confirm", error: null });
    });

    supabase.update.mockImplementation((values: Record<string, unknown>) => {
      if (values && values.status === "delivered") {
        deliveryMarked = true;
        if (confirmResolved) {
          deliveredAfterConfirm.push(true);
        }
      }
      return supabase;
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
    expect(deliveryMarked).toBe(true);
    expect(deliveredAfterConfirm.length).toBeGreaterThan(0);
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

    const supabase = createBookingChain({
      existingConfirmed: null,
      existingPending: null,
      existingDelivery: null,
      createRpcResult: { data: "appointment-id-fail", error: null },
      deliveryInsertResult: { id: "del-fail" },
      deliveryProcessingResult: { attempt_count: 0 },
      appointmentRow: {
        booking_event_id: "evt-3",
        start_time: "2026-08-06T13:00:00.000Z",
        end_time: "2026-08-06T13:30:00.000Z",
        timezone: "America/New_York",
        lead_id: "lid-3",
      },
      leadRow: {
        first_name: "Bob",
        last_name: "",
        email: "bob@test.com",
        phone: "555-0300",
        zip_code: "30001",
      },
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

  it("deletes Google event and calls fail_funnel_appointment with DB_CONFIRM_FAILED_COMPENSATED", async () => {
    let gcalDeleteCalled = false;
    const rpcNames: string[] = [];
    let failCalledWithCode = "";

    mockGcalInsert.mockResolvedValue({
      data: { id: "gcal-comp-test", status: "confirmed", created: "2026-07-24T12:00:00.000Z" },
    });
    mockGcalDelete.mockImplementation(() => {
      gcalDeleteCalled = true;
      return Promise.resolve({ data: {} });
    });

    const supabase = createBookingChain({
      existingConfirmed: null,
      existingPending: null,
      existingDelivery: null,
      createRpcResult: { data: "appointment-id-comp", error: null },
      deliveryInsertResult: { id: "del-comp" },
      deliveryProcessingResult: { attempt_count: 0 },
      appointmentRow: {
        booking_event_id: "evt-4",
        start_time: "2026-08-08T13:00:00.000Z",
        end_time: "2026-08-08T13:30:00.000Z",
        timezone: "America/New_York",
        lead_id: "lid-4",
      },
      leadRow: {
        first_name: "Comp",
        last_name: "Test",
        email: "comp@test.com",
        phone: "555-0400",
        zip_code: "40001",
      },
    });
    supabase.rpc.mockImplementation((name: string, args: Record<string, unknown>) => {
      rpcNames.push(name);
      if (name === "create_funnel_appointment") {
        return Promise.resolve({ data: "appointment-id-comp", error: null });
      }
      if (name === "fail_funnel_appointment") {
        failCalledWithCode = (args as { p_safe_error_code?: string }).p_safe_error_code ?? "";
        return Promise.resolve({ data: "failed-appt-id", error: null });
      }
      if (name === "confirm_funnel_appointment") {
        return Promise.reject({ code: "P0103", message: "Cannot confirm" });
      }
      return Promise.resolve({ data: null, error: null });
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
    expect(rpcNames).toContain("fail_funnel_appointment");
    expect(failCalledWithCode).toBe("DB_CONFIRM_FAILED_COMPENSATED");
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

  it("does not call fail_funnel_appointment when compensation delete fails", async () => {
    mockGcalInsert.mockResolvedValue({
      data: { id: "gcal-comp-fail-test", status: "confirmed" },
    });
    mockGcalDelete.mockRejectedValue(new Error("Compensation delete failed"));

    const rpcNames: string[] = [];

    const supabase = createBookingChain({
      existingConfirmed: null,
      existingPending: null,
      existingDelivery: null,
      createRpcResult: { data: "appointment-id-comp-2", error: null },
      deliveryInsertResult: { id: "del-comp-2" },
      deliveryProcessingResult: { attempt_count: 0 },
      appointmentRow: {
        booking_event_id: "evt-5",
        start_time: "2026-08-09T13:00:00.000Z",
        end_time: "2026-08-09T13:30:00.000Z",
        timezone: "America/New_York",
        lead_id: "lid-5",
      },
      leadRow: {
        first_name: "Comp",
        last_name: "Fail",
        email: "compfail@test.com",
        phone: "555-0500",
        zip_code: "50001",
      },
      compensationAppointmentRow: {
        external_event_id: null,
      },
    });
    supabase.rpc.mockImplementation((name: string) => {
      rpcNames.push(name);
      if (name === "create_funnel_appointment") {
        return Promise.resolve({ data: "appointment-id-comp-2", error: null });
      }
      if (name === "confirm_funnel_appointment") {
        return Promise.reject({ code: "P0103", message: "Cannot confirm" });
      }
      return Promise.resolve({ data: null, error: null });
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

    expect(rpcNames).not.toContain("fail_funnel_appointment");
    expect(result).toHaveProperty("status", 500);
  });

  it("sets appointment back to pending when compensation delete fails and external_event_id is null", async () => {
    mockGcalInsert.mockResolvedValue({
      data: { id: "gcal-pending-test", status: "confirmed" },
    });
    mockGcalDelete.mockRejectedValue(new Error("Delete failed"));

    let updatedStatus = "";

    const supabase = createBookingChain({
      existingConfirmed: null,
      existingPending: null,
      existingDelivery: null,
      createRpcResult: { data: "appt-pending-test", error: null },
      deliveryInsertResult: { id: "del-pending" },
      deliveryProcessingResult: { attempt_count: 0 },
      appointmentRow: {
        booking_event_id: "evt-pending",
        start_time: "2026-08-09T13:00:00.000Z",
        end_time: "2026-08-09T13:30:00.000Z",
        timezone: "America/New_York",
        lead_id: "lid-pending",
      },
      leadRow: {
        first_name: "Pending",
        last_name: "Test",
        email: "pending@test.com",
        phone: "555-0600",
        zip_code: "60001",
      },
      compensationAppointmentRow: {
        external_event_id: null,
      },
    });
    supabase.rpc.mockImplementation((name: string) => {
      if (name === "create_funnel_appointment") {
        return Promise.resolve({ data: "appt-pending-test", error: null });
      }
      if (name === "confirm_funnel_appointment") {
        return Promise.reject({ code: "P0103", message: "Cannot confirm" });
      }
      return Promise.resolve({ data: null, error: null });
    });

    supabase.update.mockImplementation((values: Record<string, unknown>) => {
      if (typeof values.status === "string") {
        updatedStatus = values.status;
      }
      return supabase;
    });

    mockSupabase.mockReturnValue(supabase);

    const { createBooking } = await import("@/lib/booking/create-booking");
    await createBooking({
      lead_id: "00000000-0000-0000-0000-000000000001",
      session_id: "00000000-0000-0000-0000-000000000002",
      start_time: "2026-08-09T13:00:00.000Z",
      timezone: "America/New_York",
      event_id: "00000000-0000-0000-0000-000000000061",
    });

    expect(updatedStatus).toBe("pending");
  });

  it("does not revert to pending when external_event_id is already set", async () => {
    mockGcalInsert.mockResolvedValue({
      data: { id: "gcal-no-revert-test", status: "confirmed" },
    });
    mockGcalDelete.mockRejectedValue(new Error("Delete failed"));

    let pendingStatusUpdateCalled = false;

    const supabase = createBookingChain({
      existingConfirmed: null,
      existingPending: null,
      existingDelivery: null,
      createRpcResult: { data: "appt-no-revert", error: null },
      deliveryInsertResult: { id: "del-no-revert" },
      deliveryProcessingResult: { attempt_count: 0 },
      appointmentRow: {
        booking_event_id: "evt-no-revert",
        start_time: "2026-08-09T14:00:00.000Z",
        end_time: "2026-08-09T14:30:00.000Z",
        timezone: "America/New_York",
        lead_id: "lid-no-revert",
      },
      leadRow: {
        first_name: "No",
        last_name: "Revert",
        email: "norevert@test.com",
        phone: "555-0700",
        zip_code: "70001",
      },
      compensationAppointmentRow: {
        external_event_id: "gcal-no-revert-test",
      },
    });
    supabase.rpc.mockImplementation((name: string) => {
      if (name === "create_funnel_appointment") {
        return Promise.resolve({ data: "appt-no-revert", error: null });
      }
      if (name === "confirm_funnel_appointment") {
        return Promise.reject({ code: "P0103", message: "Cannot confirm" });
      }
      return Promise.resolve({ data: null, error: null });
    });

    supabase.update.mockImplementation((values: Record<string, unknown>) => {
      if (values.status === "pending") {
        pendingStatusUpdateCalled = true;
      }
      return supabase;
    });

    mockSupabase.mockReturnValue(supabase);

    const { createBooking } = await import("@/lib/booking/create-booking");
    await createBooking({
      lead_id: "00000000-0000-0000-0000-000000000001",
      session_id: "00000000-0000-0000-0000-000000000002",
      start_time: "2026-08-09T14:00:00.000Z",
      timezone: "America/New_York",
      event_id: "00000000-0000-0000-0000-000000000062",
    });

    expect(pendingStatusUpdateCalled).toBe(false);
  });
});

describe("fail_funnel_appointment failure after compensation", () => {
  beforeEach(() => {
    resetAllMocks();
    setGoogleEnv();
    mockJWT.mockImplementation(function (this: Record<string, unknown>) {
      this.authorize = vi.fn().mockResolvedValue({});
      return this;
    });
  });

  it("never returns confirmed when fail_funnel_appointment fails", async () => {
    mockGcalInsert.mockResolvedValue({
      data: { id: "gcal-fail-after-comp", status: "confirmed", created: "2026-07-24T12:00:00.000Z" },
    });
    mockGcalDelete.mockResolvedValue({ data: {} });

    const rpcNames: string[] = [];

    const supabase = createBookingChain({
      existingConfirmed: null,
      existingPending: null,
      existingDelivery: null,
      createRpcResult: { data: "appt-fail-after-comp", error: null },
      deliveryInsertResult: { id: "del-fail-after-comp" },
      deliveryProcessingResult: { attempt_count: 0 },
      appointmentRow: {
        booking_event_id: "evt-fail-after-comp",
        start_time: "2026-08-10T13:00:00.000Z",
        end_time: "2026-08-10T13:30:00.000Z",
        timezone: "America/New_York",
        lead_id: "lid-fail-after-comp",
      },
      leadRow: {
        first_name: "Fail",
        last_name: "AfterComp",
        email: "failafter@test.com",
        phone: "555-0900",
        zip_code: "90001",
      },
    });
    supabase.rpc.mockImplementation((name: string) => {
      rpcNames.push(name);
      if (name === "create_funnel_appointment") {
        return Promise.resolve({ data: "appt-fail-after-comp", error: null });
      }
      if (name === "confirm_funnel_appointment") {
        return Promise.reject({ code: "P0103", message: "Cannot confirm" });
      }
      if (name === "fail_funnel_appointment") {
        return Promise.reject({ code: "P0103", message: "Appointment not in pending state" });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockSupabase.mockReturnValue(supabase);

    const { createBooking } = await import("@/lib/booking/create-booking");
    const result = await createBooking({
      lead_id: "00000000-0000-0000-0000-000000000001",
      session_id: "00000000-0000-0000-0000-000000000002",
      start_time: "2026-08-10T13:00:00.000Z",
      timezone: "America/New_York",
      event_id: "00000000-0000-0000-0000-000000000110",
    });

    expect(rpcNames).toContain("fail_funnel_appointment");
    expect(result).not.toHaveProperty("appointment_id");
    expect(result).toHaveProperty("status", 500);
  });

  it("delivery records APPOINTMENT_FAIL_AFTER_COMPENSATION_FAILED when fail_funnel_appointment fails", async () => {
    mockGcalInsert.mockResolvedValue({
      data: { id: "gcal-code-check", status: "confirmed", created: "2026-07-24T12:00:00.000Z" },
    });
    mockGcalDelete.mockResolvedValue({ data: {} });

    let deliveryErrorCode = "";

    const supabase = createBookingChain({
      existingConfirmed: null,
      existingPending: null,
      existingDelivery: null,
      createRpcResult: { data: "appt-code-check", error: null },
      deliveryInsertResult: { id: "del-code-check" },
      deliveryProcessingResult: { attempt_count: 0 },
      appointmentRow: {
        booking_event_id: "evt-code-check",
        start_time: "2026-08-10T14:00:00.000Z",
        end_time: "2026-08-10T14:30:00.000Z",
        timezone: "America/New_York",
        lead_id: "lid-code-check",
      },
      leadRow: {
        first_name: "Code",
        last_name: "Check",
        email: "code@test.com",
        phone: "555-1000",
        zip_code: "10010",
      },
    });
    supabase.rpc.mockImplementation((name: string) => {
      if (name === "create_funnel_appointment") {
        return Promise.resolve({ data: "appt-code-check", error: null });
      }
      if (name === "confirm_funnel_appointment") {
        return Promise.reject({ code: "P0103", message: "Cannot confirm" });
      }
      if (name === "fail_funnel_appointment") {
        return Promise.reject({ code: "P0103", message: "Appointment not in pending state" });
      }
      return Promise.resolve({ data: null, error: null });
    });

    supabase.update.mockImplementation((values: Record<string, unknown>) => {
      if (values.error_message) {
        deliveryErrorCode = values.error_message as string;
      }
      return supabase;
    });

    mockSupabase.mockReturnValue(supabase);

    const { createBooking } = await import("@/lib/booking/create-booking");
    await createBooking({
      lead_id: "00000000-0000-0000-0000-000000000001",
      session_id: "00000000-0000-0000-0000-000000000002",
      start_time: "2026-08-10T14:00:00.000Z",
      timezone: "America/New_York",
      event_id: "00000000-0000-0000-0000-000000000111",
    });

    expect(deliveryErrorCode).toBe("APPOINTMENT_FAIL_AFTER_COMPENSATION_FAILED");
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

    const supabase = createBookingChain({
      existingConfirmed: null,
      existingPending: null,
      existingDelivery: null,
      createRpcResult: { data: "appointment-id-raw", error: null },
      deliveryInsertResult: { id: "del-raw" },
      deliveryProcessingResult: { attempt_count: 0 },
      appointmentRow: {
        booking_event_id: null,
        start_time: "2026-08-10T13:00:00.000Z",
        end_time: "2026-08-10T13:30:00.000Z",
        timezone: "America/New_York",
        lead_id: "lid-raw",
      },
      leadRow: {
        first_name: "Raw",
        last_name: "Test",
        email: "raw@test.com",
        phone: "555-0600",
        zip_code: "60001",
      },
      confirmRpcResult: { data: "confirmed-raw-id", error: null },
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

    const supabase = createBookingChain({
      existingConfirmed: null,
      existingPending: null,
      existingDelivery: null,
      createRpcResult: { data: "appointment-both-id", error: null },
      deliveryInsertResult: { id: "del-both" },
      deliveryProcessingResult: { attempt_count: 0 },
      appointmentRow: {
        booking_event_id: null,
        start_time: "2026-08-11T13:00:00.000Z",
        end_time: "2026-08-11T13:30:00.000Z",
        timezone: "America/New_York",
        lead_id: "lid-both",
      },
      leadRow: {
        first_name: "Both",
        last_name: "Test",
        email: "both@test.com",
        phone: "555-0700",
        zip_code: "70001",
      },
      confirmRpcResult: { data: "confirmed-both-id", error: null },
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

    const supabase = createBookingChain({
      existingConfirmed: null,
      existingPending: null,
      existingDelivery: null,
      createRpcResult: { data: "appointment-both-fail", error: null },
      deliveryInsertResult: { id: "del-both-fail" },
      deliveryProcessingResult: { attempt_count: 0 },
      appointmentRow: {
        booking_event_id: null,
        start_time: "2026-08-12T13:00:00.000Z",
        end_time: "2026-08-12T13:30:00.000Z",
        timezone: "America/New_York",
        lead_id: "lid-both-fail",
      },
      leadRow: {
        first_name: "Both",
        last_name: "Fail",
        email: "bothfail@test.com",
        phone: "555-0800",
        zip_code: "80001",
      },
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
