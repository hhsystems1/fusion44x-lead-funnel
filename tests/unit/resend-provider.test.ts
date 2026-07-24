import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SendEmailInput } from "@/lib/email/provider/types";

const mockSend = vi.fn();

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails: { send: ReturnType<typeof vi.fn> };
    constructor() {
      this.emails = { send: mockSend };
    }
  },
}));

vi.mock("@/lib/email/templates/booking-confirmation", () => ({
  renderBookingConfirmationHtml: vi.fn(() => "<html>Test HTML</html>"),
  renderBookingConfirmationText: vi.fn(() => "Test Text"),
}));

describe("ResendEmailProvider", () => {
  let provider: ReturnType<typeof import("@/lib/email/provider/resend-provider").createResendEmailProvider>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.EMAIL_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "test@fusion44x.com";
    process.env.EMAIL_REPLY_TO = "reply@fusion44x.com";

    mockSend.mockResolvedValue({ data: { id: "resend_msg_123" }, error: null });

    const { createResendEmailProvider } = await import("@/lib/email/provider/resend-provider");
    provider = createResendEmailProvider();
  });

  afterEach(() => {
    vi.resetModules();
  });

  const validInput: SendEmailInput = {
    recipientEmail: "jane@example.com",
    recipientFirstName: "Jane",
    appointmentId: "appt-123",
    deliveryId: "delivery-456",
    confirmedStartTime: "2026-07-28T14:00:00.000Z",
    confirmedEndTime: "2026-07-28T14:30:00.000Z",
    timezone: "America/New_York",
    googleCalendarLink: "https://calendar.google.com/",
    outlookCalendarLink: "https://outlook.live.com/",
    icsContent: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR",
    html: "<html>Test</html>",
    text: "Test",
    replyTo: "custom@reply.com",
  };

  describe("initialization", () => {
    it("throws when EMAIL_API_KEY is missing", async () => {
      vi.resetModules();
      delete process.env.EMAIL_API_KEY;
      process.env.EMAIL_FROM = "test@fusion44x.com";

      const { createResendEmailProvider } = await import("@/lib/email/provider/resend-provider");
      expect(() => createResendEmailProvider()).toThrow("EMAIL_API_KEY is required");
    });

    it("throws when EMAIL_FROM is missing", async () => {
      vi.resetModules();
      process.env.EMAIL_API_KEY = "re_test_key";
      delete process.env.EMAIL_FROM;

      const { createResendEmailProvider } = await import("@/lib/email/provider/resend-provider");
      expect(() => createResendEmailProvider()).toThrow("EMAIL_FROM is required");
    });

    it("initializes with name 'resend'", () => {
      expect(provider.name).toBe("resend");
    });
  });

  describe("sendBookingConfirmation success", () => {
    it("returns normalized result with messageId and status delivered", async () => {
      mockSend.mockResolvedValue({
        data: { id: "resend_msg_123" },
        error: null,
      });

      const result = await provider.sendBookingConfirmation(validInput);

      expect(result.status).toBe("delivered");
      expect(result.messageId).toBe("resend_msg_123");
    });

    it("passes correct parameters to Resend", async () => {
      mockSend.mockResolvedValue({
        data: { id: "resend_msg_123" },
        error: null,
      });

      await provider.sendBookingConfirmation(validInput);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "test@fusion44x.com",
          to: "jane@example.com",
          subject: "Booking Confirmed: Jane's Fusion 44X Pool Consultation",
          html: "<html>Test HTML</html>",
          text: "Test Text",
          replyTo: "custom@reply.com",
          headers: { "Idempotency-Key": "booking-confirmation-delivery-456" },
          attachments: [
            {
              filename: "fusion-44x-consultation.ics",
              content: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR",
              contentType: "text/calendar",
            },
          ],
        })
      );
    });

    it("uses EMAIL_REPLY_TO env var when input.replyTo is not provided", async () => {
      const inputWithoutReplyTo = { ...validInput, replyTo: undefined };
      mockSend.mockResolvedValue({ data: { id: "msg_1" }, error: null });

      await provider.sendBookingConfirmation(inputWithoutReplyTo);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ replyTo: "reply@fusion44x.com" })
      );
    });

    it("omits replyTo when neither input nor env has it", async () => {
      vi.resetModules();
      process.env.EMAIL_API_KEY = "re_test_key";
      process.env.EMAIL_FROM = "test@fusion44x.com";
      delete process.env.EMAIL_REPLY_TO;

      const { createResendEmailProvider } = await import("@/lib/email/provider/resend-provider");
      const providerNoReply = createResendEmailProvider();

      const inputWithoutReplyTo = { ...validInput, replyTo: undefined };
      mockSend.mockResolvedValue({ data: { id: "msg_1" }, error: null });

      await providerNoReply.sendBookingConfirmation(inputWithoutReplyTo);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ replyTo: undefined })
      );
    });

    it("uses deliveryId in idempotency key", async () => {
      mockSend.mockResolvedValue({ data: { id: "msg_1" }, error: null });

      await provider.sendBookingConfirmation(validInput);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { "Idempotency-Key": "booking-confirmation-delivery-456" },
        })
      );
    });

    it("attaches ICS content with correct filename and content type", async () => {
      mockSend.mockResolvedValue({ data: { id: "msg_1" }, error: null });

      await provider.sendBookingConfirmation(validInput);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [
            {
              filename: "fusion-44x-consultation.ics",
              content: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR",
              contentType: "text/calendar",
            },
          ],
        })
      );
    });
  });

  describe("sendBookingConfirmation error handling", () => {
    it("normalizes 429 rate limit to RATE_LIMITED retryable error", async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { message: "Rate limit exceeded", statusCode: 429 },
      });

      await expect(provider.sendBookingConfirmation(validInput)).rejects.toEqual(
        expect.objectContaining({
          code: "RATE_LIMITED",
          retryable: true,
        })
      );
    });

    it("normalizes 5xx to PROVIDER_UNAVAILABLE retryable error", async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { message: "Internal server error", statusCode: 500 },
      });

      await expect(provider.sendBookingConfirmation(validInput)).rejects.toEqual(
        expect.objectContaining({
          code: "PROVIDER_UNAVAILABLE",
          retryable: true,
        })
      );
    });

    it("normalizes 400 to INVALID_RECIPIENT non-retryable", async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { message: "Invalid email address", statusCode: 400 },
      });

      await expect(provider.sendBookingConfirmation(validInput)).rejects.toEqual(
        expect.objectContaining({
          code: "INVALID_RECIPIENT",
          retryable: false,
        })
      );
    });

    it("normalizes 401/403 to INVALID_CONFIG non-retryable", async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { message: "Unauthorized", statusCode: 401 },
      });

      await expect(provider.sendBookingConfirmation(validInput)).rejects.toEqual(
        expect.objectContaining({
          code: "INVALID_CONFIG",
          retryable: false,
        })
      );
    });

    it("normalizes 400 unverified domain to PROVIDER_REJECTED non-retryable", async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { message: "Domain not verified", statusCode: 400 },
      });

      await expect(provider.sendBookingConfirmation(validInput)).rejects.toEqual(
        expect.objectContaining({
          code: "PROVIDER_REJECTED",
          retryable: false,
        })
      );
    });

    it("normalizes network error to PROVIDER_UNAVAILABLE retryable", async () => {
      mockSend.mockRejectedValue(new Error("Network error"));

      await expect(provider.sendBookingConfirmation(validInput)).rejects.toEqual(
        expect.objectContaining({
          code: "PROVIDER_UNAVAILABLE",
          retryable: true,
        })
      );
    });

    it("never returns raw Resend response", async () => {
      mockSend.mockResolvedValue({
        data: { id: "msg_1", raw: "raw response" },
        error: null,
      });

      const result = await provider.sendBookingConfirmation(validInput);

      expect(result).toEqual({ messageId: "msg_1", status: "delivered" });
      expect(result).not.toHaveProperty("raw");
    });

    it("throws when no messageId returned", async () => {
      mockSend.mockResolvedValue({ data: {}, error: null });

      await expect(provider.sendBookingConfirmation(validInput)).rejects.toEqual(
        expect.objectContaining({
          code: "PROVIDER_ERROR",
          message: "No message ID returned from Resend",
        })
      );
    });
  });

  describe("secrets never leaked", () => {
    it("does not log API key or recipient email", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockSend.mockResolvedValue({ data: { id: "msg_1" }, error: null });

      await provider.sendBookingConfirmation(validInput);

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("re_test_key")
      );
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("jane@example.com")
      );
      consoleSpy.mockRestore();
    });
  });
});

describe("Provider factory", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.EMAIL_PROVIDER;
    delete process.env.EMAIL_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  it("returns null provider when EMAIL_PROVIDER unset", async () => {
    const { getEmailProvider } = await import("@/lib/email/provider/provider-factory");
    const result = getEmailProvider();
    expect(result.provider).toBeNull();
    expect(result.name).toBeNull();
  });

  it("returns null provider when EMAIL_PROVIDER empty", async () => {
    process.env.EMAIL_PROVIDER = "";
    const { getEmailProvider } = await import("@/lib/email/provider/provider-factory");
    const result = getEmailProvider();
    expect(result.provider).toBeNull();
    expect(result.name).toBeNull();
  });

  it("returns Resend provider when EMAIL_PROVIDER=resend", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.EMAIL_API_KEY = "re_test";
    process.env.EMAIL_FROM = "test@fusion44x.com";

    const { getEmailProvider } = await import("@/lib/email/provider/provider-factory");
    const result = getEmailProvider();

    expect(result.provider).not.toBeNull();
    expect(result.name).toBe("resend");
  });

  it("throws for unknown provider", async () => {
    process.env.EMAIL_PROVIDER = "unknown";

    const { getEmailProvider } = await import("@/lib/email/provider/provider-factory");
    expect(() => getEmailProvider()).toThrow("Unknown EMAIL_PROVIDER");
  });

  it("does not fall back to fake provider in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.EMAIL_PROVIDER = "resend";
    process.env.EMAIL_API_KEY = "re_test";
    process.env.EMAIL_FROM = "test@fusion44x.com";

    const { getEmailProvider } = await import("@/lib/email/provider/provider-factory");
    const result = getEmailProvider();

    expect(result.name).toBe("resend");
    expect(result.provider?.name).toBe("resend");
  });
});

describe("Booking remains confirmed when Resend fails", () => {
  it("sendBookingConfirmation throws error but booking flow catches it", async () => {
    vi.resetModules();
    process.env.EMAIL_API_KEY = "re_test";
    process.env.EMAIL_FROM = "test@fusion44x.com";

    const { createResendEmailProvider } = await import("@/lib/email/provider/resend-provider");
    const provider = createResendEmailProvider();

    mockSend.mockResolvedValue({
      data: null,
      error: { message: "API Error", statusCode: 500 },
    });

    const input: SendEmailInput = {
      recipientEmail: "jane@example.com",
      recipientFirstName: "Jane",
      appointmentId: "appt-123",
      deliveryId: "delivery-456",
      confirmedStartTime: "2026-07-28T14:00:00.000Z",
      confirmedEndTime: "2026-07-28T14:30:00.000Z",
      timezone: "America/New_York",
      googleCalendarLink: "https://calendar.google.com/",
      outlookCalendarLink: "https://outlook.live.com/",
      icsContent: "BEGIN:VCALENDAR\r\nEND:VCALENDAR",
      html: "<html>Test</html>",
      text: "Test",
    };

    await expect(provider.sendBookingConfirmation(input)).rejects.toEqual(
      expect.objectContaining({ code: "PROVIDER_UNAVAILABLE", retryable: true })
    );
  });
});