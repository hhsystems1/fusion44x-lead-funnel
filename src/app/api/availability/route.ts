import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";
import {
  availabilityQuerySchema,
  generateTimeSlots,
  isSlotInPast,
  isWithinBookingWindow,
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

  const slots = generateTimeSlots(date, timezone);
  const supabase = getServerSupabaseClient();

  const dayStart = `${date}T00:00:00Z`;
  const dayEnd = `${date}T23:59:59Z`;

  const { data: blockingAppointments } = await supabase
    .from("appointments")
    .select("start_time, end_time")
    .in("status", ["pending", "confirmed"])
    .gte("start_time", dayStart)
    .lte("start_time", dayEnd);

  const blockedSlots = (blockingAppointments ?? []) as Array<{
    start_time: string;
    end_time: string;
  }>;

  const availableSlots = slots.filter((slot) => {
    if (isSlotInPast(slot.start, BOOKING.MINIMUM_NOTICE_HOURS)) return false;

    const slotStart = new Date(slot.start).getTime();
    const slotEnd = new Date(slot.end).getTime();

    for (const blocked of blockedSlots) {
      const blockedStart = new Date(blocked.start_time).getTime();
      const blockedEnd = new Date(blocked.end_time).getTime();
      if (slotStart < blockedEnd && slotEnd > blockedStart) return false;
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