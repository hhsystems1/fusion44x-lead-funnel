import { describe, it, expect, beforeEach, vi } from "vitest";
import { InternalEvents } from "@/config/tracking-events";

const beaconSpy = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  vi.stubGlobal("navigator", { sendBeacon: beaconSpy });
  vi.stubGlobal("process", {
    ...process,
    env: { ...process.env, NODE_ENV: "test" },
  });
});

import { createTracker } from "@/lib/analytics/tracker";
import { ALL_INTERNAL_EVENT_NAMES } from "@/config/tracking-events";

async function getPayload(): Promise<Record<string, unknown>> {
  const [, blob] = beaconSpy.mock.calls[0];
  const text = await blob.text();
  return JSON.parse(text);
}

describe("tracker payload construction", () => {
  it("includes session_id in every event", async () => {
    const t = createTracker({ session_id: "my-session" });
    t.track(InternalEvents.PAGE_VIEWED);

    const payload = await getPayload();
    expect(payload.session_id).toBe("my-session");
  });

  it("includes page_version in every event", async () => {
    const t = createTracker({ session_id: "s1" });
    t.track(InternalEvents.PAGE_VIEWED);

    const payload = await getPayload();
    expect(payload.page_version).toBe("0.1.0");
  });

  it("includes step_id when provided", async () => {
    const t = createTracker({ session_id: "s1" });
    t.track(InternalEvents.PAGE_VIEWED, { step_id: "hero" });

    const payload = await getPayload();
    expect(payload.step_id).toBe("hero");
  });

  it("includes question_id and answer_code when provided", async () => {
    const t = createTracker({ session_id: "s1" });
    t.track(InternalEvents.QUESTION_ANSWERED, {
      question_id: "water-feature",
      answer_code: "pool",
    });

    const payload = await getPayload();
    expect(payload.question_id).toBe("water-feature");
    expect(payload.answer_code).toBe("pool");
  });

  it("all canonical event names can be tracked", () => {
    const t = createTracker({ session_id: "s1" });
    for (const name of ALL_INTERNAL_EVENT_NAMES) {
      expect(() => t.track(name)).not.toThrow();
    }
  });

  it("does not include diagnostic answers in metadata when answer_code exists", async () => {
    const t = createTracker({ session_id: "s1" });
    t.track(InternalEvents.QUESTION_ANSWERED, {
      question_id: "water-feature",
      answer_code: "pool",
      metadata: { extra: "info" },
    });

    const payload = await getPayload();
    expect(payload.answer_code).toBe("pool");
    if (payload.metadata) {
      expect(payload.metadata).not.toHaveProperty("water_feature");
    }
  });
});
