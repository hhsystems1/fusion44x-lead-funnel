import type { NextRequest } from "next/server";
import { tryCreateMetaCapiClient, createMetaPayload } from "@/lib/meta";
import { MetaEvents } from "@/config/tracking-events";
import type { getServerSupabaseClient } from "@/lib/supabase";

export interface ContactEventParams {
  clientIp: string | null;
  request: NextRequest;
  event_id?: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  zip_code: string;
  session_id: string;
  supabase: ReturnType<typeof getServerSupabaseClient>;
}

export async function fireMetaContactEvent(params: ContactEventParams) {
  const client = tryCreateMetaCapiClient();
  if (!client) return;

  const metaEventId = params.event_id ?? crypto.randomUUID();
  const clientUserAgent = params.request.headers.get("user-agent") ?? undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRow: any = await params.supabase
    .from("funnel_sessions")
    .select("fbc, fbp")
    .eq("id", params.session_id)
    .single()
    .then((r) => r.data);

  const payload = createMetaPayload({
    event_name: MetaEvents.LEAD,
    event_id: metaEventId,
    event_source_url: params.request.headers.get("referer") ?? undefined,
    action_source: "website",
    customer_info: {
      email: params.email,
      phone: params.phone,
      first_name: params.first_name,
      last_name: params.last_name,
      zip_code: params.zip_code,
      client_ip_address: params.clientIp ?? undefined,
      client_user_agent: clientUserAgent,
      fbc: sessionRow?.fbc as string | undefined,
      fbp: sessionRow?.fbp as string | undefined,
    },
  });

  try {
    await client.sendEvent(payload);
  } catch {
    // CAPI failures must never break the lead creation flow
  }
}
