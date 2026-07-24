import type { InternalEventName } from "@/config/tracking-events";
import type { FunnelStepId, DiagnosticQuestionId } from "@/types/funnel";

const PAGE_VERSION = "0.1.0";

interface TrackerConfig {
  session_id: string;
}

interface TrackOptions {
  step_id?: FunnelStepId;
  question_id?: DiagnosticQuestionId;
  answer_code?: string;
  duration_ms?: number;
  lead_id?: string;
  metadata?: Record<string, unknown>;
}

export function createTracker(config: TrackerConfig) {
  const { session_id } = config;

  function track(event_name: InternalEventName, options?: TrackOptions): void {
    const payload: Record<string, unknown> = {
      session_id,
      event_name,
      page_version: PAGE_VERSION,
    };

    if (options?.step_id) payload.step_id = options.step_id;
    if (options?.question_id) payload.question_id = options.question_id;
    if (options?.answer_code) payload.answer_code = options.answer_code;
    if (options?.duration_ms != null) payload.duration_ms = options.duration_ms;
    if (options?.lead_id) payload.lead_id = options.lead_id;
    if (options?.metadata) payload.metadata = options.metadata;

    const body = JSON.stringify(payload);

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/funnel-events", blob);
    } else {
      fetch("/api/funnel-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {
        /* silent failure */
      });
    }

    if (process.env.NODE_ENV === "development") {
      console.info("[tracker]", event_name, options ?? "");
    }
  }

  return { track };
}

export type Tracker = ReturnType<typeof createTracker>;
