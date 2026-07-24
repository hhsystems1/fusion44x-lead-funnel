import { describe, it, expect, beforeEach, vi } from "vitest";
import { InternalEvents } from "@/config/tracking-events";

const beaconSpy = vi.fn();
const fetchSpy = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  fetchSpy.mockResolvedValue(new Response());

  vi.stubGlobal("fetch", fetchSpy);
  vi.stubGlobal("navigator", { sendBeacon: beaconSpy });
  vi.stubGlobal("process", {
    ...process,
    env: { ...process.env, NODE_ENV: "test" },
  });
});

import { createTracker } from "@/lib/analytics/tracker";

describe("tracker", () => {
  const tracker = createTracker({ session_id: "session-123" });

  it("sends page_viewed event via sendBeacon", () => {
    tracker.track(InternalEvents.PAGE_VIEWED, { step_id: "hero" });

    expect(beaconSpy).toHaveBeenCalledTimes(1);
    const [url] = beaconSpy.mock.calls[0];
    expect(url).toBe("/api/funnel-events");
  });

  it("includes session_id in payload", () => {
    tracker.track(InternalEvents.PAGE_VIEWED);

    expect(beaconSpy).toHaveBeenCalledWith(
      "/api/funnel-events",
      expect.any(Blob),
    );
  });

  it("includes optional fields", () => {
    tracker.track(InternalEvents.QUESTION_VIEWED, {
      step_id: "pool-diagnostic",
      question_id: "water-feature",
      answer_code: "pool",
      duration_ms: 1500,
    });

    expect(beaconSpy).toHaveBeenCalledTimes(1);
  });

  it("falls back to fetch when sendBeacon is unavailable", () => {
    const noBeacon = createTracker({ session_id: "s1" });
    vi.stubGlobal("navigator", {});

    noBeacon.track(InternalEvents.PAGE_VIEWED);

    expect(fetchSpy).toHaveBeenCalledWith("/api/funnel-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: expect.any(String),
      keepalive: true,
    });
  });

  it("handles fetch failure silently", () => {
    const noBeacon = createTracker({ session_id: "s1" });
    vi.stubGlobal("navigator", {});
    fetchSpy.mockRejectedValueOnce(new Error("Network error"));

    expect(() => {
      noBeacon.track(InternalEvents.PAGE_VIEWED);
    }).not.toThrow();
  });
});
