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
  createPublicError,
  BodyTooLargeError,
  JsonParseError,
} from "@/lib/server/request-protection";
import { createBooking } from "@/lib/booking/create-booking";

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

  if (timezone !== BOOKING.TIMEZONE) {
    return NextResponse.json(
      createPublicError(422, "Invalid timezone"),
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
    return NextResponse.json(
      createPublicError(422, "Invalid start_time"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  if (!isWithinBookingWindow(dateStr)) {
    return NextResponse.json(
      createPublicError(422, "Date is outside the booking window"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  if (!isWorkingDay(dateStr, BOOKING.TIMEZONE)) {
    return NextResponse.json(
      createPublicError(422, "Date is not a working day"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  if (isBlockedDate(dateStr)) {
    return NextResponse.json(
      createPublicError(422, "Date is blocked"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  if (!isExactSlot(start_time, dateStr, BOOKING.TIMEZONE)) {
    return NextResponse.json(
      createPublicError(422, "Invalid time slot"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  if (isSlotInPast(start_time, BOOKING.MINIMUM_NOTICE_HOURS)) {
    return NextResponse.json(
      createPublicError(422, "Selected time is too soon"),
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
  // Create booking (appointment + Google Calendar event + confirmation)
  // ---------------------------------------------------------------------------

  const result = await createBooking({ lead_id, session_id, start_time, timezone, event_id });

  if ("code" in result && "status" in result) {
    const status = result.status;

    if (status === 502) {
      return NextResponse.json(
        createPublicError(502, result.message),
        { status: 502, headers: { "x-request-id": requestId } },
      );
    }

    const statusCode = result.status;
    return NextResponse.json(
      createPublicError(statusCode, result.message),
      { status: statusCode, headers: { "x-request-id": requestId } },
    );
  }

  return NextResponse.json(result, { status: 201, headers: { "x-request-id": requestId } });
}

export async function GET() {
  return NextResponse.json(
    createPublicError(405, "Method not allowed"),
    { status: 405 },
  );
}
