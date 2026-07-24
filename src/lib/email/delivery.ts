import "server-only";
import { getServerSupabaseClient } from "@/lib/supabase";

type EmailDeliveryStatus = "pending" | "processing" | "delivered" | "failed";

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
    } as never)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Email delivery insert failed: ${error.code}`);
  }

  return (data as { id: string }).id;
}

export async function markEmailDeliveryProcessing(
  deliveryId: string,
): Promise<void> {
  const supabase = getServerSupabaseClient();

  const { data: current } = await supabase
    .from("integration_deliveries")
    .select("attempt_count")
    .eq("id", deliveryId)
    .single();

  const nextCount =
    ((current as { attempt_count?: number } | null)?.attempt_count ?? 0) + 1;

  const { error } = await supabase
    .from("integration_deliveries")
    .update({
      status: "processing" as never,
      attempt_count: nextCount,
    } as never)
    .eq("id", deliveryId);

  if (error) {
    throw new Error(`Failed to mark email delivery processing: ${error.code}`);
  }
}

export async function markEmailDeliveryDelivered(params: {
  deliveryId: string;
  providerMessageId?: string;
}): Promise<void> {
  const supabase = getServerSupabaseClient();
  const { error } = await supabase
    .from("integration_deliveries")
    .update({
      status: "delivered" as never,
      provider_message_id: params.providerMessageId ?? null,
      delivered_at: new Date().toISOString(),
      last_attempt_at: new Date().toISOString(),
    } as never)
    .eq("id", params.deliveryId);

  if (error) {
    throw new Error(`Failed to mark email delivery delivered: ${error.code}`);
  }
}

export async function markEmailDeliveryFailed(params: {
  deliveryId: string;
  safeErrorCode: string;
}): Promise<void> {
  const supabase = getServerSupabaseClient();
  const { error } = await supabase
    .from("integration_deliveries")
    .update({
      status: "failed" as never,
      error_message: params.safeErrorCode,
      last_attempt_at: new Date().toISOString(),
    } as never)
    .eq("id", params.deliveryId);

  if (error) {
    throw new Error(`Failed to mark email delivery failed: ${error.code}`);
  }
}