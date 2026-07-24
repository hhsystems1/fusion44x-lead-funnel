import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";
import { leadCreateSchema, normalizeEmail, normalizePhone } from "@/lib/validation/api-schemas";
import {
  readJsonBody,
  extractClientIp,
  generateRequestId,
  checkRateLimit,
  createPublicError,
  BodyTooLargeError,
  JsonParseError,
} from "@/lib/server/request-protection";

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

  const parsed = leadCreateSchema.safeParse(body);
  if (!parsed.success) {
    console.warn(
      "[leads] validation error requestId=%s errors=%j",
      requestId,
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
    return NextResponse.json(
      createPublicError(422, "Validation failed"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  const { session_id, contact, diagnostic, consent, source } = parsed.data;

  const email = normalizeEmail(contact.email);
  const phone = normalizePhone(contact.phone);

  const supabase = getServerSupabaseClient();

  const { data: leadId, error: rpcError } = await supabase.rpc(
    "create_lead_from_funnel_session",
    {
      p_session_id: session_id,
      p_first_name: contact.first_name,
      p_last_name: contact.last_name,
      p_email: email,
      p_phone: phone,
      p_zip_code: contact.zip_code,
      p_water_feature: diagnostic.water_feature,
      p_installation_type: diagnostic.installation_type,
      p_pool_size: diagnostic.pool_size,
      p_current_treatment: diagnostic.current_treatment,
      p_current_issues: diagnostic.current_issues,
      p_primary_goal: diagnostic.primary_goal,
      p_consent_to_contact: consent.consent_to_contact,
      p_consent_text_version: consent.consent_text_version,
      p_preferred_contact_method: contact.preferred_contact_method ?? null,
      p_marketing_consent: consent.marketing_consent,
      p_source: source ?? null,
    } as never,
  );

  if (rpcError) {
    console.error(
      "[leads] rpc error requestId=%s message=%s",
      requestId,
      rpcError.message,
    );
    return NextResponse.json(
      createPublicError(500, "Internal server error"),
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }

  return NextResponse.json(
    { success: true, lead_id: leadId },
    { status: 201, headers: { "x-request-id": requestId } },
  );
}

export async function GET() {
  return NextResponse.json(
    createPublicError(405, "Method not allowed"),
    { status: 405 },
  );
}
