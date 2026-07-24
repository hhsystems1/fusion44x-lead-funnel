import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";
import {
  bookingCreateSchema,
  calculateEndTime,
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

  const end_time = calculateEndTime(start_time);

  const supabase = getServerSupabaseClient();

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