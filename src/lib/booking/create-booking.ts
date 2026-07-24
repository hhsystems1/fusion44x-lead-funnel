import { getServerSupabaseClient } from "@/lib/supabase";
import { createGoogleCalendarProvider } from "@/lib/booking/providers/google";
import type { BookingCreateInput } from "@/lib/booking/slots";
import { calculateEndTime } from "@/lib/booking/slots";
import { BOOKING } from "@/config/booking";
import {
  findExistingDelivery,
  upsertDeliveryAttempt,
  markDeliveryProcessing,
  markDeliveryDelivered,
  markDeliveryFailed,
} from "@/lib/booking/integration-delivery";

interface CreateBookingResult {
  appointment_id: string;
  start_time: string;
  end_time: string;
  timezone: string;
  status: "confirmed";
}

interface SafeBookingError {
  status: number;
  code: string;
  message: string;
}

function mapRpcErrorCode(code: string): SafeBookingError | null {
  switch (code) {
    case "P0002":
      return { status: 404, code, message: "Lead or session not found" };
    case "P0003":
      return { status: 403, code, message: "Session does not match lead" };
    case "P0008":
    case "P0009":
      return { status: 409, code, message: "Already booked" };
    case "P0010":
      return { status: 409, code, message: "Time slot is no longer available" };
    case "P0011":
      return { status: 409, code, message: "Concurrent booking conflict" };
    case "P0020":
      return { status: 409, code, message: "Duplicate booking request" };
    default:
      return null;
  }
}

interface RpcError {
  code?: string;
  message?: string;
}

interface AppointmentRow {
  id: string;
  start_time: string;
  end_time: string;
  timezone: string;
  status: string;
  external_event_id: string | null;
  booking_event_id: string | null;
  lead_id?: string;
  session_id?: string;
}

async function confirmAppointmentViaRpc(params: {
  appointmentId: string;
  externalEventId: string;
}): Promise<string> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase.rpc("confirm_funnel_appointment", {
    p_appointment_id: params.appointmentId,
    p_external_event_id: params.externalEventId,
  } as never);

  if (error) {
    throw error;
  }

  return data as string;
}

async function failAppointmentViaRpc(params: {
  appointmentId: string;
  safeErrorCode: string;
}): Promise<string> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase.rpc("fail_funnel_appointment", {
    p_appointment_id: params.appointmentId,
    p_safe_error_code: params.safeErrorCode,
  } as never);

  if (error) {
    throw error;
  }

  return data as string;
}

async function getLeadInfo(appointmentId: string): Promise<{
  full_name: string;
  email: string;
  phone: string;
  zip_code: string;
  booking_event_id: string | null;
  start_time: string;
  end_time: string;
  timezone: string;
} | null> {
  const supabase = getServerSupabaseClient();

  const { data, error } = await supabase
    .from("appointments")
    .select("booking_event_id, start_time, end_time, timezone, lead_id")
    .eq("id", appointmentId)
    .single();

  if (error || !data) {
    return null;
  }

  const row = data as Record<string, unknown>;

  const { data: leadData, error: leadError } = await supabase
    .from("leads")
    .select("first_name, last_name, email, phone, zip_code")
    .eq("id", row.lead_id as string)
    .single();

  if (leadError || !leadData) {
    return null;
  }

  const lead = leadData as Record<string, unknown>;
  const firstName = ((lead.first_name as string) ?? "").trim();
  const lastName = ((lead.last_name as string) ?? "").trim();
  const fullName = `${firstName} ${lastName}`.trim();

  return {
    full_name: fullName,
    email: (lead.email as string) ?? "",
    phone: (lead.phone as string) ?? "",
    zip_code: (lead.zip_code as string) ?? "",
    booking_event_id: (row.booking_event_id as string) ?? null,
    start_time: row.start_time as string,
    end_time: row.end_time as string,
    timezone: row.timezone as string,
  };
}

export async function createBooking(input: BookingCreateInput): Promise<CreateBookingResult | SafeBookingError> {
  const { lead_id, session_id, start_time, timezone, event_id } = input;
  const end_time = calculateEndTime(start_time);

  // ---------------------------------------------------------------------------
  // 1. Check for existing confirmed appointment with same event_id
  //    Verify all booking identity fields match — never return an unrelated
  //    appointment even if the event_id collides.
  // ---------------------------------------------------------------------------
  const supabase = getServerSupabaseClient();

  const { data: existingConfirmed } = await supabase
    .from("appointments")
    .select("id, lead_id, session_id, start_time, end_time, timezone, status, external_event_id")
    .eq("booking_event_id", event_id)
    .eq("status", "confirmed")
    .maybeSingle();

  if (existingConfirmed) {
    const row = existingConfirmed as AppointmentRow;

    if (
      row.lead_id !== lead_id ||
      row.session_id !== session_id ||
      row.start_time !== start_time ||
      row.end_time !== end_time ||
      row.timezone !== timezone
    ) {
      return { status: 409, code: "EVENT_ID_MISMATCH", message: "Booking event ID already used with different booking data" };
    }

    return {
      appointment_id: row.id,
      start_time: row.start_time,
      end_time: row.end_time,
      timezone: row.timezone,
      status: "confirmed",
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Check for existing pending appointment with a successful delivery
  // ---------------------------------------------------------------------------
  const { data: existingPending } = await supabase
    .from("appointments")
    .select("id, start_time, end_time, timezone, status")
    .eq("booking_event_id", event_id)
    .eq("status", "pending")
    .maybeSingle();

  if (existingPending) {
    const pendingRow = existingPending as AppointmentRow;
    const existingDelivery = await findExistingDelivery(pendingRow.id, "google_calendar");
    if (existingDelivery && existingDelivery.status === "delivered" && existingDelivery.event_id) {
      const provider = createGoogleCalendarProvider();
      const gcalEvent = await provider.getEvent(existingDelivery.event_id);

      if (gcalEvent) {
        const confirmedId = await confirmAppointmentViaRpc({
          appointmentId: pendingRow.id,
          externalEventId: gcalEvent.external_event_id,
        });

        await markDeliveryDelivered({ deliveryId: existingDelivery.id });

        return {
          appointment_id: confirmedId,
          start_time: pendingRow.start_time,
          end_time: pendingRow.end_time,
          timezone: pendingRow.timezone,
          status: "confirmed",
        };
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Call the atomic RPC to create the pending appointment
  // ---------------------------------------------------------------------------
  const { data: appointmentId, error: rpcError } = await supabase.rpc(
    "create_funnel_appointment",
    {
      p_lead_id: lead_id,
      p_session_id: session_id,
      p_start_time: start_time,
      p_end_time: end_time,
      p_timezone: timezone,
      p_provider: "google_calendar",
      p_event_id: event_id,
      p_buffer_before: `${BOOKING.BUFFER_BEFORE_MINUTES} minutes`,
      p_buffer_after: `${BOOKING.BUFFER_AFTER_MINUTES} minutes`,
    } as never,
  );

  if (rpcError) {
    const mapped = (rpcError as RpcError).code ? mapRpcErrorCode((rpcError as RpcError).code!) : null;
    if (mapped) {
      return mapped;
    }
    return { status: 500, code: "RPC_FAILED", message: "Internal server error" };
  }

  const appId = appointmentId as string;

  // ---------------------------------------------------------------------------
  // 4. Create integration delivery record
  // ---------------------------------------------------------------------------
  let deliveryId: string;
  try {
    deliveryId = await upsertDeliveryAttempt({
      appointmentId: appId,
      eventId: event_id,
    });
  } catch {
    return { status: 500, code: "DELIVERY_CREATE_FAILED", message: "Internal server error" };
  }

  try {
    await markDeliveryProcessing(deliveryId);
  } catch {
    // non-fatal — continue
  }

  // ---------------------------------------------------------------------------
  // 5. Get lead information for the Google Calendar event
  // ---------------------------------------------------------------------------
  const leadInfo = await getLeadInfo(appId);
  if (!leadInfo) {
    try {
      await failAppointmentViaRpc({ appointmentId: appId, safeErrorCode: "LEAD_INFO_FAILED" });
      await markDeliveryFailed({ deliveryId, safeErrorCode: "LEAD_INFO_FAILED" });
    } catch {
      // swallow
    }
    return { status: 500, code: "LEAD_INFO_FAILED", message: "Internal server error" };
  }

  // ---------------------------------------------------------------------------
  // 6. Create Google Calendar event
  // ---------------------------------------------------------------------------
  const provider = createGoogleCalendarProvider();
  let gcalResult: { external_event_id: string; html_link?: string; status: string; created_at?: string };

  try {
    gcalResult = await provider.createEvent({
      summary: "Fusion 44X Pool Consultation",
      start: leadInfo.start_time,
      end: leadInfo.end_time,
      timezone: leadInfo.timezone,
      description: [
        `Name: ${leadInfo.full_name}`,
        `Email: ${leadInfo.email}`,
        `Phone: ${leadInfo.phone}`,
        `ZIP: ${leadInfo.zip_code}`,
      ].join("\n"),
      extendedProperties: {
        private: {
          appointmentId: appId,
          bookingEventId: event_id,
        },
      },
    });
  } catch (err) {
    try {
      await failAppointmentViaRpc({ appointmentId: appId, safeErrorCode: "GCAL_CREATE_FAILED" });
    } catch {
      // swallow
    }

    const errObj = err as { code?: number };
    const safeCode = errObj && typeof errObj.code === "number" ? `GCAL_${errObj.code}` : "GCAL_ERROR";
    try {
      await markDeliveryFailed({ deliveryId, safeErrorCode: safeCode });
    } catch {
      // swallow
    }

    return { status: 502, code: safeCode, message: "Calendar provider error" };
  }

  // ---------------------------------------------------------------------------
  // 7. Confirm the appointment in the database
  // ---------------------------------------------------------------------------
  try {
    const confirmedId = await confirmAppointmentViaRpc({
      appointmentId: appId,
      externalEventId: gcalResult.external_event_id,
    });

    // -------------------------------------------------------------------------
    // 8. Mark delivery as delivered only AFTER database confirmation succeeds
    // -------------------------------------------------------------------------
    try {
      await markDeliveryDelivered({ deliveryId });
    } catch {
      // non-fatal — appointment is already confirmed
    }

    return {
      appointment_id: confirmedId,
      start_time: leadInfo.start_time,
      end_time: leadInfo.end_time,
      timezone: leadInfo.timezone,
      status: "confirmed",
    };
  } catch {
    // Database confirmation failed — attempt compensation
    const compensationResult = await compensateGcalEvent(
      gcalResult.external_event_id,
      appId,
      deliveryId,
    );

    if (compensationResult === "compensated") {
      return { status: 500, code: "DB_CONFIRM_FAILED", message: "Internal server error" };
    }

    return { status: 500, code: "DB_CONFIRM_FAILED", message: "Internal server error" };
  }
}

type CompensationResult = "compensated" | "compensation_failed" | "appointment_fail_failed";

async function compensateGcalEvent(
  externalEventId: string,
  appointmentId: string,
  deliveryId: string,
): Promise<CompensationResult> {
  // Step 1: Delete the Google Calendar event
  try {
    const provider = createGoogleCalendarProvider();
    await provider.deleteEvent(externalEventId);
  } catch {
    // Google event deletion failed — do NOT mark appointment failed since the
    // external event may still exist. Record the compensation failure.
    try {
      await markDeliveryFailed({ deliveryId, safeErrorCode: "COMPENSATION_DELETE_FAILED" });
    } catch {
      // swallow
    }

    // If external_event_id is still null, the confirm RPC failed before
    // setting it — revert to pending so the booking can be retried.
    try {
      const supabase = getServerSupabaseClient();
      const { data: app } = await supabase
        .from("appointments")
        .select("external_event_id")
        .eq("id", appointmentId)
        .single();

      if (app && !(app as Record<string, unknown>).external_event_id) {
        await supabase
          .from("appointments")
          .update({ status: "pending" } as never)
          .eq("id", appointmentId);
      }
    } catch {
      // swallow
    }

    return "compensation_failed";
  }

  // Step 2: Google event deleted — mark appointment failed (required)
  try {
    await failAppointmentViaRpc({
      appointmentId,
      safeErrorCode: "DB_CONFIRM_FAILED_COMPENSATED",
    });
  } catch {
    // Appointment could not be marked failed — log and record distinct code
    console.error("appointment_id=%s safe_code=%s", appointmentId, "APPOINTMENT_FAIL_AFTER_COMPENSATION_FAILED");

    try {
      await markDeliveryFailed({ deliveryId, safeErrorCode: "APPOINTMENT_FAIL_AFTER_COMPENSATION_FAILED" });
    } catch {
      // swallow
    }

    return "appointment_fail_failed";
  }

  // Step 3: Delivery failure recording is best-effort after appointment is failed
  try {
    await markDeliveryFailed({ deliveryId, safeErrorCode: "DB_CONFIRM_FAILED_COMPENSATED" });
  } catch {
    // swallow
  }

  return "compensated";
}
