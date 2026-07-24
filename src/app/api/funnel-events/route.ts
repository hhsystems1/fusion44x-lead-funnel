import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";
import { funnelEventSchema } from "@/lib/validation/api-schemas";
import {
  readJsonBody,
  extractClientIp,
  generateRequestId,
  checkRateLimit,
  createPublicError,
  BodyTooLargeError,
  JsonParseError,
} from "@/lib/server/request-protection";

const RATE_LIMIT = { maxRequests: 120, windowMs: 60_000 };

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

  const parsed = funnelEventSchema.safeParse(body);
  if (!parsed.success) {
    console.warn(
      "[funnel-events] validation error requestId=%s errors=%j",
      requestId,
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
    return NextResponse.json(
      createPublicError(422, "Validation failed"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  const supabase = getServerSupabaseClient();

  const { data: session } = await supabase
    .from("funnel_sessions")
    .select("id")
    .eq("id", parsed.data.session_id)
    .maybeSingle();

  if (!session) {
    return NextResponse.json(
      createPublicError(422, "Referenced session does not exist"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  const eventPayload = {
    session_id: parsed.data.session_id,
    lead_id: parsed.data.lead_id ?? null,
    event_name: parsed.data.event_name,
    section_id: parsed.data.section_id ?? null,
    step_id: parsed.data.step_id ?? null,
    question_id: parsed.data.question_id ?? null,
    answer_code: parsed.data.answer_code ?? null,
    duration_ms: parsed.data.duration_ms ?? null,
    page_version: parsed.data.page_version,
    event_id: parsed.data.event_id ?? null,
    metadata: parsed.data.metadata ?? {},
    occurred_at: parsed.data.occurred_at ?? undefined,
  };

  const { data: inserted, error } = await supabase
    .from("funnel_events")
    .insert(eventPayload as never)
    .select("id")
    .single();

  if (error) {
    console.error(
      "[funnel-events] insert error requestId=%s code=%s message=%s",
      requestId,
      error.code,
      error.message,
    );
    return NextResponse.json(
      createPublicError(500, "Internal server error"),
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }

  return NextResponse.json(
    { success: true, id: (inserted as { id: string }).id },
    { status: 201, headers: { "x-request-id": requestId } },
  );
}

export async function GET() {
  return NextResponse.json(
    createPublicError(405, "Method not allowed"),
    { status: 405 },
  );
}
