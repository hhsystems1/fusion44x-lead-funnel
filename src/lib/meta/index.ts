import type {
  MetaEventPayload,
  MetaEventName,
  MetaUserData,
  CustomerInfo,
} from "@/types/tracking";
import { requireMetaCapiEnv, publicEnv } from "@/lib/env";

export interface MetaConversionsApi {
  sendEvent(event: MetaEventPayload): Promise<Response>;
}

/**
 * Build the Meta user_data object from raw customer info.
 *
 * Hashing notes:
 *  - Fields marked `[HASH]` must be SHA256-hashed before sending.
 *    Hashing is NOT YET IMPLEMENTED — raw values are passed through.
 *  - Fields marked `[RAW]` must be sent as-is.
 *
 * @see docs/tracking-plan.md — Hashing Reference
 */
export function createMetaUserData(info: CustomerInfo): MetaUserData {
  return {
    em: info.email ? [info.email] : undefined,
    ph: info.phone ? [info.phone] : undefined,
    fn: info.first_name,
    ln: info.last_name,
    zp: info.zip_code,
    external_id: info.external_id,
    client_ip_address: info.client_ip_address,
    client_user_agent: info.client_user_agent,
    fbc: info.fbc,
    fbp: info.fbp,
  };
}

/**
 * Build a complete Meta CAPI event payload.
 */
export function createMetaPayload(params: {
  event_name: MetaEventName;
  event_id: string;
  event_source_url?: string;
  action_source: "website" | "server";
  customer_info: CustomerInfo;
  custom_data?: Record<string, unknown>;
}): MetaEventPayload {
  return {
    event_name: params.event_name,
    event_id: params.event_id,
    event_time: Math.floor(Date.now() / 1000),
    event_source_url: params.event_source_url,
    action_source: params.action_source,
    user_data: createMetaUserData(params.customer_info),
    custom_data: params.custom_data,
  };
}

/** Create a Meta Conversions API client. Validates env on first call. */
export function createMetaCapiClient(): MetaConversionsApi {
  requireMetaCapiEnv();
  const pixelId = publicEnv.NEXT_PUBLIC_META_PIXEL_ID;

  if (!pixelId) {
    throw new Error(
      "NEXT_PUBLIC_META_PIXEL_ID is not set. " +
        "Add it to .env.local (see .env.example).",
    );
  }

  throw new Error(
    `Meta CAPI client not implemented. ` +
      `Token and pixel ID detected. ` +
      `Implement the client in src/lib/meta/index.ts.`,
  );
}
