import "server-only";
import { getServerSupabaseClient } from "@/lib/supabase";

type EmailDeliveryStatus = "pending" | "processing" | "delivered" | "failed" | "dead_letter";

export interface EmailDeliveryRecord {
  id: string;
  appointment_id: string;
  destination: "email";
  event_type: "booking_confirmation";
  event_id: string | null;
  status: EmailDeliveryStatus;
  attempt_count: number;
  template_version: string;
  provider_message_id: string | null;
  error_message: string | null;
  next_attempt_at: string | null;
}

interface ClaimResult {
  claimed: boolean;
  delivery?: EmailDeliveryRecord;
}

export async function findEmailDelivery(
  appointmentId: string,
  templateVersion: string,
): Promise<EmailDeliveryRecord | null> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from("integration_deliveries")
    .select("*")
    .eq("appointment_id", appointmentId)
    .eq("destination", "email")
    .eq("event_type", "booking_confirmation")
    .eq("template_version", templateVersion)
    .maybeSingle();

  if (error) {
    throw new Error(`Email delivery lookup failed: ${error.code}`);
  }

  return data as EmailDeliveryRecord | null;
}

export async function createPendingEmailDelivery(params: {
  appointmentId: string;
  bookingEventId: string | null;
  templateVersion: string;
}): Promise<string> {
  const supabase = getServerSupabaseClient();

  const existing = await findEmailDelivery(
    params.appointmentId,
    params.templateVersion,
  );
  if (existing) {
    return existing.id;
  }

  const { data, error } = await supabase
    .from("integration_deliveries")
    .insert({
      appointment_id: params.appointmentId,
      destination: "email" as never,
      event_type: "booking_confirmation" as never,
      event_id: params.bookingEventId,
      status: "pending" as never,
      attempt_count: 0,
      template_version: params.templateVersion,
      provider_message_id: null,
      error_message: null,
      next_attempt_at: null,
    } as never)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      // Unique violation - race condition, load existing
      const existing = await findEmailDelivery(
        params.appointmentId,
        params.templateVersion,
      );
      if (existing) {
        return existing.id;
      }
    }
    throw new Error(`Email delivery insert failed: ${error.code}`);
  }

  return (data as { id: string }).id;
}

export async function claimEmailDelivery(
  deliveryId: string,
  maxAttempts = 5,
): Promise<ClaimResult> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase.rpc("claim_email_delivery", {
    p_delivery_id: deliveryId,
    p_max_attempts: maxAttempts,
  } as never);

  if (error) {
    throw new Error(`Claim email delivery failed: ${error.code}`);
  }

  const claimed = data as boolean;
  if (!claimed) {
    return { claimed: false };
  }

  // Fetch the updated delivery record
  const { data: delivery, error: fetchError } = await supabase
    .from("integration_deliveries")
    .select("*")
    .eq("id", deliveryId)
    .single();

  if (fetchError || !delivery) {
    return { claimed: true };
  }

  return { claimed: true, delivery: delivery as EmailDeliveryRecord };
}

export async function markEmailDeliveryDelivered(params: {
  deliveryId: string;
  providerMessageId?: string;
}): Promise<void> {
  const supabase = getServerSupabaseClient();
  const { error } = await supabase.rpc("mark_email_delivery_delivered", {
    p_delivery_id: params.deliveryId,
    p_provider_message_id: params.providerMessageId ?? null,
  } as never);

  if (error) {
    throw new Error(`Failed to mark email delivery delivered: ${error.code}`);
  }
}

export async function markEmailDeliveryFailed(params: {
  deliveryId: string;
  safeErrorCode: string;
  retryable: boolean;
}): Promise<void> {
  const supabase = getServerSupabaseClient();
  const { error } = await supabase.rpc("mark_email_delivery_failed", {
    p_delivery_id: params.deliveryId,
    p_safe_error_code: params.safeErrorCode,
    p_retryable: params.retryable,
  } as never);

  if (error) {
    throw new Error(`Failed to mark email delivery failed: ${error.code}`);
  }
}