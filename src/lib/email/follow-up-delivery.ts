import "server-only";
import { getServerSupabaseClient } from "@/lib/supabase";

type EmailDeliveryStatus = "pending" | "processing" | "delivered" | "failed" | "dead_letter";

export interface FollowUpEmailDeliveryRecord {
  id: string;
  appointment_id: string;
  destination: "email";
  event_type: "booking_followup";
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
  delivery?: FollowUpEmailDeliveryRecord;
}

export async function findFollowUpEmailDelivery(
  appointmentId: string,
  templateVersion: string,
): Promise<FollowUpEmailDeliveryRecord | null> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from("integration_deliveries")
    .select("*")
    .eq("appointment_id", appointmentId)
    .eq("destination", "email")
    .eq("event_type", "booking_followup")
    .eq("template_version", templateVersion)
    .maybeSingle();

  if (error) {
    throw new Error(`Follow-up email delivery lookup failed: ${error.code}`);
  }

  return data as FollowUpEmailDeliveryRecord | null;
}

export async function findFollowUpEmailDeliveryById(
  deliveryId: string,
): Promise<FollowUpEmailDeliveryRecord | null> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from("integration_deliveries")
    .select("*")
    .eq("id", deliveryId)
    .eq("destination", "email")
    .eq("event_type", "booking_followup")
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Follow-up email delivery lookup by ID failed: ${error.code}`);
  }

  return data as FollowUpEmailDeliveryRecord | null;
}

export async function createPendingFollowUpEmailDelivery(params: {
  appointmentId: string;
  bookingEventId: string | null;
  templateVersion: string;
  nextAttemptAt: string;
}): Promise<string> {
  const supabase = getServerSupabaseClient();

  const existing = await findFollowUpEmailDelivery(
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
      event_type: "booking_followup" as never,
      event_id: params.bookingEventId,
      status: "pending" as never,
      attempt_count: 0,
      template_version: params.templateVersion,
      provider_message_id: null,
      error_message: null,
      next_attempt_at: params.nextAttemptAt,
    } as never)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const existing = await findFollowUpEmailDelivery(
        params.appointmentId,
        params.templateVersion,
      );
      if (existing) {
        return existing.id;
      }
    }
    throw new Error(`Follow-up email delivery insert failed: ${error.code}`);
  }

  return (data as { id: string }).id;
}

export async function listDueFollowUpEmailDeliveries(): Promise<
  FollowUpEmailDeliveryRecord[]
> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from("integration_deliveries")
    .select("*")
    .eq("destination", "email")
    .eq("event_type", "booking_followup")
    .in("status", ["pending", "failed"])
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${new Date().toISOString()}`);

  if (error) {
    throw new Error(`List due follow-up email deliveries failed: ${error.code}`);
  }

  return (data ?? []) as FollowUpEmailDeliveryRecord[];
}

export async function claimFollowUpEmailDelivery(
  deliveryId: string,
  maxAttempts = 5,
): Promise<ClaimResult> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase.rpc("claim_email_delivery", {
    p_delivery_id: deliveryId,
    p_max_attempts: maxAttempts,
  } as never);

  if (error) {
    throw new Error(`Claim follow-up email delivery failed: ${error.code}`);
  }

  const rows = data as FollowUpEmailDeliveryRecord[];
  if (!rows || rows.length === 0) {
    return { claimed: false };
  }

  return { claimed: true, delivery: rows[0] };
}

export async function markFollowUpEmailDeliveryDelivered(params: {
  deliveryId: string;
  providerMessageId?: string;
}): Promise<void> {
  const supabase = getServerSupabaseClient();
  const { error } = await supabase.rpc("mark_email_delivery_delivered", {
    p_delivery_id: params.deliveryId,
    p_provider_message_id: params.providerMessageId ?? null,
  } as never);

  if (error) {
    throw new Error(`Failed to mark follow-up email delivery delivered: ${error.code}`);
  }
}

export async function markFollowUpEmailDeliveryFailed(params: {
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
    throw new Error(`Failed to mark follow-up email delivery failed: ${error.code}`);
  }
}
