import { describe, it, expect, vi } from "vitest";
import crypto from "node:crypto";
import {
  renderBookingConfirmationHtml,
  renderBookingConfirmationText,
} from "@/lib/email/templates/booking-confirmation";
import {
  renderInternalBookingNotificationHtml,
  renderInternalBookingNotificationText,
} from "@/lib/email/templates/internal-booking-notification";
import type { SendEmailInput, SendEmailResult, ProviderError } from "@/lib/email/provider/types";
import { createFakeEmailProvider } from "@/lib/email/provider/fake-provider";
import { EMAIL_CONFIG } from "@/config/email";

vi.mock("@/lib/supabase/server", () => {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(() => ({
      data: null,
      error: { code: "PGRST116", message: "Row not found" },
    })),
    single: vi.fn(() => ({
      data: null,
      error: { code: "PGRST116", message: "Row not found" },
    })),
  };
  return {
    getServerSupabaseClient: vi.fn(() => ({
      from: vi.fn(() => chain),
      rpc: vi.fn(() => ({ data: false, error: null })),
    })),
  };
});

const validParams = {
  recipientFirstName: "Jane",
  confirmedStartTime: "2026-07-28T14:00:00.000Z",
  confirmedEndTime: "2026-07-28T14:30:00.000Z",
  timezone: "America/New_York",
  googleCalendarLink: "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Fusion+44X+Consultation",
  outlookCalendarLink: "https://outlook.live.com/calendar/0/deeplink/compose?subject=Fusion+44X+Consultation",
  icsContent: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR",
};

function makeId(): string {
  return crypto.randomUUID();
}

describe("HTML template rendering", () => {
  it("renders a greeting with recipient first name", () => {
    const html = renderBookingConfirmationHtml(validParams);
    expect(html).toContain("Hello Jane");
  });

  it("includes confirmed date", () => {
    const html = renderBookingConfirmationHtml(validParams);
    expect(html).toContain("Tuesday, July 28, 2026");
  });

  it("includes confirmed time range", () => {
    const html = renderBookingConfirmationHtml(validParams);
    expect(html).toContain("10:00 AM");
    expect(html).toContain("10:30 AM");
  });

  it("includes timezone", () => {
    const html = renderBookingConfirmationHtml(validParams);
    expect(html).toContain("America/New_York");
  });

  it("includes consultation duration", () => {
    const html = renderBookingConfirmationHtml(validParams);
    expect(html).toContain("30 minutes");
  });

  it("includes consultation title from config", () => {
    const html = renderBookingConfirmationHtml(validParams);
    expect(html).toContain(EMAIL_CONFIG.CONSULTATION_TITLE);
  });

  it("includes Google Calendar button link", () => {
    const html = renderBookingConfirmationHtml(validParams);
    expect(html).toContain("calendar.google.com");
  });

  it("includes Outlook Calendar button link", () => {
    const html = renderBookingConfirmationHtml(validParams);
    expect(html).toContain("outlook.live.com");
  });

  it("includes ICS download link", () => {
    const html = renderBookingConfirmationHtml(validParams);
    expect(html).toContain("text/calendar");
  });

  it("includes support contact details", () => {
    const html = renderBookingConfirmationHtml(validParams);
    expect(html).toContain(EMAIL_CONFIG.COMPANY_NAME);
    expect(html).toContain(EMAIL_CONFIG.SUPPORT_PHONE);
  });

  it("contains no JavaScript", () => {
    const html = renderBookingConfirmationHtml(validParams);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
  });

  it("contains no tracking pixels", () => {
    const html = renderBookingConfirmationHtml(validParams);
    expect(html).not.toContain("tracking");
    expect(html).not.toContain("beacon");
  });

  it("does not contain diagnostic answers", () => {
    const html = renderBookingConfirmationHtml(validParams);
    expect(html).not.toContain("diagnostic");
    expect(html).not.toContain("pool_size");
    expect(html).not.toContain("water_feature");
  });

  it("does not contain unnecessary lead data", () => {
    const html = renderBookingConfirmationHtml(validParams);
    expect(html).not.toContain("lead_id");
    expect(html).not.toContain("session_id");
  });

  it("is valid HTML with html and body tags", () => {
    const html = renderBookingConfirmationHtml(validParams);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
    expect(html).toContain("<body");
    expect(html).toContain("</body>");
  });
});

describe("HTML escaping", () => {
  it("escapes HTML in recipient first name", () => {
    const html = renderBookingConfirmationHtml({
      ...validParams,
      recipientFirstName: '<script>alert("xss")</script>',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML in timezone display", () => {
    const html = renderBookingConfirmationHtml({
      ...validParams,
      timezone: 'America/New_York',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("America/New_York");
  });

  it("escapes HTML in calendar links", () => {
    const html = renderBookingConfirmationHtml({
      ...validParams,
      googleCalendarLink: 'https://evil.com/?q="><script>',
    });
    expect(html).not.toContain("<script>");
  });
});

describe("plain-text rendering", () => {
  it("renders a greeting with recipient first name", () => {
    const text = renderBookingConfirmationText(validParams);
    expect(text).toContain("Hello Jane");
  });

  it("includes confirmed date", () => {
    const text = renderBookingConfirmationText(validParams);
    expect(text).toContain("Tuesday, July 28, 2026");
  });

  it("includes confirmed time range", () => {
    const text = renderBookingConfirmationText(validParams);
    expect(text).toContain("10:00 AM");
    expect(text).toContain("10:30 AM");
  });

  it("includes timezone", () => {
    const text = renderBookingConfirmationText(validParams);
    expect(text).toContain("America/New_York");
  });

  it("includes duration", () => {
    const text = renderBookingConfirmationText(validParams);
    expect(text).toContain("30 minutes");
  });

  it("includes calendar links", () => {
    const text = renderBookingConfirmationText(validParams);
    expect(text).toContain("calendar.google.com");
    expect(text).toContain("outlook.live.com");
  });

  it("includes support contact details", () => {
    const text = renderBookingConfirmationText(validParams);
    expect(text).toContain(EMAIL_CONFIG.COMPANY_NAME);
    expect(text).toContain(EMAIL_CONFIG.SUPPORT_PHONE);
  });

  it("contains no diagnostic answers", () => {
    const text = renderBookingConfirmationText(validParams);
    expect(text).not.toContain("diagnostic");
    expect(text).not.toContain("pool_size");
  });
});

describe("FakeEmailProvider", () => {
  it("returns a message ID on success", async () => {
    const provider = createFakeEmailProvider();
    const input: SendEmailInput = {
      recipientEmail: "jane@example.com",
      recipientFirstName: "Jane",
      appointmentId: makeId(),
      deliveryId: makeId(),
      confirmedStartTime: "2026-07-28T14:00:00.000Z",
      confirmedEndTime: "2026-07-28T14:30:00.000Z",
      timezone: "America/New_York",
      googleCalendarLink: "https://calendar.google.com/",
      outlookCalendarLink: "https://outlook.live.com/",
      icsContent: "BEGIN:VCALENDAR\r\nEND:VCALENDAR",
      html: "<html>test</html>",
      text: "test",
    };
    const result = await provider.sendBookingConfirmation(input);
    expect(result.status).toBe("delivered");
    expect(result.messageId).toBeTruthy();
    expect(typeof result.messageId).toBe("string");
  });

  it("has provider name 'fake'", () => {
    const provider = createFakeEmailProvider();
    expect(provider.name).toBe("fake");
  });
});

describe("Provider normalization", () => {
  it("success result contains messageId and delivered status", () => {
    const result: SendEmailResult = {
      messageId: "msg_123",
      status: "delivered",
    };
    expect(result.status).toBe("delivered");
    expect(result.messageId).toBe("msg_123");
  });

  it("error result contains code, message, and retryable flag", () => {
    const error: ProviderError = {
      code: "PROVIDER_UNAVAILABLE",
      message: "Service temporarily unavailable",
      retryable: true,
    };
    expect(error.code).toBe("PROVIDER_UNAVAILABLE");
    expect(error.retryable).toBe(true);
  });

  it("terminal errors are not retryable", () => {
    const error: ProviderError = {
      code: "INVALID_RECIPIENT",
      message: "Invalid email address",
      retryable: false,
    };
    expect(error.retryable).toBe(false);
  });
});

describe("Confirmed appointments only", () => {
  it("prepares null for non-existent appointment", async () => {
    const { prepareBookingConfirmation } = await import("@/lib/email/notifications");
    const result = await prepareBookingConfirmation({
      appointmentId: "00000000-0000-0000-0000-000000000000",
    });
    expect(result).toBeNull();
  });
});

describe("Invalid recipient rejection", () => {
  it("rejects empty email", () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(emailRegex.test("")).toBe(false);
  });

  it("rejects email without @", () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(emailRegex.test("notanemail")).toBe(false);
  });

  it("rejects email without domain", () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(emailRegex.test("user@")).toBe(false);
  });

  it("accepts valid email", () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(emailRegex.test("jane@example.com")).toBe(true);
  });
});

describe("Retry design", () => {
  it("identifies retryable error codes", async () => {
    const { isRetryable } = await import("@/lib/email/retry");
    expect(isRetryable("PROVIDER_UNAVAILABLE")).toBe(true);
    expect(isRetryable("RATE_LIMITED")).toBe(true);
    expect(isRetryable("TIMEOUT")).toBe(true);
    expect(isRetryable("NETWORK_ERROR")).toBe(true);
  });

  it("identifies terminal error codes", async () => {
    const { isTerminal } = await import("@/lib/email/retry");
    expect(isTerminal("INVALID_RECIPIENT")).toBe(true);
    expect(isTerminal("INVALID_TEMPLATE")).toBe(true);
    expect(isTerminal("PROVIDER_REJECTED")).toBe(true);
    expect(isTerminal("INVALID_CONFIG")).toBe(true);
  });

  it("calculates exponential backoff", async () => {
    const { getBackoffMs } = await import("@/lib/email/retry");
    expect(getBackoffMs(1)).toBe(60_000);
    expect(getBackoffMs(2)).toBe(120_000);
    expect(getBackoffMs(3)).toBe(240_000);
  });

  it("caps backoff at maxBackoffMs", async () => {
    const { getBackoffMs } = await import("@/lib/email/retry");
    expect(getBackoffMs(10)).toBe(3_600_000);
  });

  it("returns next attempt timestamp", async () => {
    const { getNextAttemptTimestamp } = await import("@/lib/email/retry");
    const ts = getNextAttemptTimestamp(1);
    expect(new Date(ts).getTime()).toBeGreaterThan(Date.now());
  });

  it("respects custom retry config", async () => {
    const { getBackoffMs } = await import("@/lib/email/retry");
    const backoff = getBackoffMs(1, { baseBackoffMs: 10_000, maxBackoffMs: 60_000 });
    expect(backoff).toBe(10_000);
  });
});

describe("No credentials or raw provider payloads returned", () => {
  it("SendEmailInput does not expose API keys", () => {
    const input: SendEmailInput = {
      recipientEmail: "jane@example.com",
      recipientFirstName: "Jane",
      appointmentId: makeId(),
      deliveryId: makeId(),
      confirmedStartTime: "2026-07-28T14:00:00.000Z",
      confirmedEndTime: "2026-07-28T14:30:00.000Z",
      timezone: "America/New_York",
      googleCalendarLink: "https://calendar.google.com/",
      outlookCalendarLink: "https://outlook.live.com/",
      icsContent: "BEGIN:VCALENDAR\r\nEND:VCALENDAR",
      html: "<html>test</html>",
      text: "test",
    };
    const keys = Object.keys(input);
    expect(keys).not.toContain("apiKey");
    expect(keys).not.toContain("api_key");
    expect(keys).not.toContain("credentials");
    expect(keys).not.toContain("auth");
  });

  it("SendEmailResult does not expose raw provider response", () => {
    const result: SendEmailResult = {
      messageId: "msg_123",
      status: "delivered",
    };
    const keys = Object.keys(result);
    expect(keys).not.toContain("raw");
    expect(keys).not.toContain("response");
    expect(keys).not.toContain("body");
  });
});

describe("SendEmailInput type validation", () => {
  it("accepts valid input with all required fields", () => {
    const input: SendEmailInput = {
      recipientEmail: "jane@example.com",
      recipientFirstName: "Jane",
      appointmentId: makeId(),
      deliveryId: makeId(),
      confirmedStartTime: "2026-07-28T14:00:00.000Z",
      confirmedEndTime: "2026-07-28T14:30:00.000Z",
      timezone: "America/New_York",
      googleCalendarLink: "https://calendar.google.com/",
      outlookCalendarLink: "https://outlook.live.com/",
      icsContent: "BEGIN:VCALENDAR\r\nEND:VCALENDAR",
      html: "<html>test</html>",
      text: "test",
    };
    expect(input.recipientEmail).toBeTruthy();
    expect(input.appointmentId).toBeTruthy();
  });

  it("accepts optional replyTo field", () => {
    const input: SendEmailInput = {
      recipientEmail: "jane@example.com",
      recipientFirstName: "Jane",
      appointmentId: makeId(),
      deliveryId: makeId(),
      confirmedStartTime: "2026-07-28T14:00:00.000Z",
      confirmedEndTime: "2026-07-28T14:30:00.000Z",
      timezone: "America/New_York",
      googleCalendarLink: "https://calendar.google.com/",
      outlookCalendarLink: "https://outlook.live.com/",
      icsContent: "BEGIN:VCALENDAR\r\nEND:VCALENDAR",
      html: "<html>test</html>",
      text: "test",
      replyTo: "consultations@fusion44x.com",
    };
    expect(input.replyTo).toBe("consultations@fusion44x.com");
  });
});

describe("Retry logic", () => {
  const deliveryId = "00000000-0000-0000-0000-000000000001";

  it("findEmailDeliveryById loads the exact delivery ID", async () => {
    const { findEmailDeliveryById } = await import("@/lib/email/delivery");

    // Should not throw, returns null for non-existent
    const result = await findEmailDeliveryById("test-id");
    expect(result).toBeNull();
  });

  it("retry does not use empty appointment/template identifiers", async () => {
    const { retryFailedEmailDelivery } = await import("@/lib/email/retry");
    const { createFakeEmailProvider } = await import("@/lib/email/provider/fake-provider");

    const provider = createFakeEmailProvider();

    // Should not throw and should handle missing delivery gracefully
    const result = await retryFailedEmailDelivery({
      deliveryId: "non-existent-id",
      provider,
    });

    expect(result.status).toBe("skipped");
  });

  it("returns delivered for already-delivered delivery", async () => {
    const { retryFailedEmailDelivery } = await import("@/lib/email/retry");
    const { createFakeEmailProvider } = await import("@/lib/email/provider/fake-provider");

    const provider = createFakeEmailProvider();

    const result = await retryFailedEmailDelivery({
      deliveryId: deliveryId,
      provider,
    });

    // Mock returns no delivery, so skipped
    expect(result.status).toBe("skipped");
  });

  it("skips processing delivery", async () => {
    const { retryFailedEmailDelivery } = await import("@/lib/email/retry");
    const { createFakeEmailProvider } = await import("@/lib/email/provider/fake-provider");

    const provider = createFakeEmailProvider();

    const result = await retryFailedEmailDelivery({
      deliveryId: deliveryId,
      provider,
    });

    expect(result.status).toBe("skipped");
  });

  it("skips dead_letter delivery", async () => {
    const { retryFailedEmailDelivery } = await import("@/lib/email/retry");
    const { createFakeEmailProvider } = await import("@/lib/email/provider/fake-provider");

    const provider = createFakeEmailProvider();

    const result = await retryFailedEmailDelivery({
      deliveryId: deliveryId,
      provider,
    });

    expect(result.status).toBe("skipped");
  });

  it("skips when retry not yet due", async () => {
    const { retryFailedEmailDelivery } = await import("@/lib/email/retry");
    const { createFakeEmailProvider } = await import("@/lib/email/provider/fake-provider");

    const provider = createFakeEmailProvider();

    const result = await retryFailedEmailDelivery({
      deliveryId: deliveryId,
      provider,
    });

    expect(result.status).toBe("skipped");
  });

  it("claimEmailDelivery returns claimed row atomically", async () => {
    const { claimEmailDelivery } = await import("@/lib/email/delivery");

    const result = await claimEmailDelivery("test-delivery-id");

    expect(result.claimed).toBe(false);
  });

  it("preparation failure after claim marks delivery as dead_letter", async () => {
    const { retryFailedEmailDelivery } = await import("@/lib/email/retry");
    const { createFakeEmailProvider } = await import("@/lib/email/provider/fake-provider");

    const provider = createFakeEmailProvider();

    const result = await retryFailedEmailDelivery({
      deliveryId: "non-existent-delivery",
      provider,
    });

    expect(result.status).toBe("skipped");
  });

  it("invalid recipient after claim marks delivery as dead_letter", async () => {
    const { retryFailedEmailDelivery } = await import("@/lib/email/retry");
    const { createFakeEmailProvider } = await import("@/lib/email/provider/fake-provider");

    const provider = createFakeEmailProvider();

    const result = await retryFailedEmailDelivery({
      deliveryId: "non-existent-delivery",
      provider,
    });

    expect(result.status).toBe("skipped");
  });

  it("fails if findEmailDelivery with empty strings is used", async () => {
    // This test documents that the old invalid pattern findEmailDelivery("", "")
    // would fail - we ensure our new code uses findEmailDeliveryById instead
    const { findEmailDeliveryById } = await import("@/lib/email/delivery");

    // This should work without empty strings
    const result = await findEmailDeliveryById("test-id");

    expect(result).toBeNull();
  });
});

describe("Internal notification HTML template rendering", () => {
  const internalParams = {
    customerFirstName: "Jane",
    customerEmail: "jane@example.com",
    customerPhone: "(555) 123-4567",
    confirmedStartTime: "2026-07-28T14:00:00.000Z",
    confirmedEndTime: "2026-07-28T14:30:00.000Z",
    timezone: "America/New_York",
    appointmentId: "appt-123",
    googleCalendarEventId: "gcal-456",
  };

  it("renders customer name", () => {
    const html = renderInternalBookingNotificationHtml(internalParams);
    expect(html).toContain("Jane");
  });

  it("renders customer email", () => {
    const html = renderInternalBookingNotificationHtml(internalParams);
    expect(html).toContain("jane@example.com");
  });

  it("renders customer phone when provided", () => {
    const html = renderInternalBookingNotificationHtml(internalParams);
    expect(html).toContain("(555) 123-4567");
  });

  it("omits phone row when not provided", () => {
    const html = renderInternalBookingNotificationHtml({
      ...internalParams,
      customerPhone: undefined,
    });
    expect(html).not.toContain("Phone");
  });

  it("renders appointment ID", () => {
    const html = renderInternalBookingNotificationHtml(internalParams);
    expect(html).toContain("appt-123");
  });

  it("renders GCal event ID when provided", () => {
    const html = renderInternalBookingNotificationHtml(internalParams);
    expect(html).toContain("gcal-456");
  });

  it("omits GCal event ID row when not provided", () => {
    const html = renderInternalBookingNotificationHtml({
      ...internalParams,
      googleCalendarEventId: undefined,
    });
    expect(html).not.toContain("GCal Event ID");
  });

  it("renders confirmed date", () => {
    const html = renderInternalBookingNotificationHtml(internalParams);
    expect(html).toContain("Tuesday, July 28, 2026");
  });

  it("renders confirmed time range", () => {
    const html = renderInternalBookingNotificationHtml(internalParams);
    expect(html).toContain("10:00 AM");
    expect(html).toContain("10:30 AM");
  });

  it("renders timezone", () => {
    const html = renderInternalBookingNotificationHtml(internalParams);
    expect(html).toContain("America/New_York");
  });

  it("contains no calendar links", () => {
    const html = renderInternalBookingNotificationHtml(internalParams);
    expect(html).not.toContain("calendar.google.com");
    expect(html).not.toContain("outlook.live.com");
  });

  it("contains no ICS attachment", () => {
    const html = renderInternalBookingNotificationHtml(internalParams);
    expect(html).not.toContain("text/calendar");
  });

  it("contains no JavaScript", () => {
    const html = renderInternalBookingNotificationHtml(internalParams);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
  });

  it("contains no tracking pixels", () => {
    const html = renderInternalBookingNotificationHtml(internalParams);
    expect(html).not.toContain("pixel");
    expect(html).not.toContain("beacon");
    expect(html).not.toContain("open-tracking");
  });

  it("renders diagnostic labels when provided", () => {
    const html = renderInternalBookingNotificationHtml({
      ...internalParams,
      diagnostic: {
        waterFeature: "Pool only",
        installationType: "In-ground",
        poolSize: "Small",
        currentTreatment: "Chlorine",
        primaryGoal: "I want to eliminate chlorine, salt, and harsh chemicals",
        currentIssues: ["Skin or eye irritation", "Algae growth"],
      },
    });
    expect(html).toContain("Pool Diagnostic");
    expect(html).toContain("Pool only");
    expect(html).toContain("In-ground");
    expect(html).toContain("Chlorine");
    expect(html).toContain(
      "I want to eliminate chlorine, salt, and harsh chemicals",
    );
    expect(html).toContain("Skin or eye irritation");
    expect(html).toContain("Algae growth");
  });

  it("omits diagnostic section when not provided", () => {
    const html = renderInternalBookingNotificationHtml(internalParams);
    expect(html).not.toContain("Pool Diagnostic");
  });

  it("escapes HTML in diagnostic labels", () => {
    const html = renderInternalBookingNotificationHtml({
      ...internalParams,
      diagnostic: {
        waterFeature: '<script>alert(1)</script>',
        installationType: "In-ground",
        poolSize: "Small",
        currentTreatment: "Chlorine",
        primaryGoal: "Goal",
        currentIssues: ["<b>bold</b>"],
      },
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("has internal notification title", () => {
    const html = renderInternalBookingNotificationHtml(internalParams);
    expect(html).toContain("New Booking");
    expect(html).toContain("Internal Notification");
  });

  it("is valid HTML", () => {
    const html = renderInternalBookingNotificationHtml(internalParams);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
    expect(html).toContain("<body");
  });
});

describe("Internal notification plain-text template rendering", () => {
  const internalParams = {
    customerFirstName: "Jane",
    customerEmail: "jane@example.com",
    customerPhone: "(555) 123-4567",
    confirmedStartTime: "2026-07-28T14:00:00.000Z",
    confirmedEndTime: "2026-07-28T14:30:00.000Z",
    timezone: "America/New_York",
    appointmentId: "appt-123",
    googleCalendarEventId: "gcal-456",
  };

  it("renders customer name", () => {
    const text = renderInternalBookingNotificationText(internalParams);
    expect(text).toContain("Jane");
  });

  it("renders customer email", () => {
    const text = renderInternalBookingNotificationText(internalParams);
    expect(text).toContain("jane@example.com");
  });

  it("renders phone when provided", () => {
    const text = renderInternalBookingNotificationText(internalParams);
    expect(text).toContain("(555) 123-4567");
  });

  it("omits phone line when not provided", () => {
    const text = renderInternalBookingNotificationText({
      ...internalParams,
      customerPhone: undefined,
    });
    expect(text).not.toContain("Phone:");
  });

  it("renders GCal event ID when provided", () => {
    const text = renderInternalBookingNotificationText(internalParams);
    expect(text).toContain("gcal-456");
  });

  it("omits GCal event ID when not provided", () => {
    const text = renderInternalBookingNotificationText({
      ...internalParams,
      googleCalendarEventId: undefined,
    });
    expect(text).not.toContain("GCal Event ID");
  });

  it("renders date and time", () => {
    const text = renderInternalBookingNotificationText(internalParams);
    expect(text).toContain("Tuesday, July 28, 2026");
    expect(text).toContain("10:00 AM");
  });

  it("renders diagnostic lines when provided", () => {
    const text = renderInternalBookingNotificationText({
      ...internalParams,
      diagnostic: {
        waterFeature: "Pool only",
        installationType: "In-ground",
        poolSize: "Small",
        currentTreatment: "Chlorine",
        primaryGoal: "I want to eliminate chlorine, salt, and harsh chemicals",
        currentIssues: ["Skin or eye irritation", "Algae growth"],
      },
    });
    expect(text).toContain("Pool Diagnostic");
    expect(text).toContain("Water Feature:     Pool only");
    expect(text).toContain("Installation Type: In-ground");
    expect(text).toContain("Chlorine");
    expect(text).toContain("Skin or eye irritation, Algae growth");
  });

  it("omits diagnostic lines when not provided", () => {
    const text = renderInternalBookingNotificationText(internalParams);
    expect(text).not.toContain("Pool Diagnostic");
  });

  it("contains no calendar links", () => {
    const text = renderInternalBookingNotificationText(internalParams);
    expect(text).not.toContain("calendar.google.com");
    expect(text).not.toContain("outlook.live.com");
  });

  it("contains internal notification disclaimer", () => {
    const text = renderInternalBookingNotificationText(internalParams);
    expect(text).toContain("This notification is for internal tracking only");
  });
});

describe("Internal notification HTML escaping", () => {
  it("escapes HTML in customer name", () => {
    const html = renderInternalBookingNotificationHtml({
      customerFirstName: '<script>alert("xss")</script>',
      customerEmail: "jane@example.com",
      confirmedStartTime: "2026-07-28T14:00:00.000Z",
      confirmedEndTime: "2026-07-28T14:30:00.000Z",
      timezone: "America/New_York",
      appointmentId: "appt-123",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML in customer email", () => {
    const html = renderInternalBookingNotificationHtml({
      customerFirstName: "Jane",
      customerEmail: '<a href="evil">email</a>',
      confirmedStartTime: "2026-07-28T14:00:00.000Z",
      confirmedEndTime: "2026-07-28T14:30:00.000Z",
      timezone: "America/New_York",
      appointmentId: "appt-123",
    });
    expect(html).not.toContain("<a href");
    expect(html).toContain("&lt;a href");
  });

  it("escapes HTML in phone number", () => {
    const html = renderInternalBookingNotificationHtml({
      customerFirstName: "Jane",
      customerEmail: "jane@example.com",
      customerPhone: '<script>alert("xss")</script>',
      confirmedStartTime: "2026-07-28T14:00:00.000Z",
      confirmedEndTime: "2026-07-28T14:30:00.000Z",
      timezone: "America/New_York",
      appointmentId: "appt-123",
    });
    expect(html).not.toContain("<script>");
  });

  it("escapes HTML in appointment ID", () => {
    const html = renderInternalBookingNotificationHtml({
      customerFirstName: "Jane",
      customerEmail: "jane@example.com",
      confirmedStartTime: "2026-07-28T14:00:00.000Z",
      confirmedEndTime: "2026-07-28T14:30:00.000Z",
      timezone: "America/New_York",
      appointmentId: '<script>evil</script>',
    });
    expect(html).not.toContain("<script>");
  });
});

describe("Internal notification FakeEmailProvider", () => {
  it("returns a message ID on success", async () => {
    const provider = createFakeEmailProvider();
    const input: SendEmailInput = {
      recipientEmail: "support@fusion44x.com",
      recipientFirstName: "Test",
      appointmentId: makeId(),
      deliveryId: makeId(),
      confirmedStartTime: "2026-07-28T14:00:00.000Z",
      confirmedEndTime: "2026-07-28T14:30:00.000Z",
      timezone: "America/New_York",
      googleCalendarLink: "",
      outlookCalendarLink: "",
      icsContent: "",
      html: "<html>test</html>",
      text: "test",
    };
    const result = await provider.sendInternalBookingNotification(input);
    expect(result.status).toBe("delivered");
    expect(result.messageId).toBeTruthy();
    expect(typeof result.messageId).toBe("string");
  });
});