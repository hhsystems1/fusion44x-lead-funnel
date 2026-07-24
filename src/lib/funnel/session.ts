import { generateAnonymousId, saveSessionId, getSessionId } from "./persistence";

const PAGE_VERSION = "0.1.0";

export interface SessionResult {
  session_id: string;
  is_new: boolean;
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

  try {
    const response = await fetch("/api/funnel-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anonymous_id,
        page_version: PAGE_VERSION,
        landing_url: getLandingUrl(),
        referrer: getReferrer(),
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
