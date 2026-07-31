import "server-only";
import { Resend } from "resend";
import type { EmailProvider, SendEmailInput, SendEmailResult } from "./types";
import { renderBookingConfirmationHtml, renderBookingConfirmationText } from "@/lib/email/templates/booking-confirmation";
import { renderInternalBookingNotificationHtml, renderInternalBookingNotificationText } from "@/lib/email/templates/internal-booking-notification";
import { renderBookingFollowUpHtml, renderBookingFollowUpText } from "@/lib/email/templates/booking-followup";

interface ResendSendParams {
  resend: Resend;
  fromAddress: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  replyTo?: string;
  attachments?: { filename: string; content: string; contentType: string }[];
}

async function sendViaResend(params: ResendSendParams): Promise<SendEmailResult> {
  const {
    resend,
    fromAddress,
    to,
    subject,
    html,
    text,
    idempotencyKey,
    replyTo,
    attachments,
  } = params;

  const headers: Record<string, string> = { "Idempotency-Key": idempotencyKey };

  let data: { id?: string; error?: { message?: string; statusCode?: number } } | null = null;
  let error: Error | null = null;

  try {
    const response = await resend.emails.send({
      from: fromAddress,
      to,
      replyTo,
      subject,
      html,
      text,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
      headers,
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
}

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

  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined;

  return {
    name: "resend",
    async sendBookingConfirmation(input: SendEmailInput): Promise<SendEmailResult> {
      const subject = `Booking Confirmed: ${input.recipientFirstName}'s Fusion 44X Pool Consultation`;

      const html = renderBookingConfirmationHtml({
        recipientFirstName: input.recipientFirstName,
        confirmedStartTime: input.confirmedStartTime,
        confirmedEndTime: input.confirmedEndTime,
        timezone: input.timezone,
        googleCalendarLink: input.googleCalendarLink ?? "",
        outlookCalendarLink: input.outlookCalendarLink ?? "",
        icsContent: input.icsContent ?? "",
      });

      const text = renderBookingConfirmationText({
        recipientFirstName: input.recipientFirstName,
        confirmedStartTime: input.confirmedStartTime,
        confirmedEndTime: input.confirmedEndTime,
        timezone: input.timezone,
        googleCalendarLink: input.googleCalendarLink ?? "",
        outlookCalendarLink: input.outlookCalendarLink ?? "",
        icsContent: input.icsContent ?? "",
      });

      const attachments: { filename: string; content: string; contentType: string }[] = [
        {
          filename: "fusion-44x-consultation.ics",
          content: input.icsContent ?? "",
          contentType: "text/calendar",
        },
      ];

      return sendViaResend({
        resend,
        fromAddress,
        to: input.recipientEmail,
        subject,
        html,
        text,
        idempotencyKey: `booking-confirmation-${input.deliveryId}`,
        replyTo: input.replyTo?.trim() || replyTo,
        attachments,
      });
    },
    async sendInternalBookingNotification(input: SendEmailInput): Promise<SendEmailResult> {
      const subject = `Internal: New Booking — ${input.recipientFirstName} (${input.appointmentId})`;

      const html = renderInternalBookingNotificationHtml({
        customerFirstName: input.recipientFirstName,
        customerEmail: input.googleCalendarLink ?? "", // using this field to pass customer email
        customerPhone: input.outlookCalendarLink || undefined, // using this field to pass customer phone
        confirmedStartTime: input.confirmedStartTime,
        confirmedEndTime: input.confirmedEndTime,
        timezone: input.timezone,
        appointmentId: input.appointmentId,
        googleCalendarEventId: input.icsContent || undefined, // using this field to pass Google Calendar event ID
        diagnostic: input.internalDiagnostic,
      });

      const text = renderInternalBookingNotificationText({
        customerFirstName: input.recipientFirstName,
        customerEmail: input.googleCalendarLink ?? "",
        customerPhone: input.outlookCalendarLink || undefined,
        confirmedStartTime: input.confirmedStartTime,
        confirmedEndTime: input.confirmedEndTime,
        timezone: input.timezone,
        appointmentId: input.appointmentId,
        googleCalendarEventId: input.icsContent || undefined,
        diagnostic: input.internalDiagnostic,
      });

      return sendViaResend({
        resend,
        fromAddress,
        to: input.recipientEmail,
        subject,
        html,
        text,
        idempotencyKey: `internal-booking-notification-${input.deliveryId}`,
        replyTo: input.replyTo?.trim() || replyTo,
      });
    },
    async sendBookingFollowUp(input: SendEmailInput): Promise<SendEmailResult> {
      const subject = `Get Ready for Your Fusion 44X Pool Consultation, ${input.recipientFirstName}`;

      const html = renderBookingFollowUpHtml({
        recipientFirstName: input.recipientFirstName,
        confirmedStartTime: input.confirmedStartTime,
        confirmedEndTime: input.confirmedEndTime,
        timezone: input.timezone,
        diagnostic: input.followUpDiagnostic,
      });

      const text = renderBookingFollowUpText({
        recipientFirstName: input.recipientFirstName,
        confirmedStartTime: input.confirmedStartTime,
        confirmedEndTime: input.confirmedEndTime,
        timezone: input.timezone,
        diagnostic: input.followUpDiagnostic,
      });

      return sendViaResend({
        resend,
        fromAddress,
        to: input.recipientEmail,
        subject,
        html,
        text,
        idempotencyKey: `booking-followup-${input.deliveryId}`,
        replyTo: input.replyTo?.trim() || replyTo,
      });
    },
  };
}
