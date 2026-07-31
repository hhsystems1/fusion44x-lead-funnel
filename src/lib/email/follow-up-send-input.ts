import "server-only";
import { EMAIL_CONFIG } from "@/config/email";
import { renderBookingFollowUpHtml, renderBookingFollowUpText } from "@/lib/email/templates/booking-followup";
import type { PreparedFollowUp } from "./follow-up";
import type { SendEmailInput } from "./provider/types";

export function buildBookingFollowUpSendInput(
  prepared: PreparedFollowUp,
  deliveryId: string,
): SendEmailInput {
  const html = renderBookingFollowUpHtml({
    recipientFirstName: prepared.recipientFirstName,
    confirmedStartTime: prepared.confirmedStartTime,
    confirmedEndTime: prepared.confirmedEndTime,
    timezone: prepared.timezone,
    diagnostic: prepared.diagnostic ?? undefined,
  });

  const text = renderBookingFollowUpText({
    recipientFirstName: prepared.recipientFirstName,
    confirmedStartTime: prepared.confirmedStartTime,
    confirmedEndTime: prepared.confirmedEndTime,
    timezone: prepared.timezone,
    diagnostic: prepared.diagnostic ?? undefined,
  });

  return {
    recipientEmail: prepared.recipientEmail,
    recipientFirstName: prepared.recipientFirstName,
    appointmentId: prepared.appointmentId,
    deliveryId,
    confirmedStartTime: prepared.confirmedStartTime,
    confirmedEndTime: prepared.confirmedEndTime,
    timezone: prepared.timezone,
    html,
    text,
    replyTo: EMAIL_CONFIG.REPLY_TO_PLACEHOLDER,
    followUpDiagnostic: prepared.diagnostic ?? undefined,
  };
}
