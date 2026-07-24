import "server-only";
import { Resend } from "resend";
import type { EmailProvider, SendEmailInput, SendEmailResult } from "./types";
import { renderBookingConfirmationHtml, renderBookingConfirmationText } from "@/lib/email/templates/booking-confirmation";

export function createResendEmailProvider(): EmailProvider {
  const apiKey = process.env.EMAIL_API_KEY;
  if (!apiKey) {
    throw new Error("EMAIL_API_KEY is required for Resend provider");
  }

  const fromAddress = process.env.EMAIL_FROM;
  if (!fromAddress) {
    throw new Error("EMAIL_FROM is required for Resend provider");
  }

  const resend = new Resend(apiKey);

  return {
    name: "resend",
    async sendBookingConfirmation(input: SendEmailInput): Promise<SendEmailResult> {
      const subject = `Booking Confirmed: ${input.recipientFirstName}'s Fusion 44X Pool Consultation`;

      const html = renderBookingConfirmationHtml({
        recipientFirstName: input.recipientFirstName,
        confirmedStartTime: input.confirmedStartTime,
        confirmedEndTime: input.confirmedEndTime,
        timezone: input.timezone,
        googleCalendarLink: input.googleCalendarLink,
        outlookCalendarLink: input.outlookCalendarLink,
        icsContent: input.icsContent,
      });

      const text = renderBookingConfirmationText({
        recipientFirstName: input.recipientFirstName,
        confirmedStartTime: input.confirmedStartTime,
        confirmedEndTime: input.confirmedEndTime,
        timezone: input.timezone,
        googleCalendarLink: input.googleCalendarLink,
        outlookCalendarLink: input.outlookCalendarLink,
        icsContent: input.icsContent,
      });

      const attachments: { filename: string; content: string; contentType: string }[] = [
        {
          filename: "fusion-44x-consultation.ics",
          content: input.icsContent,
          contentType: "text/calendar",
        },
      ];

      const idempotencyKey = `booking-confirmation-${input.deliveryId}`;

      const replyTo = input.replyTo?.trim() || process.env.EMAIL_REPLY_TO?.trim() || undefined;

      let data: { id?: string; error?: { message?: string; statusCode?: number } } | null = null;
      let error: Error | null = null;

      try {
        const response = await resend.emails.send({
          from: fromAddress,
          to: input.recipientEmail,
          replyTo,
          subject,
          html,
          text,
          attachments,
          headers: {
            "Idempotency-Key": idempotencyKey,
          },
        });

        data = response.data;
        error = response.error as Error | null;
      } catch (err) {
        error = err instanceof Error ? err : new Error(String(err));
      }

      if (error) {
        const statusCode = (error as { statusCode?: number }).statusCode ?? 0;
        const message = error.message ?? "Resend API error";

        if (statusCode === 429) {
          throw { code: "RATE_LIMITED", message, retryable: true };
        }
        if (statusCode >= 500 || statusCode === 0) {
          throw { code: "PROVIDER_UNAVAILABLE", message, retryable: true };
        }
        if (statusCode === 400) {
          const lowerMessage = message.toLowerCase();
          if (lowerMessage.includes("invalid")) {
            throw { code: "INVALID_RECIPIENT", message, retryable: false };
          }
          if (lowerMessage.includes("unverified") || lowerMessage.includes("domain")) {
            throw { code: "PROVIDER_REJECTED", message, retryable: false };
          }
          throw { code: "PROVIDER_REJECTED", message, retryable: false };
        }
        if (statusCode === 401 || statusCode === 403) {
          throw { code: "INVALID_CONFIG", message, retryable: false };
        }

        throw { code: "PROVIDER_ERROR", message, retryable: false };
      }

      if (!data?.id) {
        throw { code: "PROVIDER_ERROR", message: "No message ID returned from Resend", retryable: false };
      }

      return { messageId: data.id, status: "delivered" };
    },
  };
}