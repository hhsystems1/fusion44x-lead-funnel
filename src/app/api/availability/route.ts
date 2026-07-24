import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";
import {
  availabilityQuerySchema,
  generateTimeSlots,
  isSlotInPast,
  isWithinBookingWindow,
  getDayBoundariesUtc,
  BOOKING,
} from "@/lib/booking/slots";
import {
  extractClientIp,
  generateRequestId,
  checkRateLimit,
  createPublicError,
} from "@/lib/server/request-protection";

const RATE_LIMIT = { maxRequests: 60, windowMs: 60_000 };

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const clientIp = extractClientIp(request);

  const rateCheck = checkRateLimit(clientIp, RATE_LIMIT);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      createPublicError(429, "Too many requests. Try again later."),
      { status: 429, headers: { "x-request-id": requestId } },
    );
  }

  const { searchParams } = new URL(request.url);
  const rawDate = searchParams.get("date");
  const rawTimezone = searchParams.get("timezone") ?? BOOKING.TIMEZONE;

  const parsed = availabilityQuerySchema.safeParse({
    date: rawDate,
    timezone: rawTimezone,
  });

  if (!parsed.success) {
    return NextResponse.json(
      createPublicError(422, "Invalid query parameters"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  const { date, timezone } = parsed.data;

  if (!isWithinBookingWindow(date)) {
    return NextResponse.json(
      createPublicError(422, "Date is outside the booking window"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  const boundaries = getDayBoundariesUtc(date, timezone);
  if (!boundaries) {
    return NextResponse.json(
      createPublicError(422, "Invalid date or timezone"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  const slots = generateTimeSlots(date, timezone);
  const supabase = getServerSupabaseClient();

  const { data: blockingAppointments, error: availabilityError } = await supabase
    .from("appointments")
    .select("start_time, end_time")
    .in("status", ["pending", "confirmed"])
    .lt("start_time", boundaries.dayEndUtc)
    .gt("end_time", boundaries.dayStartUtc);

  if (availabilityError) {
    console.error(
      "[availability] query failed requestId=%s code=%s",
      requestId,
      availabilityError.code,
    );
    return NextResponse.json(
      createPublicError(500, "Internal server error"),
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }

  const blockedSlots = (blockingAppointments ?? []) as Array<{
    start_time: string;
    end_time: string;
  }>;

  const bufBeforeMs = BOOKING.BUFFER_BEFORE_MINUTES * 60 * 1000;
  const bufAfterMs = BOOKING.BUFFER_AFTER_MINUTES * 60 * 1000;

  const availableSlots = slots.filter((slot) => {
    if (isSlotInPast(slot.start, BOOKING.MINIMUM_NOTICE_HOURS)) return false;

    const windowStart = new Date(slot.start).getTime() - bufBeforeMs;
    const windowEnd = new Date(slot.end).getTime() + bufAfterMs;

    for (const blocked of blockedSlots) {
      const blockedStart = new Date(blocked.start_time).getTime();
      const blockedEnd = new Date(blocked.end_time).getTime();
      if (windowStart < blockedEnd && windowEnd > blockedStart) return false;
    }

    return true;
  });

  return NextResponse.json(
    {
      slots: availableSlots.map((s) => ({ start: s.start, end: s.end, label: s.label })),
      date,
      timezone,
    },
    { headers: { "x-request-id": requestId } },
  );
}