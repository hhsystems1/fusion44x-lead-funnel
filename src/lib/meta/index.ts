import type {
  MetaEventPayload,
  MetaEventName,
  MetaUserData,
  CustomerInfo,
} from "@/types/tracking";
import { requireMetaCapiEnv, publicEnv } from "@/lib/env";
import { hashEmail, hashPhone, hashName, hashZipCode } from "./hash";

const META_API_VERSION = "v21.0";

export interface MetaConversionsApi {
  sendEvent(event: MetaEventPayload): Promise<Response>;
}

function getEndpoint(pixelId: string, accessToken: string): string {
  return `https://graph.facebook.com/${META_API_VERSION}/${pixelId}/events?access_token=${accessToken}`;
}

export function createMetaUserData(info: CustomerInfo): MetaUserData {
  const userData: MetaUserData = {};

  if (info.email) {
    userData.em = [hashEmail(info.email)];
  }
  if (info.phone) {
    userData.ph = [hashPhone(info.phone)];
  }
  if (info.first_name) {
    userData.fn = hashName(info.first_name);
  }
  if (info.last_name) {
    userData.ln = hashName(info.last_name);
  }
  if (info.zip_code) {
    userData.zp = hashZipCode(info.zip_code);
  }
  if (info.external_id) {
    userData.external_id = info.external_id;
  }
  if (info.client_ip_address) {
    userData.client_ip_address = info.client_ip_address;
  }
  if (info.client_user_agent) {
    userData.client_user_agent = info.client_user_agent;
  }
  if (info.fbc) {
    userData.fbc = info.fbc;
  }
  if (info.fbp) {
    userData.fbp = info.fbp;
  }

  return userData;
}

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

export function createMetaCapiClient(): MetaConversionsApi {
  const { accessToken } = requireMetaCapiEnv();
  const pixelId = publicEnv.NEXT_PUBLIC_META_PIXEL_ID;

  if (!pixelId) {
    throw new Error(
      "NEXT_PUBLIC_META_PIXEL_ID is not set. " +
        "Add it to .env.local (see .env.example).",
    );
  }

  const endpoint = getEndpoint(pixelId, accessToken);

  return {
    async sendEvent(event: MetaEventPayload): Promise<Response> {
      const body = JSON.stringify({ data: [event] });

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(
          "[meta/capi] sendEvent failed status=%d body=%s event_name=%s event_id=%s",
          response.status,
          errorBody,
          event.event_name,
          event.event_id,
        );
      }

      return response;
    },
  };
}

export function tryCreateMetaCapiClient(): MetaConversionsApi | null {
  try {
    return createMetaCapiClient();
  } catch {
    return null;
  }
}
