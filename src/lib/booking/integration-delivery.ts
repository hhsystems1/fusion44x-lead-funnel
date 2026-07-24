import { getServerSupabaseClient } from "@/lib/supabase";

type Destination = "google_calendar";
type EventType = "appointment_create";
type DeliveryStatus = "pending" | "processing" | "delivered" | "failed";

export interface DeliveryRecord {
  id: string;
  appointment_id: string;
  destination: Destination;
  event_type: EventType;
  event_id: string | null;
  status: DeliveryStatus;
  attempt_count: number;
  response_code: number | null;
  error_message: string | null;
}

export async function findExistingDelivery(
  appointmentId: string,
  destination: Destination,
): Promise<DeliveryRecord | null> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from("integration_deliveries")
    .select("*")
    .eq("appointment_id", appointmentId)
    .eq("destination", destination)
    .maybeSingle();

  if (error) {
    throw new Error(`Integration delivery lookup failed: ${error.code}`);
  }

  return data as DeliveryRecord | null;
}

export async function upsertDeliveryAttempt(params: {
  appointmentId: string;
  eventId: string | null;
}): Promise<string> {
  const supabase = getServerSupabaseClient();
  const existing = await findExistingDelivery(params.appointmentId, "google_calendar");

  if (existing) {
    return existing.id;
  }

  const { data, error } = await supabase
    .from("integration_deliveries")
    .insert({
      appointment_id: params.appointmentId,
      destination: "google_calendar" as never,
      event_type: "appointment_create" as never,
      event_id: params.eventId,
      status: "pending" as never,
      attempt_count: 0,
      response_code: null,
      error_message: null,
    } as never)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Integration delivery insert failed: ${error.code}`);
  }

  return (data as { id: string }).id;
}

export async function markDeliveryProcessing(deliveryId: string): Promise<void> {
  const supabase = getServerSupabaseClient();

  const { data: current } = await supabase
    .from("integration_deliveries")
    .select("attempt_count")
    .eq("id", deliveryId)
    .single();

  const nextCount = ((current as { attempt_count?: number } | null)?.attempt_count ?? 0) + 1;

  const { error } = await supabase
    .from("integration_deliveries")
    .update({
      status: "processing" as never,
      attempt_count: nextCount,
    } as never)
    .eq("id", deliveryId);

  if (error) {
    throw new Error(`Failed to mark delivery processing: ${error.code}`);
  }
}

export async function markDeliveryDelivered(params: {
  deliveryId: string;
  responseCode?: number;
}): Promise<void> {
  const supabase = getServerSupabaseClient();
  const { error } = await supabase
    .from("integration_deliveries")
    .update({
      status: "delivered" as never,
      response_code: params.responseCode ?? null,
      delivered_at: new Date().toISOString(),
      last_attempt_at: new Date().toISOString(),
    } as never)
    .eq("id", params.deliveryId);

  if (error) {
    throw new Error(`Failed to mark delivery delivered: ${error.code}`);
  }
}

export async function markDeliveryFailed(params: {
  deliveryId: string;
  safeErrorCode: string;
  responseCode?: number;
}): Promise<void> {
  const supabase = getServerSupabaseClient();
  const { error } = await supabase
    .from("integration_deliveries")
    .update({
      status: "failed" as never,
      error_message: params.safeErrorCode,
      response_code: params.responseCode ?? null,
      last_attempt_at: new Date().toISOString(),
    } as never)
    .eq("id", params.deliveryId);

  if (error) {
    throw new Error(`Failed to mark delivery failed: ${error.code}`);
  }
}
