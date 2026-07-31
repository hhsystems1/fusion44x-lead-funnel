import "server-only";
import { EMAIL_CONFIG } from "@/config/email";
import type { EmailProvider, SendEmailResult } from "@/lib/email/provider/types";
import { findEmailDelivery } from "@/lib/email/delivery";
import {
  findFollowUpEmailDelivery,
  createPendingFollowUpEmailDelivery,
  listDueFollowUpEmailDeliveries,
  claimFollowUpEmailDelivery,
  markFollowUpEmailDeliveryDelivered,
  markFollowUpEmailDeliveryFailed,
} from "@/lib/email/follow-up-delivery";
import { buildBookingFollowUpSendInput } from "./follow-up-send-input";
import type { InternalDiagnosticLabels } from "./templates/internal-booking-notification";
import { answerLabel, answerLabels } from "@/lib/funnel/answer-labels";

export const FOLLOW_UP_DELAY_MS = 5 * 60 * 1000;
export const FOLLOW_UP_TEMPLATE_VERSION = "1.0.0";
export const FOLLOW_UP_MAX_ATTEMPTS = 5;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PreparedFollowUp {
  appointmentId: string;
  leadId: string;
  recipientEmail: string;
  recipientFirstName: string;
  confirmedStartTime: string;
  confirmedEndTime: string;
  timezone: string;
  bookingEventId: string | null;
  diagnostic: InternalDiagnosticLabels | null;
}

export interface SendDueFollowUpsResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}

export async function prepareBookingFollowUp(params: {
  appointmentId: string;
}): Promise<PreparedFollowUp | null> {
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
    .select(
      "first_name, email, water_feature, installation_type, pool_size, current_treatment, primary_goal",
    )
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

  return {
    appointmentId: row.id as string,
    leadId,
    recipientEmail: email,
    recipientFirstName: firstName,
    confirmedStartTime: row.start_time as string,
    confirmedEndTime: row.end_time as string,
    timezone: (row.timezone as string) || EMAIL_CONFIG.TIMEZONE,
    bookingEventId: (row.booking_event_id as string) ?? null,
    diagnostic,
  };
}

export async function scheduleBookingFollowUp(params: {
  appointmentId: string;
}): Promise<string | null> {
  const prepared = await prepareBookingFollowUp(params);
  if (!prepared) {
    return null;
  }

  const existingDelivery = await findFollowUpEmailDelivery(
    params.appointmentId,
    FOLLOW_UP_TEMPLATE_VERSION,
  );
  if (existingDelivery && existingDelivery.status !== "failed") {
    return existingDelivery.id;
  }

  const nextAttemptAt = new Date(Date.now() + FOLLOW_UP_DELAY_MS).toISOString();

  try {
    const deliveryId = await createPendingFollowUpEmailDelivery({
      appointmentId: params.appointmentId,
      bookingEventId: prepared.bookingEventId,
      templateVersion: FOLLOW_UP_TEMPLATE_VERSION,
      nextAttemptAt,
    });
    return deliveryId;
  } catch {
    return null;
  }
}

type ConfirmationStatus =
  | { state: "delivered" }
  | { state: "pending" }
  | { state: "terminal" };

async function getConfirmationStatus(
  appointmentId: string,
): Promise<ConfirmationStatus> {
  const confirmation = await findEmailDelivery(
    appointmentId,
    EMAIL_CONFIG.TEMPLATE_VERSION,
  );

  if (!confirmation || confirmation.status === "dead_letter") {
    return { state: "terminal" };
  }

  if (confirmation.status === "delivered") {
    return { state: "delivered" };
  }

  if (confirmation.attempt_count >= 5) {
    return { state: "terminal" };
  }

  return { state: "pending" };
}

export async function sendDueBookingFollowUps(params: {
  provider: EmailProvider;
}): Promise<SendDueFollowUpsResult> {
  const dueDeliveries = await listDueFollowUpEmailDeliveries();

  const result: SendDueFollowUpsResult = {
    processed: dueDeliveries.length,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  for (const delivery of dueDeliveries) {
    // Only send once the original confirmation email was actually delivered.
    const confirmationStatus = await getConfirmationStatus(
      delivery.appointment_id,
    );
    if (confirmationStatus.state !== "delivered") {
      await markFollowUpEmailDeliveryFailed({
        deliveryId: delivery.id,
        safeErrorCode: "CONFIRMATION_NOT_DELIVERED",
        retryable: confirmationStatus.state === "pending",
      });
      result.skipped += 1;
      continue;
    }

    const prepared = await prepareBookingFollowUp({
      appointmentId: delivery.appointment_id,
    });
    if (!prepared) {
      await markFollowUpEmailDeliveryFailed({
        deliveryId: delivery.id,
        safeErrorCode: "APPOINTMENT_NOT_CONFIRMED",
        retryable: false,
      });
      result.skipped += 1;
      continue;
    }

    const claim = await claimFollowUpEmailDelivery(
      delivery.id,
      FOLLOW_UP_MAX_ATTEMPTS,
    );
    if (!claim.claimed || !claim.delivery) {
      result.skipped += 1;
      continue;
    }

    const sendInput = buildBookingFollowUpSendInput(prepared, delivery.id);

    try {
      const sendResult: SendEmailResult =
        await params.provider.sendBookingFollowUp(sendInput);

      await markFollowUpEmailDeliveryDelivered({
        deliveryId: delivery.id,
        providerMessageId: sendResult.messageId,
      });
      result.sent += 1;
    } catch (err) {
      const error = err as { code?: string; message?: string; retryable?: boolean };
      const safeCode = error?.code ?? "PROVIDER_ERROR";
      const retryable = error?.retryable !== false;

      await markFollowUpEmailDeliveryFailed({
        deliveryId: delivery.id,
        safeErrorCode: safeCode,
        retryable,
      });
      result.failed += 1;
    }
  }

  return result;
}
