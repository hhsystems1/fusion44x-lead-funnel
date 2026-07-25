import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";
import { BOOKING } from "@/config/booking";
import {
  bookingCreateSchema,
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
  BodyTooLargeError,
  JsonParseError,
} from "@/lib/server/request-protection";
import { createBooking } from "@/lib/booking/create-booking";

const RATE_LIMIT = { maxRequests: 10, windowMs: 60_000 };

function safeLog(requestId: string, stage: string, meta?: Record<string, string>) {
  const parts = [`[bookings] requestId=${requestId} stage=${stage}`];
  if (meta) {
    for (const [k, v] of Object.entries(meta)) {
      parts.push(`${k}=${v}`);
    }
  }
  console.log(parts.join(" "));
}

function safeErrorLog(requestId: string, stage: string, meta?: Record<string, string>) {
  const parts = [`[bookings] requestId=${requestId} stage=${stage}`];
  if (meta) {
    for (const [k, v] of Object.entries(meta)) {
      parts.push(`${k}=${v}`);
    }
  }
  console.error(parts.join(" "));
}

function createBookingError(status: number, code: string, message: string) {
  return { error: { status, message, code } };
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const clientIp = extractClientIp(request);

  const rateCheck = checkRateLimit(clientIp, RATE_LIMIT);
  if (!rateCheck.allowed) {
    safeLog(requestId, "rate_limited");
    return NextResponse.json(
      createBookingError(429, "BOOKING_RATE_LIMITED", "Too many requests. Try again later."),
      { status: 429, headers: { "x-request-id": requestId } },
    );
  }

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (err) {
    if (err instanceof BodyTooLargeError || err instanceof JsonParseError) {
      safeErrorLog(requestId, "invalid_body");
      return NextResponse.json(
        createBookingError(400, "BOOKING_INPUT_INVALID", err.message),
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }
    throw err;
  }

  const parsed = bookingCreateSchema.safeParse(body);
  if (!parsed.success) {
    safeErrorLog(requestId, "validation_failed");
    return NextResponse.json(
      createBookingError(422, "BOOKING_INPUT_INVALID", "Validation failed"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  const { lead_id, session_id, start_time, timezone, event_id } = parsed.data;

  safeLog(requestId, "request_received", { lead_id, session_id });

  // ---------------------------------------------------------------------------
  // Server-side slot revalidation
  // ---------------------------------------------------------------------------

  if (timezone !== BOOKING.TIMEZONE) {
    safeErrorLog(requestId, "invalid_timezone", { lead_id });
    return NextResponse.json(
      createBookingError(422, "BOOKING_INPUT_INVALID", "Invalid timezone"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  let dateStr: string;
  try {
    const startDate = new Date(start_time);
    const localDateStr = startDate.toLocaleDateString("en-CA", { timeZone: BOOKING.TIMEZONE });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(localDateStr)) {
      throw new Error("Invalid date");
    }
    dateStr = localDateStr;
  } catch {
    safeErrorLog(requestId, "invalid_start_time", { lead_id });
    return NextResponse.json(
      createBookingError(422, "BOOKING_INPUT_INVALID", "Invalid start_time"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  if (!isWithinBookingWindow(dateStr)) {
    safeErrorLog(requestId, "date_outside_window", { lead_id, date: dateStr });
    return NextResponse.json(
      createBookingError(422, "BOOKING_UNAVAILABLE", "Date is outside the booking window"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  if (!isWorkingDay(dateStr, BOOKING.TIMEZONE)) {
    safeErrorLog(requestId, "not_working_day", { lead_id, date: dateStr });
    return NextResponse.json(
      createBookingError(422, "BOOKING_UNAVAILABLE", "Date is not a working day"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  if (isBlockedDate(dateStr)) {
    safeErrorLog(requestId, "blocked_date", { lead_id, date: dateStr });
    return NextResponse.json(
      createBookingError(422, "BOOKING_UNAVAILABLE", "Date is blocked"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  if (!isExactSlot(start_time, dateStr, BOOKING.TIMEZONE)) {
    safeErrorLog(requestId, "invalid_slot", { lead_id });
    return NextResponse.json(
      createBookingError(422, "BOOKING_INPUT_INVALID", "Invalid time slot"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  if (isSlotInPast(start_time, BOOKING.MINIMUM_NOTICE_HOURS)) {
    safeErrorLog(requestId, "slot_in_past", { lead_id });
    return NextResponse.json(
      createBookingError(422, "BOOKING_UNAVAILABLE", "Selected time is too soon"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  // Re-query availability
  const end_time = new Date(
    new Date(start_time).getTime() + BOOKING.APPOINTMENT_DURATION_MINUTES * 60 * 1000,
  ).toISOString();

  const supabase = getServerSupabaseClient();
  try {
    const available = await isSlotAvailable(start_time, end_time, supabase);
    if (!available) {
      safeLog(requestId, "slot_unavailable", { lead_id, date: dateStr });
      return NextResponse.json(
        createBookingError(409, "BOOKING_CONFLICT", "Time slot is no longer available"),
        { status: 409, headers: { "x-request-id": requestId } },
      );
    }
  } catch (err) {
    safeErrorLog(requestId, "availability_check_failed", {
      lead_id,
      msg: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json(
      createBookingError(500, "BOOKING_DATABASE_FAILED", "Internal server error"),
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }

  // ---------------------------------------------------------------------------
  // Create booking (appointment + Google Calendar event + confirmation)
  // ---------------------------------------------------------------------------

  safeLog(requestId, "creating_booking", { lead_id });
  const result = await createBooking({ lead_id, session_id, start_time, timezone, event_id });

  if ("code" in result && "status" in result) {
    const status = result.status;
    const code = result.code;

    safeErrorLog(requestId, "booking_failed", { lead_id, code, status: String(status) });

    if (status === 502) {
      return NextResponse.json(
        createBookingError(502, "GOOGLE_CALENDAR_FAILED", result.message),
        { status: 502, headers: { "x-request-id": requestId } },
      );
    }

    if (status === 409) {
      return NextResponse.json(
        createBookingError(409, "BOOKING_CONFLICT", result.message),
        { status: 409, headers: { "x-request-id": requestId } },
      );
    }

    const statusCode = result.status;
    return NextResponse.json(
      createBookingError(statusCode, "BOOKING_DATABASE_FAILED", result.message),
      { status: statusCode, headers: { "x-request-id": requestId } },
    );
  }

  safeLog(requestId, "booking_confirmed", {
    lead_id,
    appointment_id: result.appointment_id,
  });
  return NextResponse.json(result, { status: 201, headers: { "x-request-id": requestId } });
}

export async function GET() {
  return NextResponse.json(
    createBookingError(405, "BOOKING_METHOD_NOT_ALLOWED", "Method not allowed"),
    { status: 405 },
  );
}
