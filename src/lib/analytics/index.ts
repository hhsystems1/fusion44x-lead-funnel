import type { InternalEventPayload } from "@/types/tracking";

/**
 * Track an internal (Supabase-bound) event from the browser.
 *
 * PII rules:
 *  - Never include email, phone, name, or other PII in the metadata field.
 *  - PII belongs only in Meta events (browser pixel + server CAPI)
 *    and the lead-creation API call.
 */
export function trackInternalEvent(event: InternalEventPayload): void {
  if (typeof window === "undefined") return;

  try {
    const {
      event_name,
      event_id,
      session_id,
      step_id,
      question_id,
      duration_ms,
    } = event;

    console.info("[Analytics] internal_event:", {
      event_name,
      event_id,
      session_id,
      step_id,
      question_id,
      duration_ms,
    });
  } catch {
    // Analytics failures must never break the user experience
  }
}
