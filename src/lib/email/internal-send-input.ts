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
    customerLastName: prepared.customerLastName ?? undefined,
    customerEmail: prepared.customerEmail,
    customerPhone,
    zipCode: prepared.zipCode ?? undefined,
    preferredContactMethod: prepared.preferredContactMethod ?? undefined,
    confirmedStartTime: prepared.confirmedStartTime,
    confirmedEndTime: prepared.confirmedEndTime,
    timezone: prepared.timezone,
    appointmentId: prepared.appointmentId,
    googleCalendarEventId,
    diagnostic: prepared.diagnostic ?? undefined,
  });

  const text = renderInternalBookingNotificationText({
    customerFirstName: prepared.customerFirstName,
    customerLastName: prepared.customerLastName ?? undefined,
    customerEmail: prepared.customerEmail,
    customerPhone,
    zipCode: prepared.zipCode ?? undefined,
    preferredContactMethod: prepared.preferredContactMethod ?? undefined,
    confirmedStartTime: prepared.confirmedStartTime,
    confirmedEndTime: prepared.confirmedEndTime,
    timezone: prepared.timezone,
    appointmentId: prepared.appointmentId,
    googleCalendarEventId,
    diagnostic: prepared.diagnostic ?? undefined,
  });

  return {
    recipientEmail: prepared.recipientEmail,
    recipientFirstName: prepared.customerFirstName,
    customerLastName: prepared.customerLastName ?? undefined,
    customerEmail: prepared.customerEmail,
    customerPhone,
    zipCode: prepared.zipCode ?? undefined,
    appointmentId: prepared.appointmentId,
    deliveryId,
    confirmedStartTime: prepared.confirmedStartTime,
    confirmedEndTime: prepared.confirmedEndTime,
    timezone: prepared.timezone,
    googleCalendarLink: undefined,
    outlookCalendarLink: undefined,
    icsContent: googleCalendarEventId ?? undefined,
    preferredContactMethod: prepared.preferredContactMethod ?? undefined,
    html,
    text,
    replyTo: undefined,
    internalDiagnostic: prepared.diagnostic ?? undefined,
    internalNotificationType: prepared.notificationType,
  };
}