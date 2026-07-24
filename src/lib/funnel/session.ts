import { generateAnonymousId, saveSessionId, getSessionId } from "./persistence";

const PAGE_VERSION = "0.1.0";

export interface SessionResult {
  session_id: string;
  is_new: boolean;
}

function getParam(name: string): string | undefined {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get(name) ?? undefined;
  } catch {
    return undefined;
  }
}

function getCookie(name: string): string | undefined {
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=(.*?)(?:;|$)`),
    );
    return match ? decodeURIComponent(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

function getDeviceCategory(): string {
  try {
    const ua = navigator.userAgent.toLowerCase();
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(ua);
    const isTablet = /tablet|ipad/i.test(ua) && !isMobile;
    if (isTablet) return "tablet";
    if (isMobile) return "mobile";
    return "desktop";
  } catch {
    return "desktop";
  }
}

function getAttributionPayload(): Record<string, string | undefined> {
  return {
    utm_source: getParam("utm_source"),
    utm_medium: getParam("utm_medium"),
    utm_campaign: getParam("utm_campaign"),
    utm_content: getParam("utm_content"),
    utm_term: getParam("utm_term"),
    fbclid: getParam("fbclid"),
    fbc: getCookie("_fbc"),
    fbp: getCookie("_fbp"),
    landing_url: getLandingUrl(),
    referrer: getReferrer(),
    device_category: getDeviceCategory(),
  };
}

function getLandingUrl(): string | undefined {
  try {
    if (typeof window !== "undefined" && window.location) {
      return window.location.href;
    }
  } catch {
    /* not in browser */
  }
  return undefined;
}

function getReferrer(): string | undefined {
  try {
    if (typeof document !== "undefined") {
      return document.referrer || undefined;
    }
  } catch {
    /* not in browser */
  }
  return undefined;
}

export async function initializeSession(): Promise<SessionResult | null> {
  const existingId = getSessionId();
  if (existingId) {
    return { session_id: existingId, is_new: false };
  }

  const anonymous_id = generateAnonymousId();
  const attribution = getAttributionPayload();

  try {
    const response = await fetch("/api/funnel-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anonymous_id,
        page_version: PAGE_VERSION,
        ...attribution,
      }),
    });

    if (!response.ok) {
      console.warn("[session] failed to create session:", response.status);
      return null;
    }

    const data = (await response.json()) as { id: string };
    saveSessionId(data.id);
    return { session_id: data.id, is_new: true };
  } catch (err) {
    console.warn("[session] network error:", err);
    return null;
  }
}