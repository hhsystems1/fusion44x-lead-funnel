import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";
import { exitPopupLeadSchema, normalizeEmail, normalizePhone } from "@/lib/validation/api-schemas";
import {
  readJsonBody,
  extractClientIp,
  generateRequestId,
  checkRateLimit,
  createPublicError,
  BodyTooLargeError,
  JsonParseError,
} from "@/lib/server/request-protection";
import { mapLeadRpcError } from "@/lib/server/lead-rpc-errors";
import { fireMetaContactEvent } from "@/lib/meta/contact-event";
import { deriveLeadSource } from "@/lib/funnel/source";

const RATE_LIMIT = { maxRequests: 5, windowMs: 60_000 };

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

  const parsed = exitPopupLeadSchema.safeParse(body);
  if (!parsed.success) {
    console.warn(
      "[exit-popup] validation error requestId=%s errors=%j",
      requestId,
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
    return NextResponse.json(
      createPublicError(422, "Validation failed"),
      { status: 422, headers: { "x-request-id": requestId } },
    );
  }

  const { session_id, contact, consent, source, event_id } = parsed.data;

  const email = normalizeEmail(contact.email);
  const phone = contact.phone ? normalizePhone(contact.phone) : "";

  const supabase = getServerSupabaseClient();

  const { data: sessionRow } = await supabase
    .from("funnel_sessions")
    .select("utm_source, referrer")
    .eq("id", session_id)
    .maybeSingle();

  const leadSource = source ?? deriveLeadSource(sessionRow);

  const { data: leadId, error: rpcError } = await supabase.rpc(
    "create_lead_from_popup",
    {
      p_session_id: session_id,
      p_first_name: contact.first_name,
      p_last_name: contact.last_name,
      p_email: email,
      p_phone: phone,
      p_zip_code: contact.zip_code ?? null,
      p_consent_to_contact: consent.consent_to_contact,
      p_consent_text_version: consent.consent_text_version,
      p_marketing_consent: consent.marketing_consent,
      p_source: leadSource ?? null,
    } as never,
  );

  if (rpcError) {
    const mapped = rpcError.code ? mapLeadRpcError(rpcError.code) : null;
    if (mapped) {
      console.warn(
        "[exit-popup] rpc error requestId=%s code=%s",
        requestId,
        rpcError.code,
      );
      return NextResponse.json(
        createPublicError(mapped.status, mapped.message),
        { status: mapped.status, headers: { "x-request-id": requestId } },
      );
    }
    console.error(
      "[exit-popup] unexpected rpc error requestId=%s code=%s",
      requestId,
      rpcError.code ?? "unknown",
    );
    return NextResponse.json(
      createPublicError(500, "Internal server error"),
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }

  fireMetaContactEvent({
    clientIp,
    request,
    event_id,
    email,
    phone,
    first_name: contact.first_name,
    last_name: contact.last_name,
    zip_code: contact.zip_code ?? "",
    session_id,
    supabase,
  });

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
