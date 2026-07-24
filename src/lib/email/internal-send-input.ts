import "server-only";
import { renderInternalBookingNotificationHtml, renderInternalBookingNotificationText } from "@/lib/email/templates/internal-booking-notification";
import type { PreparedInternalNotification } from "./internal-notifications";
import type { SendEmailInput } from "./provider/types";

export function buildInternalBookingNotificationSendInput(
  prepared: PreparedInternalNotification,
  deliveryId: string,
): SendEmailInput {
  const customerPhone = prepared.customerPhone ?? undefined;
  const googleCalendarEventId = prepared.googleCalendarEventId ?? undefined;

  const html = renderInternalBookingNotificationHtml({
    customerFirstName: prepared.customerFirstName,
    customerEmail: prepared.customerEmail,
    customerPhone,
    confirmedStartTime: prepared.confirmedStartTime,
    confirmedEndTime: prepared.confirmedEndTime,
    timezone: prepared.timezone,
    appointmentId: prepared.appointmentId,
    googleCalendarEventId,
  });

  const text = renderInternalBookingNotificationText({
    customerFirstName: prepared.customerFirstName,
    customerEmail: prepared.customerEmail,
    customerPhone,
    confirmedStartTime: prepared.confirmedStartTime,
    confirmedEndTime: prepared.confirmedEndTime,
    timezone: prepared.timezone,
    appointmentId: prepared.appointmentId,
    googleCalendarEventId,
  });

  return {
    recipientEmail: prepared.recipientEmail,
    recipientFirstName: prepared.customerFirstName,
    appointmentId: prepared.appointmentId,
    deliveryId,
    confirmedStartTime: prepared.confirmedStartTime,
    confirmedEndTime: prepared.confirmedEndTime,
    timezone: prepared.timezone,
    googleCalendarLink: prepared.customerEmail,
    outlookCalendarLink: customerPhone ?? "",
    icsContent: googleCalendarEventId ?? "",
    html,
    text,
    replyTo: undefined,
  };
}