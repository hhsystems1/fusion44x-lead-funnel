import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";
import { funnelSessionSchema } from "@/lib/validation/api-schemas";
import {
  readJsonBody,
  extractClientIp,
  generateRequestId,
  checkRateLimit,
  createPublicError,
  BodyTooLargeError,
  JsonParseError,
} from "@/lib/server/request-protection";

const RATE_LIMIT = { maxRequests: 30, windowMs: 60_000 };

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

  const parsed = funnelSessionSchema.safeParse(body);
  if (!parsed.success) {
    console.warn(
      "[funnel-sessions] validation error requestId=%s errors=%j",
      requestId,
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
    return NextResponse.json(
      createPublicError(422, "Validation failed"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  const { anonymous_id, page_version, landing_url, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, fbc, fbp, device_category } = parsed.data;

  const supabase = getServerSupabaseClient();

  const { data: existing } = await supabase
    .from("funnel_sessions")
    .select("id, anonymous_id, status, page_version, started_at")
    .eq("anonymous_id", anonymous_id)
    .maybeSingle();

  if (existing) {
    const safe = existing as {
      id: string; anonymous_id: string; status: string; page_version: string; started_at: string;
    };
    return NextResponse.json(safe, {
      status: 200,
      headers: { "x-request-id": requestId },
    });
  }

  const insertPayload = {
    anonymous_id,
    page_version,
    landing_url: landing_url ?? null,
    referrer: referrer ?? null,
    utm_source: utm_source ?? null,
    utm_medium: utm_medium ?? null,
    utm_campaign: utm_campaign ?? null,
    utm_content: utm_content ?? null,
    utm_term: utm_term ?? null,
    fbclid: fbclid ?? null,
    fbc: fbc ?? null,
    fbp: fbp ?? null,
    device_category: device_category ?? null,
  };

  const { data: inserted, error } = await supabase
    .from("funnel_sessions")
    .insert(insertPayload as never)
    .select("id, anonymous_id, status, page_version, started_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: retry } = await supabase
        .from("funnel_sessions")
        .select("id, anonymous_id, status, page_version, started_at")
        .eq("anonymous_id", anonymous_id)
        .single();

      if (retry) {
        const safe = retry as {
          id: string; anonymous_id: string; status: string; page_version: string; started_at: string;
        };
        return NextResponse.json(safe, {
          status: 200,
          headers: { "x-request-id": requestId },
        });
      }
    }

    console.error("[funnel-sessions] insert error requestId=%s code=%s message=%s", requestId, error.code, error.message);
    return NextResponse.json(
      createPublicError(500, "Internal server error"),
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }

  const safe = inserted as {
    id: string; anonymous_id: string; status: string; page_version: string; started_at: string;
  };

  return NextResponse.json(safe, {
    status: 201,
    headers: { "x-request-id": requestId },
  });
}

export async function GET() {
  return NextResponse.json(
    createPublicError(405, "Method not allowed"),
    { status: 405 },
  );
}
