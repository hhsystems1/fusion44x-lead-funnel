import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";
import { BOOKING } from "@/config/booking";
import {
  bookingCreateSchema,
  calculateEndTime,
  isWithinBookingWindow,
  isWorkingDay,
  isBlockedDate,
  isExactSlot,
  isSlotInPast,
  isSlotAvailable,
} from "@/lib/booking/slots";
import {
  readJsonBody,
  extractClientIp,
  generateRequestId,
  checkRateLimit,
  createPublicError,
  BodyTooLargeError,
  JsonParseError,
} from "@/lib/server/request-protection";
import { mapBookingRpcError } from "@/lib/server/booking-rpc-errors";

const RATE_LIMIT = { maxRequests: 10, windowMs: 60_000 };

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const clientIp = extractClientIp(request);

  const rateCheck = checkRateLimit(clientIp, RATE_LIMIT);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      createPublicError(429, "Too many requests. Try again later."),
      { status: 429, headers: { "x-request-id": requestId } },
    );
  }

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (err) {
    if (err instanceof BodyTooLargeError || err instanceof JsonParseError) {
      return NextResponse.json(
        createPublicError(400, err.message),
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }
    throw err;
  }

  const parsed = bookingCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      createPublicError(422, "Validation failed"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  const { lead_id, session_id, start_time, timezone, event_id } = parsed.data;

  // ---------------------------------------------------------------------------
  // Server-side slot revalidation
  // ---------------------------------------------------------------------------

  // 1. Timezone must match configured booking timezone
  if (timezone !== BOOKING.TIMEZONE) {
    return NextResponse.json(
      createPublicError(422, "Invalid timezone"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  // 2. Derive the booking date in the configured timezone
  let dateStr: string;
  try {
    const startDate = new Date(start_time);
    const localDateStr = startDate.toLocaleDateString("en-CA", { timeZone: BOOKING.TIMEZONE });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(localDateStr)) {
      throw new Error("Invalid date");
    }
    dateStr = localDateStr;
  } catch {
    return NextResponse.json(
      createPublicError(422, "Invalid start_time"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  // 3. Validate the date is within the booking window
  if (!isWithinBookingWindow(dateStr)) {
    return NextResponse.json(
      createPublicError(422, "Date is outside the booking window"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  // 4. Validate it's a working day
  if (!isWorkingDay(dateStr, BOOKING.TIMEZONE)) {
    return NextResponse.json(
      createPublicError(422, "Date is not a working day"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  // 5. Validate it's not a blocked date
  if (isBlockedDate(dateStr)) {
    return NextResponse.json(
      createPublicError(422, "Date is blocked"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  // 6. Validate start_time matches a valid configured slot
  if (!isExactSlot(start_time, dateStr, BOOKING.TIMEZONE)) {
    return NextResponse.json(
      createPublicError(422, "Invalid time slot"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  // 7. Enforce minimum notice
  if (isSlotInPast(start_time, BOOKING.MINIMUM_NOTICE_HOURS)) {
    return NextResponse.json(
      createPublicError(422, "Selected time is too soon"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  // 8. Calculate end_time server-side
  const end_time = calculateEndTime(start_time);

  // 9. Re-query availability to check for conflicts before calling RPC
  const supabase = getServerSupabaseClient();
  try {
    const available = await isSlotAvailable(start_time, end_time, supabase);
    if (!available) {
      return NextResponse.json(
        createPublicError(409, "Time slot is no longer available"),
        { status: 409, headers: { "x-request-id": requestId } },
      );
    }
  } catch (err) {
    console.error(
      "[bookings] availability check failed requestId=%s msg=%s",
      requestId,
      err instanceof Error ? err.message : "unknown",
    );
    return NextResponse.json(
      createPublicError(500, "Internal server error"),
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }

  // ---------------------------------------------------------------------------
  // Call the atomic RPC
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
    const mapped = rpcError.code ? mapBookingRpcError(rpcError.code) : null;
    if (mapped) {
      console.warn(
        "[bookings] rpc error requestId=%s code=%s",
        requestId,
        rpcError.code,
      );
      return NextResponse.json(
        createPublicError(mapped.status, mapped.message),
        { status: mapped.status, headers: { "x-request-id": requestId } },
      );
    }
    console.error(
      "[bookings] unexpected rpc error requestId=%s code=%s",
      requestId,
      rpcError.code ?? "unknown",
    );
    return NextResponse.json(
      createPublicError(500, "Internal server error"),
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }

  return NextResponse.json(
    {
      appointment_id: appointmentId,
      start_time,
      end_time,
      timezone,
      status: "pending",
    },
    { status: 201, headers: { "x-request-id": requestId } },
  );
}

export async function GET() {
  return NextResponse.json(
    createPublicError(405, "Method not allowed"),
    { status: 405 },
  );
}