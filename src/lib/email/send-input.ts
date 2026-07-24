import "server-only";
import { EMAIL_CONFIG } from "@/config/email";
import {
  generateGoogleCalendarUrl,
  generateOutlookWebUrl,
  generateIcsContent,
} from "@/lib/booking/calendar-links";
import type { PreparedConfirmation } from "./notifications";
import type { SendEmailInput } from "./provider/types";

export function buildBookingConfirmationSendInput(
  prepared: PreparedConfirmation,
): SendEmailInput {
  const endTime = prepared.confirmedEndTime;

  const googleCalendarLink = generateGoogleCalendarUrl({
    startTime: prepared.confirmedStartTime,
    endTime,
    title: EMAIL_CONFIG.CONSULTATION_TITLE,
  });

  const outlookCalendarLink = generateOutlookWebUrl({
    startTime: prepared.confirmedStartTime,
    endTime,
    title: EMAIL_CONFIG.CONSULTATION_TITLE,
  });

  const icsContent = generateIcsContent({
    startTime: prepared.confirmedStartTime,
    endTime,
    title: EMAIL_CONFIG.CONSULTATION_TITLE,
    organizer: EMAIL_CONFIG.REPLY_TO_PLACEHOLDER,
  });

  return {
    recipientEmail: prepared.recipientEmail,
    recipientFirstName: prepared.recipientFirstName,
    appointmentId: prepared.appointmentId,
    confirmedStartTime: prepared.confirmedStartTime,
    confirmedEndTime: endTime,
    timezone: prepared.timezone,
    googleCalendarLink,
    outlookCalendarLink,
    icsContent,
    replyTo: EMAIL_CONFIG.REPLY_TO_PLACEHOLDER,
  };
}