import "server-only";
import { EMAIL_CONFIG } from "@/config/email";
import {
  generateGoogleCalendarUrl,
  generateOutlookWebUrl,
  generateIcsContent,
} from "@/lib/booking/calendar-links";
import type { SendEmailInput, EmailProvider, SendEmailResult, ProviderError } from "@/lib/email/provider/types";
import {
  findEmailDelivery,
  createPendingEmailDelivery,
  claimEmailDelivery,
  markEmailDeliveryDelivered,
  markEmailDeliveryFailed,
} from "@/lib/email/delivery";
import { calculateEndTime } from "@/lib/booking/slots";

export interface PreparedConfirmation {
  appointmentId: string;
  leadId: string;
  recipientEmail: string;
  recipientFirstName: string;
  confirmedStartTime: string;
  confirmedEndTime: string;
  timezone: string;
  bookingEventId: string | null;
}

export interface SendConfirmationResult {
  deliveryId: string;
  status: "delivered" | "prepared" | "in_progress";
  messageId?: string;
}

export type SendConfirmationError = ProviderError;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function prepareBookingConfirmation(params: {
  appointmentId: string;
}): Promise<PreparedConfirmation | null> {
  const supabase = (await import("@/lib/supabase")).getServerSupabaseClient();

  const { data: appointment, error: appError } = await supabase
    .from("appointments")
    .select("id, lead_id, status, start_time, end_time, timezone, booking_event_id")
    .eq("id", params.appointmentId)
    .single();

  if (appError || !appointment) {
    return null;
  }

  const row = appointment as Record<string, unknown>;

  if (row.status !== "confirmed") {
    return null;
  }

  const leadId = row.lead_id as string;
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("first_name, email")
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    return null;
  }

  const leadRow = lead as Record<string, unknown>;
  const email = (leadRow.email as string) ?? "";
  const firstName = ((leadRow.first_name as string) ?? "").trim();

  if (!EMAIL_REGEX.test(email)) {
    return null;
  }

  return {
    appointmentId: row.id as string,
    leadId,
    recipientEmail: email,
    recipientFirstName: firstName,
    confirmedStartTime: row.start_time as string,
    confirmedEndTime: row.end_time as string,
    timezone: (row.timezone as string) || EMAIL_CONFIG.TIMEZONE,
    bookingEventId: (row.booking_event_id as string) ?? null,
  };
}

export async function sendBookingConfirmation(
  prepared: PreparedConfirmation,
  provider: EmailProvider,
): Promise<SendConfirmationResult | SendConfirmationError> {
  const {
    appointmentId,
    recipientEmail,
    recipientFirstName,
    confirmedStartTime,
    confirmedEndTime,
    timezone,
    bookingEventId,
  } = prepared;

  if (!EMAIL_REGEX.test(recipientEmail)) {
    return {
      code: "INVALID_RECIPIENT",
      message: "Invalid recipient email address",
      retryable: false,
    };
  }

  const templateVersion = EMAIL_CONFIG.TEMPLATE_VERSION;

  const existingDelivery = await findEmailDelivery(appointmentId, templateVersion);

  // Already delivered - idempotent success
  if (existingDelivery?.status === "delivered") {
    return {
      deliveryId: existingDelivery.id,
      status: "delivered",
      messageId: existingDelivery.provider_message_id ?? undefined,
    };
  }

  // In progress - don't send concurrently
  if (existingDelivery?.status === "processing") {
    return {
      deliveryId: existingDelivery.id,
      status: "in_progress",
    };
  }

  // Pending or failed - try to claim and send
  let deliveryId: string;

  if (existingDelivery) {
    deliveryId = existingDelivery.id;
  } else {
    // Create new pending delivery
    try {
      deliveryId = await createPendingEmailDelivery({
        appointmentId,
        bookingEventId,
        templateVersion,
      });
    } catch {
      // Race condition: another request created it
      const retryDelivery = await findEmailDelivery(appointmentId, templateVersion);
      if (retryDelivery) {
        deliveryId = retryDelivery.id;
      } else {
        return {
          code: "DELIVERY_CREATE_FAILED",
          message: "Failed to create delivery record",
          retryable: false,
        };
      }
    }
  }

  // Try to atomically claim the delivery for processing
  const claim = await claimEmailDelivery(deliveryId);
  if (!claim.claimed || !claim.delivery) {
    // Not eligible for retry (delivered, dead_letter, max attempts, not due, etc.)
    return {
      deliveryId,
      status: "in_progress",
    };
  }

  const endTime = confirmedEndTime || calculateEndTime(confirmedStartTime);

  const googleCalendarLink = generateGoogleCalendarUrl({
    startTime: confirmedStartTime,
    endTime: endTime,
    title: EMAIL_CONFIG.CONSULTATION_TITLE,
  });

  const outlookCalendarLink = generateOutlookWebUrl({
    startTime: confirmedStartTime,
    endTime: endTime,
    title: EMAIL_CONFIG.CONSULTATION_TITLE,
  });

  const icsContent = generateIcsContent({
    startTime: confirmedStartTime,
    endTime: endTime,
    title: EMAIL_CONFIG.CONSULTATION_TITLE,
    organizer: EMAIL_CONFIG.REPLY_TO_PLACEHOLDER,
  });

  const sendInput: SendEmailInput = {
    recipientEmail,
    recipientFirstName,
    appointmentId,
    confirmedStartTime,
    confirmedEndTime: endTime,
    timezone,
    googleCalendarLink,
    outlookCalendarLink,
    icsContent,
    replyTo: EMAIL_CONFIG.REPLY_TO_PLACEHOLDER,
  };

  let result: SendEmailResult;
  try {
    result = await provider.sendBookingConfirmation(sendInput);
  } catch (err) {
    const error = err as { code?: string; message?: string; retryable?: boolean };
    const safeCode = error?.code ?? "PROVIDER_ERROR";
    const retryable = error?.retryable !== false;

    await markEmailDeliveryFailed({
      deliveryId,
      safeErrorCode: safeCode,
      retryable,
    });

    return {
      code: safeCode,
      message: error?.message ?? "Email provider error",
      retryable,
    };
  }

  await markEmailDeliveryDelivered({
    deliveryId,
    providerMessageId: result.messageId,
  });

  return {
    deliveryId,
    status: "delivered",
    messageId: result.messageId,
  };
}

export async function schedulePendingEmailDelivery(params: {
  appointmentId: string;
}): Promise<string | null> {
  const prepared = await prepareBookingConfirmation(params);
  if (!prepared) {
    return null;
  }

  const templateVersion = EMAIL_CONFIG.TEMPLATE_VERSION;
  const existingDelivery = await findEmailDelivery(
    params.appointmentId,
    templateVersion,
  );
  if (existingDelivery && existingDelivery.status !== "failed") {
    return existingDelivery.id;
  }

  try {
    const deliveryId = await createPendingEmailDelivery({
      appointmentId: params.appointmentId,
      bookingEventId: prepared.bookingEventId,
      templateVersion,
    });
    return deliveryId;
  } catch {
    return null;
  }
}