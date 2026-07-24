import "server-only";
import { EMAIL_CONFIG } from "@/config/email";
import type { EmailProvider, SendEmailResult, ProviderError } from "@/lib/email/provider/types";
import {
  findEmailDelivery,
  createPendingEmailDelivery,
  claimEmailDelivery,
  markEmailDeliveryDelivered,
  markEmailDeliveryFailed,
} from "@/lib/email/delivery";
import { buildBookingConfirmationSendInput } from "./send-input";

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

export type SendConfirmationStatus =
  | "delivered"
  | "in_progress"
  | "not_due"
  | "max_attempts"
  | "dead_letter"
  | "prepared";

export interface SendConfirmationResult {
  deliveryId: string;
  status: SendConfirmationStatus;
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
  const { appointmentId, recipientEmail, bookingEventId } = prepared;

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

  // Dead letter - terminal state
  if (existingDelivery?.status === "dead_letter") {
    return {
      deliveryId: existingDelivery.id,
      status: "dead_letter",
    };
  }

  // Max attempts reached
  if (existingDelivery && existingDelivery.attempt_count >= 5) {
    return {
      deliveryId: existingDelivery.id,
      status: "max_attempts",
    };
  }

  // Not yet due for retry
  if (existingDelivery?.next_attempt_at && new Date(existingDelivery.next_attempt_at) > new Date()) {
    return {
      deliveryId: existingDelivery.id,
      status: "not_due",
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
    // Not eligible: check specific reason
    const fresh = await findEmailDelivery(appointmentId, templateVersion);
    if (!fresh) {
      return { deliveryId, status: "in_progress" };
    }
    if (fresh.status === "delivered") {
      return { deliveryId: fresh.id, status: "delivered", messageId: fresh.provider_message_id ?? undefined };
    }
    if (fresh.status === "processing") {
      return { deliveryId: fresh.id, status: "in_progress" };
    }
    if (fresh.status === "dead_letter") {
      return { deliveryId: fresh.id, status: "dead_letter" };
    }
    if (fresh.attempt_count >= 5) {
      return { deliveryId: fresh.id, status: "max_attempts" };
    }
    if (fresh.next_attempt_at && new Date(fresh.next_attempt_at) > new Date()) {
      return { deliveryId: fresh.id, status: "not_due" };
    }
    return { deliveryId, status: "in_progress" };
  }

  const sendInput = buildBookingConfirmationSendInput(prepared, deliveryId);

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