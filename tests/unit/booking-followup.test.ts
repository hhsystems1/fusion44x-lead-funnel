import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import {
  renderBookingFollowUpHtml,
  renderBookingFollowUpText,
} from "@/lib/email/templates/booking-followup";
import { buildBookingFollowUpSendInput } from "@/lib/email/follow-up-send-input";
import type { InternalDiagnosticLabels } from "@/lib/email/templates/internal-booking-notification";
import type { EmailProvider, SendEmailResult } from "@/lib/email/provider/types";

const DEFAULT_ROW = { data: null, error: { code: "PGRST116", message: "not found" } };

type QueryState = {
  table: string;
  kind: string;
  filters: [string, unknown][];
};

function filterHas(state: QueryState, col: string, val: unknown): boolean {
  return state.filters.some(([c, v]) => c === col && v === val);
}

vi.mock("@/lib/supabase/server", () => {
  const mockDb: Record<string, (state: QueryState) => unknown> = {};
  const mockRpc: Record<string, (args?: unknown) => unknown> = {};
  const insertCalls: { table: string; payload: Record<string, unknown> }[] = [];

  function resolveQuery(state: QueryState): { data: unknown; error: unknown } {
    const handler = mockDb[state.table];
    if (handler) {
      const result = handler(state) as { data: unknown; error: unknown };
      if (result && "data" in result) {
        return result;
      }
      return { data: result, error: null };
    }
    if (state.kind === "maybeSingle") {
      return { data: null, error: null };
    }
    return DEFAULT_ROW;
  }

  function buildChain(table: string) {
    const state: QueryState = { table, kind: "direct", filters: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = Object.assign(function () {}, {
      select: vi.fn(() => chain),
      eq: vi.fn((col: string, val: unknown) => {
        state.filters.push([col, val]);
        return chain;
      }),
      in: vi.fn((col: string, val: unknown) => {
        state.filters.push([col, val]);
        return chain;
      }),
      or: vi.fn((s: string) => {
        state.filters.push(["__or__", s]);
        return chain;
      }),
      maybeSingle: vi.fn(() => {
        state.kind = "maybeSingle";
        return Promise.resolve(resolveQuery(state));
      }),
      single: vi.fn(() => {
        state.kind = "single";
        return Promise.resolve(resolveQuery(state));
      }),
      insert: vi.fn((payload: Record<string, unknown>) => {
        insertCalls.push({ table, payload });
        return {
          select: vi.fn(() => ({
            single: vi.fn(() => {
              state.kind = "insert";
              return Promise.resolve(resolveQuery(state));
            }),
          })),
        };
      }),
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
        Promise.resolve(resolveQuery(state)).then(res, rej),
    });
    return chain;
  }

  return {
    getServerSupabaseClient: vi.fn(() => ({
      from: vi.fn((table: string) => buildChain(table)),
      rpc: vi.fn((name: string, args?: unknown) =>
        Promise.resolve(
          mockRpc[name] ? mockRpc[name](args) : { data: null, error: null },
        ),
      ),
    })),
    __mockDb: mockDb,
    __mockRpc: mockRpc,
    __insertCalls: insertCalls,
  };
});

function createErrorProvider(base: EmailProvider): EmailProvider {
  return {
    ...base,
    async sendBookingFollowUp(): Promise<SendEmailResult> {
      throw { code: "PROVIDER_UNAVAILABLE", message: "down", retryable: true };
    },
  };
}

const diagnostic: InternalDiagnosticLabels = {
  waterFeature: "Pool only",
  installationType: "In-ground",
  poolSize: "10,001 – 15,000 gallons",
  currentTreatment: "Chlorine",
  primaryGoal: "I want to eliminate chlorine, salt, and harsh chemicals",
  currentIssues: ["Skin or eye irritation", "Algae growth"],
};

const templateParams = {
  recipientFirstName: "Jane",
  confirmedStartTime: "2026-07-28T14:00:00.000Z",
  confirmedEndTime: "2026-07-28T14:30:00.000Z",
  timezone: "America/New_York",
  diagnostic,
};

describe("Booking follow-up template (HTML)", () => {
  it("renders a greeting with recipient first name", () => {
    const html = renderBookingFollowUpHtml(templateParams);
    expect(html).toContain("Hello Jane");
  });

  it("includes confirmed date, time, duration, and timezone", () => {
    const html = renderBookingFollowUpHtml(templateParams);
    expect(html).toContain("Tuesday, July 28, 2026");
    expect(html).toContain("10:00 AM");
    expect(html).toContain("10:30 AM");
    expect(html).toContain("30 minutes");
    expect(html).toContain("America/New_York");
  });

  it("includes the what-to-expect section", () => {
    const html = renderBookingFollowUpHtml(templateParams);
    expect(html).toContain("What to Expect");
  });

  it("renders the diagnostic recap with readable labels", () => {
    const html = renderBookingFollowUpHtml(templateParams);
    expect(html).toContain("Your Details");
    expect(html).toContain("Water Feature");
    expect(html).toContain("In-ground");
    expect(html).toContain("Current Treatment");
    expect(html).toContain("Chlorine");
    expect(html).toContain("Skin or eye irritation, Algae growth");
  });

  it("escapes HTML in diagnostic values", () => {
    const html = renderBookingFollowUpHtml({
      ...templateParams,
      diagnostic: {
        ...diagnostic,
        primaryGoal: "Eliminate <b>chlorine</b> & salt",
        currentIssues: ["Skin <em>issues</em> & more"],
      },
    });
    expect(html).toContain("&lt;b&gt;chlorine&lt;/b&gt;");
    expect(html).not.toContain("<b>chlorine</b>");
    expect(html).toContain("Skin &lt;em&gt;issues&lt;/em&gt; &amp; more");
  });

  it("omits the diagnostic section when absent", () => {
    const { diagnostic: _diag, ...paramsWithout } = templateParams;
    void _diag;
    const html = renderBookingFollowUpHtml(paramsWithout);
    expect(html).not.toContain("Your Details");
    expect(html).not.toContain("Water Feature");
  });
});

describe("Booking follow-up template (text)", () => {
  it("includes date, time, and timezone", () => {
    const text = renderBookingFollowUpText(templateParams);
    expect(text).toContain("Tuesday, July 28, 2026");
    expect(text).toContain("10:00 AM – 10:30 AM");
    expect(text).toContain("America/New_York");
  });

  it("includes diagnostic recap lines", () => {
    const text = renderBookingFollowUpText(templateParams);
    expect(text).toContain("Your Details");
    expect(text).toContain("Current Treatment: Chlorine");
    expect(text).toContain("Current Issues:    Skin or eye irritation, Algae growth");
  });

  it("omits diagnostic lines when absent", () => {
    const { diagnostic: _diag, ...paramsWithout } = templateParams;
    void _diag;
    const text = renderBookingFollowUpText(paramsWithout);
    expect(text).not.toContain("Your Details");
    expect(text).not.toContain("Current Treatment:");
  });
});

describe("buildBookingFollowUpSendInput", () => {
  const prepared = {
    appointmentId: "appt-1",
    leadId: "lead-1",
    recipientEmail: "jane@example.com",
    recipientFirstName: "Jane",
    confirmedStartTime: templateParams.confirmedStartTime,
    confirmedEndTime: templateParams.confirmedEndTime,
    timezone: templateParams.timezone,
    bookingEventId: "booking-1",
    diagnostic,
  };

  it("builds an input with recipient, rendered content, and diagnostic", () => {
    const input = buildBookingFollowUpSendInput(prepared, "delivery-1");
    expect(input.recipientEmail).toBe("jane@example.com");
    expect(input.recipientFirstName).toBe("Jane");
    expect(input.deliveryId).toBe("delivery-1");
    expect(input.html).toContain("Hello Jane");
    expect(input.html).toContain("Chlorine");
    expect(input.text).toContain("Chlorine");
    expect(input.followUpDiagnostic).toEqual(diagnostic);
  });

  it("omits diagnostic when prepared diagnostic is null", () => {
    const input = buildBookingFollowUpSendInput(
      { ...prepared, diagnostic: null },
      "delivery-2",
    );
    expect(input.followUpDiagnostic).toBeUndefined();
    expect(input.html).not.toContain("Your Details");
  });
});

function makeId(): string {
  return crypto.randomUUID();
}

describe("scheduleBookingFollowUp", () => {
  let db: Record<string, (state: QueryState) => unknown>;
  let rpc: Record<string, (args?: unknown) => unknown>;
  let insertCalls: { table: string; payload: Record<string, unknown> }[];

  beforeEach(async () => {
    const supabase = await import("@/lib/supabase/server");
    db = (supabase as unknown as { __mockDb: typeof db }).__mockDb;
    rpc = (supabase as unknown as { __mockRpc: typeof rpc }).__mockRpc;
    insertCalls = (supabase as unknown as { __insertCalls: typeof insertCalls })
      .__insertCalls;
    for (const key of Object.keys(db)) delete db[key];
    for (const key of Object.keys(rpc)) delete rpc[key];
    insertCalls.length = 0;
  });

  it("creates a pending delivery due ~5 minutes from now", async () => {
    const appointmentId = makeId();
    const leadId = makeId();
    db["appointments"] = (state) =>
      state.kind === "single" && filterHas(state, "id", appointmentId)
        ? {
            data: {
              id: appointmentId,
              lead_id: leadId,
              status: "confirmed",
              start_time: "2026-07-28T14:00:00.000Z",
              end_time: "2026-07-28T14:30:00.000Z",
              timezone: "America/New_York",
              booking_event_id: "booking-1",
            },
            error: null,
          }
        : DEFAULT_ROW;
    db["leads"] = (state) =>
      state.kind === "single" && filterHas(state, "id", leadId)
        ? {
            data: {
              first_name: "Jane",
              email: "jane@example.com",
              water_feature: "pool_only",
              installation_type: "in_ground",
              pool_size: "10001_15000",
              current_treatment: "chlorine",
              primary_goal: "eliminate_chemicals",
            },
            error: null,
          }
        : DEFAULT_ROW;
    db["lead_answers"] = (state) =>
      filterHas(state, "question_id", "current-issues")
        ? {
            data: [
              { answer_code: "skin_eye_irritation" },
              { answer_code: "algae_growth" },
            ],
            error: null,
          }
        : DEFAULT_ROW;
    db["integration_deliveries"] = (state) => {
      if (state.kind === "insert") {
        return { data: { id: "delivery-1" }, error: null };
      }
      if (state.kind === "maybeSingle") {
        return { data: null, error: null };
      }
      return DEFAULT_ROW;
    };

    const before = Date.now();
    const { scheduleBookingFollowUp } = await import("@/lib/email/follow-up");
    const deliveryId = await scheduleBookingFollowUp({ appointmentId });

    expect(deliveryId).toBe("delivery-1");

    const inserts = insertCalls.filter(
      (c) => c.table === "integration_deliveries",
    );
    expect(inserts).toHaveLength(1);
    const inserted = inserts[0].payload;
    expect(inserted.event_type).toBe("booking_followup");
    expect(inserted.status).toBe("pending");
    expect(inserted.attempt_count).toBe(0);
    expect(inserted.destination).toBe("email");

    const due = new Date(inserted.next_attempt_at as string).getTime();
    expect(due).toBeGreaterThanOrEqual(before + 5 * 60 * 1000);
    expect(due).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000 + 5_000);
  });

  it("returns the existing delivery id when already scheduled", async () => {
    const appointmentId = makeId();
    const leadId = makeId();
    db["appointments"] = (state) =>
      state.kind === "single"
        ? {
            data: {
              id: appointmentId,
              lead_id: leadId,
              status: "confirmed",
              start_time: "2026-07-28T14:00:00.000Z",
              end_time: "2026-07-28T14:30:00.000Z",
              timezone: "America/New_York",
              booking_event_id: "booking-1",
            },
            error: null,
          }
        : DEFAULT_ROW;
    db["leads"] = (state) =>
      state.kind === "single"
        ? {
            data: {
              first_name: "Jane",
              email: "jane@example.com",
              water_feature: "pool_only",
              installation_type: "in_ground",
              pool_size: "10001_15000",
              current_treatment: "chlorine",
              primary_goal: "eliminate_chemicals",
            },
            error: null,
          }
        : DEFAULT_ROW;
    db["integration_deliveries"] = (state) => {
      if (state.kind === "maybeSingle") {
        return {
          data: {
            id: "existing-delivery",
            appointment_id: appointmentId,
            destination: "email",
            event_type: "booking_followup",
            status: "pending",
            attempt_count: 0,
            template_version: "1.0.0",
            provider_message_id: null,
            error_message: null,
            next_attempt_at: "2099-01-01T00:00:00.000Z",
          },
          error: null,
        };
      }
      return DEFAULT_ROW;
    };

    const { scheduleBookingFollowUp } = await import("@/lib/email/follow-up");
    const deliveryId = await scheduleBookingFollowUp({ appointmentId });
    expect(deliveryId).toBe("existing-delivery");
    expect(
      insertCalls.filter((c) => c.table === "integration_deliveries"),
    ).toHaveLength(0);
  });
});

describe("sendDueBookingFollowUps", () => {
  let db: Record<string, (state: QueryState) => unknown>;
  let rpc: Record<string, (args?: unknown) => unknown>;

  beforeEach(async () => {
    const supabase = await import("@/lib/supabase/server");
    db = (supabase as unknown as { __mockDb: typeof db }).__mockDb;
    rpc = (supabase as unknown as { __mockRpc: typeof rpc }).__mockRpc;
    for (const key of Object.keys(db)) delete db[key];
    for (const key of Object.keys(rpc)) delete rpc[key];
  });

  function dueFollowUpRow(appointmentId: string, id = "followup-1") {
    return {
      id,
      appointment_id: appointmentId,
      destination: "email",
      event_type: "booking_followup",
      event_id: null,
      status: "pending",
      attempt_count: 0,
      template_version: "1.0.0",
      provider_message_id: null,
      error_message: null,
      next_attempt_at: "2020-01-01T00:00:00.000Z",
    };
  }

  function confirmedAppointment(appointmentId: string, leadId: string) {
    return {
      id: appointmentId,
      lead_id: leadId,
      status: "confirmed",
      start_time: "2026-07-28T14:00:00.000Z",
      end_time: "2026-07-28T14:30:00.000Z",
      timezone: "America/New_York",
      booking_event_id: "booking-1",
    };
  }

  function confirmedLead(leadId: string) {
    return {
      id: leadId,
      first_name: "Jane",
      email: "jane@example.com",
      water_feature: "pool_only",
      installation_type: "in_ground",
      pool_size: "10001_15000",
      current_treatment: "chlorine",
      primary_goal: "eliminate_chemicals",
    };
  }

  it("skips (retryable) when the confirmation email is not yet delivered", async () => {
    const appointmentId = makeId();
    db["integration_deliveries"] = (state) => {
      if (state.kind === "direct") {
        return { data: [dueFollowUpRow(appointmentId)], error: null };
      }
      if (state.kind === "maybeSingle") {
        return {
          data: {
            ...dueFollowUpRow(appointmentId, "confirmation-1"),
            event_type: "booking_confirmation",
            status: "failed",
            attempt_count: 2,
          },
          error: null,
        };
      }
      return DEFAULT_ROW;
    };
    let failedArgs: unknown = null;
    rpc["mark_email_delivery_failed"] = (args) => {
      failedArgs = args;
      return { data: null, error: null };
    };

    const { createFakeEmailProvider } = await import("@/lib/email/provider/fake-provider");
    const { sendDueBookingFollowUps } = await import("@/lib/email/follow-up");
    const result = await sendDueBookingFollowUps({
      provider: createFakeEmailProvider(),
    });

    expect(result.processed).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.sent).toBe(0);
    expect(failedArgs).toMatchObject({
      p_delivery_id: "followup-1",
      p_safe_error_code: "CONFIRMATION_NOT_DELIVERED",
      p_retryable: true,
    });
  });

  it("marks terminal when no confirmation delivery record exists", async () => {
    const appointmentId = makeId();
    db["integration_deliveries"] = (state) => {
      if (state.kind === "direct") {
        return { data: [dueFollowUpRow(appointmentId)], error: null };
      }
      if (state.kind === "maybeSingle") {
        return { data: null, error: null };
      }
      return DEFAULT_ROW;
    };
    let failedArgs: unknown = null;
    rpc["mark_email_delivery_failed"] = (args) => {
      failedArgs = args;
      return { data: null, error: null };
    };

    const { createFakeEmailProvider } = await import("@/lib/email/provider/fake-provider");
    const { sendDueBookingFollowUps } = await import("@/lib/email/follow-up");
    const result = await sendDueBookingFollowUps({
      provider: createFakeEmailProvider(),
    });

    expect(result.skipped).toBe(1);
    expect(failedArgs).toMatchObject({
      p_delivery_id: "followup-1",
      p_safe_error_code: "CONFIRMATION_NOT_DELIVERED",
      p_retryable: false,
    });
  });

  it("sends the follow-up and marks delivered when confirmation was delivered", async () => {
    const appointmentId = makeId();
    const leadId = makeId();
    db["integration_deliveries"] = (state) => {
      if (state.kind === "direct") {
        return { data: [dueFollowUpRow(appointmentId)], error: null };
      }
      if (state.kind === "maybeSingle") {
        return {
          data: {
            ...dueFollowUpRow(appointmentId, "confirmation-1"),
            event_type: "booking_confirmation",
            status: "delivered",
            provider_message_id: "msg-1",
          },
          error: null,
        };
      }
      return DEFAULT_ROW;
    };
    db["appointments"] = (state) =>
      state.kind === "single"
        ? { data: confirmedAppointment(appointmentId, leadId), error: null }
        : DEFAULT_ROW;
    db["leads"] = (state) =>
      state.kind === "single"
        ? { data: confirmedLead(leadId), error: null }
        : DEFAULT_ROW;
    db["lead_answers"] = () => ({ data: [], error: null });

    rpc["claim_email_delivery"] = (args) => {
      const id = (args as { p_delivery_id: string }).p_delivery_id;
      return { data: [dueFollowUpRow(appointmentId, id)], error: null };
    };
    let deliveredArgs: unknown = null;
    rpc["mark_email_delivery_delivered"] = (args) => {
      deliveredArgs = args;
      return { data: null, error: null };
    };

    const { createFakeEmailProvider } = await import("@/lib/email/provider/fake-provider");
    const { sendDueBookingFollowUps } = await import("@/lib/email/follow-up");
    const result = await sendDueBookingFollowUps({
      provider: createFakeEmailProvider(),
    });

    expect(result.processed).toBe(1);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(deliveredArgs).toMatchObject({
      p_delivery_id: "followup-1",
      p_provider_message_id: expect.any(String),
    });
  });

  it("marks failed when the provider throws", async () => {
    const appointmentId = makeId();
    const leadId = makeId();
    db["integration_deliveries"] = (state) => {
      if (state.kind === "direct") {
        return { data: [dueFollowUpRow(appointmentId)], error: null };
      }
      if (state.kind === "maybeSingle") {
        return {
          data: {
            ...dueFollowUpRow(appointmentId, "confirmation-1"),
            event_type: "booking_confirmation",
            status: "delivered",
            provider_message_id: "msg-1",
          },
          error: null,
        };
      }
      return DEFAULT_ROW;
    };
    db["appointments"] = (state) =>
      state.kind === "single"
        ? { data: confirmedAppointment(appointmentId, leadId), error: null }
        : DEFAULT_ROW;
    db["leads"] = (state) =>
      state.kind === "single"
        ? { data: confirmedLead(leadId), error: null }
        : DEFAULT_ROW;
    db["lead_answers"] = () => ({ data: [], error: null });
    rpc["claim_email_delivery"] = (args) => {
      const id = (args as { p_delivery_id: string }).p_delivery_id;
      return { data: [dueFollowUpRow(appointmentId, id)], error: null };
    };
    let failedArgs: unknown = null;
    rpc["mark_email_delivery_failed"] = (args) => {
      failedArgs = args;
      return { data: null, error: null };
    };

    const { createFakeEmailProvider } = await import("@/lib/email/provider/fake-provider");
    const { sendDueBookingFollowUps } = await import("@/lib/email/follow-up");
    const result = await sendDueBookingFollowUps({
      provider: createErrorProvider(createFakeEmailProvider()),
    });

    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
    expect(failedArgs).toMatchObject({
      p_delivery_id: "followup-1",
      p_safe_error_code: "PROVIDER_UNAVAILABLE",
      p_retryable: true,
    });
  });
});
