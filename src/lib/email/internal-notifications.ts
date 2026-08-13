import "server-only";
import { EMAIL_CONFIG } from "@/config/email";
import type { EmailProvider, SendEmailResult, ProviderError } from "@/lib/email/provider/types";
import {
  findInternalEmailDelivery,
  createPendingInternalEmailDelivery,
  claimInternalEmailDelivery,
  markInternalEmailDeliveryDelivered,
  markInternalEmailDeliveryFailed,
} from "@/lib/email/internal-delivery";
import { buildInternalBookingNotificationSendInput } from "./internal-send-input";
import type { InternalDiagnosticLabels } from "./templates/internal-booking-notification";
import { answerLabel, answerLabels } from "@/lib/funnel/answer-labels";

export type InternalNotificationType = "contact_submission" | "booking_confirmation";

export interface PreparedInternalNotification {
  notificationType: InternalNotificationType;
  appointmentId: string;
  leadId: string;
  recipientEmail: string;
  customerFirstName: string;
  customerLastName?: string | null;
  customerEmail: string;
  customerPhone: string | null;
  zipCode?: string | null;
  preferredContactMethod?: string | null;
  confirmedStartTime: string;
  confirmedEndTime: string;
  timezone: string;
  bookingEventId: string | null;
  googleCalendarEventId: string | null;
  diagnostic: InternalDiagnosticLabels | null;
}

export type SendInternalNotificationStatus =
  | "delivered"
  | "in_progress"
  | "not_due"
  | "max_attempts"
  | "dead_letter"
  | "prepared"
  | "disabled";

export interface SendInternalNotificationResult {
  deliveryId: string;
  status: SendInternalNotificationStatus;
  messageId?: string;
}

export type SendInternalNotificationError = ProviderError;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function prepareInternalBookingNotification(params: {
  appointmentId: string;
}): Promise<PreparedInternalNotification | null> {
  const supabase = (await import("@/lib/supabase")).getServerSupabaseClient();

  const { data: appointment, error: appError } = await supabase
    .from("appointments")
    .select("id, lead_id, status, start_time, end_time, timezone, booking_event_id, external_event_id")
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
    .select(
      "first_name, last_name, email, phone, zip_code, water_feature, installation_type, pool_size, current_treatment, primary_goal",
    )
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    return null;
  }

  const leadRow = lead as Record<string, unknown>;
  const customerEmail = (leadRow.email as string) ?? "";
  const customerFirstName = ((leadRow.first_name as string) ?? "").trim();
  const customerLastName = ((leadRow.last_name as string) ?? "").trim();
  const customerPhone = (leadRow.phone as string)?.trim() ?? null;
  const zipCode = ((leadRow.zip_code as string) ?? "").trim();

  if (!EMAIL_REGEX.test(customerEmail)) {
    return null;
  }

  const { data: answerRows } = await supabase
    .from("lead_answers")
    .select("answer_code")
    .eq("lead_id", leadId)
    .eq("question_id", "current-issues");

  const currentIssues = ((answerRows ?? []) as Record<string, unknown>[]).map(
    (a) => (a.answer_code as string) ?? "",
  );

  const diagnostic: InternalDiagnosticLabels = {
    waterFeature: answerLabel("water-feature", (leadRow.water_feature as string) ?? ""),
    installationType: answerLabel("installation-type", (leadRow.installation_type as string) ?? ""),
    poolSize: answerLabel("pool-size", (leadRow.pool_size as string) ?? ""),
    currentTreatment: answerLabel("current-treatment", (leadRow.current_treatment as string) ?? ""),
    primaryGoal: answerLabel("primary-goal", (leadRow.primary_goal as string) ?? ""),
    currentIssues: answerLabels("current-issues", currentIssues),
  };

  // Get internal notification recipient
  const internalRecipient = process.env.INTERNAL_BOOKING_NOTIFICATION_TO?.trim();
  if (!internalRecipient || !EMAIL_REGEX.test(internalRecipient)) {
    return null;
  }

  return {
    notificationType: "booking_confirmation",
    appointmentId: row.id as string,
    leadId,
    recipientEmail: internalRecipient,
    customerFirstName,
    customerLastName,
    customerEmail,
    customerPhone,
    zipCode,
    confirmedStartTime: row.start_time as string,
    confirmedEndTime: row.end_time as string,
    timezone: (row.timezone as string) || EMAIL_CONFIG.TIMEZONE,
    bookingEventId: (row.booking_event_id as string) ?? null,
    googleCalendarEventId: (row.external_event_id as string) ?? null,
    diagnostic,
  };
}

export async function sendInternalBookingNotification(
  prepared: PreparedInternalNotification,
  provider: EmailProvider,
): Promise<SendInternalNotificationResult | SendInternalNotificationError> {
  const { appointmentId, recipientEmail, bookingEventId } = prepared;

  if (!EMAIL_REGEX.test(recipientEmail)) {
    return {
      code: "INVALID_RECIPIENT",
      message: "Invalid internal notification recipient email address",
      retryable: false,
    };
  }

  const templateVersion = "1.0.0";

  const existingDelivery = await findInternalEmailDelivery(appointmentId, templateVersion);

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
      deliveryId = await createPendingInternalEmailDelivery({
        appointmentId,
        bookingEventId,
        templateVersion,
      });
    } catch {
      // Race condition: another request created it
      const retryDelivery = await findInternalEmailDelivery(appointmentId, templateVersion);
      if (retryDelivery) {
        deliveryId = retryDelivery.id;
      } else {
        return {
          code: "DELIVERY_CREATE_FAILED",
          message: "Failed to create internal delivery record",
          retryable: false,
        };
      }
    }
  }

  // Try to atomically claim the delivery for processing
  const claim = await claimInternalEmailDelivery(deliveryId);
  if (!claim.claimed || !claim.delivery) {
    // Not eligible: check specific reason
    const fresh = await findInternalEmailDelivery(appointmentId, templateVersion);
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

  const sendInput = buildInternalBookingNotificationSendInput(prepared, deliveryId);

  let result: SendEmailResult;
  try {
    result = await provider.sendInternalBookingNotification(sendInput);
  } catch (err) {
    const error = err as { code?: string; message?: string; retryable?: boolean };
    const safeCode = error?.code ?? "PROVIDER_ERROR";
    const retryable = error?.retryable !== false;

    await markInternalEmailDeliveryFailed({
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

  await markInternalEmailDeliveryDelivered({
    deliveryId,
    providerMessageId: result.messageId,
  });

  return {
    deliveryId,
    status: "delivered",
    messageId: result.messageId,
  };
}

export async function sendContactSubmissionInternalNotification(params: {
  leadId: string;
  customerFirstName: string;
  customerEmail: string;
  customerPhone?: string | null;
  preferredContactMethod?: string | null;
  diagnostic: InternalDiagnosticLabels | null;
}, provider: EmailProvider): Promise<void> {
  const internalRecipient = process.env.INTERNAL_BOOKING_NOTIFICATION_TO?.trim();
  if (!internalRecipient || !EMAIL_REGEX.test(internalRecipient)) {
    return;
  }

  const prepared: PreparedInternalNotification = {
    notificationType: "contact_submission",
    appointmentId: params.leadId,
    leadId: params.leadId,
    recipientEmail: internalRecipient,
    customerFirstName: params.customerFirstName,
    customerEmail: params.customerEmail,
    customerPhone: params.customerPhone ?? null,
    preferredContactMethod: params.preferredContactMethod ?? null,
    confirmedStartTime: "",
    confirmedEndTime: "",
    timezone: EMAIL_CONFIG.TIMEZONE,
    bookingEventId: null,
    googleCalendarEventId: null,
    diagnostic: params.diagnostic,
  };

  try {
    const sendInput = buildInternalBookingNotificationSendInput(prepared, `contact-${params.leadId}`);
    await provider.sendInternalBookingNotification(sendInput);
  } catch {
    // Best-effort only; contact submission should not fail the lead flow.
  }
}

export async function schedulePendingInternalEmailDelivery(params: {
  appointmentId: string;
}): Promise<string | null> {
  const prepared = await prepareInternalBookingNotification(params);
  if (!prepared) {
    return null;
  }

  const templateVersion = "1.0.0";
  const existingDelivery = await findInternalEmailDelivery(
    params.appointmentId,
    templateVersion,
  );
  if (existingDelivery && existingDelivery.status !== "failed") {
    return existingDelivery.id;
  }

  try {
    const deliveryId = await createPendingInternalEmailDelivery({
      appointmentId: params.appointmentId,
      bookingEventId: prepared.bookingEventId,
      templateVersion,
    });
    return deliveryId;
  } catch {
    return null;
  }
}