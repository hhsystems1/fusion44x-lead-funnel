import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  generateTimeSlots,
  isSlotInPast,
  isWithinBookingWindow,
  isWorkingDay,
  isBlockedDate,
  isExactSlot,
  calculateEndTime,
  getLocalMidnightMs,
  getDayBoundariesUtc,
} from "@/lib/booking/slots";
import { BOOKING, WORKING_HOURS, BLOCKED_DATES } from "@/config/booking";

describe("generateTimeSlots", () => {
  it("generates 16 slots for a weekday with 30-min interval from 9-17", () => {
    const slots = generateTimeSlots("2026-07-27", "America/New_York");
    // 9:00-17:00 = 8 hours = 16 half-hour slots
    expect(slots.length).toBe(16);
  });

  it("all generated slot labels are unique", () => {
    const slots = generateTimeSlots("2026-07-27", "America/New_York");
    const labels = slots.map((s) => s.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("generates no slots on Saturday", () => {
    expect(generateTimeSlots("2026-08-01", "America/New_York").length).toBe(0);
  });

  it("generates no slots on Sunday", () => {
    expect(generateTimeSlots("2026-08-02", "America/New_York").length).toBe(0);
  });

  it("generates no slots on blocked dates", () => {
    const blockedDate = BLOCKED_DATES.length > 0 ? BLOCKED_DATES[0] : null;
    if (blockedDate) {
      expect(generateTimeSlots(blockedDate, "America/New_York").length).toBe(0);
    }
  });

  it("each slot lasts exactly the configured duration", () => {
    const slots = generateTimeSlots("2026-07-27", "America/New_York");
    for (const slot of slots) {
      const diffMin = (new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60000;
      expect(diffMin).toBe(BOOKING.APPOINTMENT_DURATION_MINUTES);
    }
  });

  it("first slot starts at working start hour", () => {
    const slots = generateTimeSlots("2026-07-27", "America/New_York");
    expect(slots.length).toBeGreaterThan(0);
    const d = new Date(slots[0].start);
    const hourEt = parseInt(
      d.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }),
    );
    expect(hourEt).toBe(WORKING_HOURS.start);
  });

  it("last slot ends at or before working end hour", () => {
    const slots = generateTimeSlots("2026-07-27", "America/New_York");
    const lastSlot = slots[slots.length - 1];
    const d = new Date(lastSlot.end);
    const hourEt = parseInt(
      d.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }),
    );
    expect(hourEt).toBeLessThanOrEqual(WORKING_HOURS.end);
  });

  it("returns empty for invalid date string", () => {
    expect(generateTimeSlots("not-a-date", "America/New_York").length).toBe(0);
  });

  it("returns empty for out-of-order date", () => {
    expect(generateTimeSlots("2026-00-00", "America/New_York").length).toBe(0);
  });
});

describe("isSlotInPast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true for a slot in the past", () => {
    expect(isSlotInPast(new Date("2026-07-27T09:00:00Z").toISOString(), 0)).toBe(true);
  });

  it("returns true for a slot within minimum notice", () => {
    expect(isSlotInPast(new Date("2026-07-27T11:30:00Z").toISOString(), 2)).toBe(true);
  });

  it("returns false for a slot beyond minimum notice", () => {
    expect(isSlotInPast(new Date("2026-07-27T13:00:00Z").toISOString(), 2)).toBe(false);
  });

  it("returns false for a far future slot", () => {
    expect(isSlotInPast(new Date("2026-07-28T10:00:00Z").toISOString(), 2)).toBe(false);
  });
});

describe("isWithinBookingWindow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true for today in America/New_York", () => {
    expect(isWithinBookingWindow("2026-07-27")).toBe(true);
  });

  it("returns true for a date within the window", () => {
    expect(isWithinBookingWindow("2026-07-28")).toBe(true);
  });

  it("returns false for a past date", () => {
    expect(isWithinBookingWindow("2026-07-26")).toBe(false);
  });

  it("returns false for a date beyond the window", () => {
    const farDate = new Date();
    farDate.setDate(farDate.getDate() + BOOKING.BOOKING_WINDOW_DAYS + 1);
    expect(isWithinBookingWindow(farDate.toISOString().slice(0, 10))).toBe(false);
  });

  it("returns false for an invalid date string", () => {
    expect(isWithinBookingWindow("not-a-date")).toBe(false);
  });

  it("uses America/New_York date, not server timezone", () => {
    // Server is UTC (epoch 0 = Jan 1 1970 00:00 UTC = Dec 31 1969 19:00 EST)
    vi.setSystemTime(new Date(0));
    // In America/New_York, epoch 0 is Dec 31 1969 at 7:00 PM (EST, UTC-5)
    // The "today" in ET is 1969-12-31, not 1970-01-01
    expect(isWithinBookingWindow("1969-12-31")).toBe(true);
    // 1970-01-01 is the next day in ET (within 30-day window)
    expect(isWithinBookingWindow("1970-01-01")).toBe(true);
  });
});

describe("calculateEndTime", () => {
  it("adds the configured duration to start time", () => {
    const start = "2026-07-27T14:00:00.000Z";
    const end = calculateEndTime(start);
    const diffMin = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
    expect(diffMin).toBe(BOOKING.APPOINTMENT_DURATION_MINUTES);
  });

  it("produces a valid ISO string", () => {
    expect(() => new Date(calculateEndTime("2026-07-27T14:00:00.000Z"))).not.toThrow();
  });
});

describe("isWorkingDay", () => {
  it("returns true for Monday", () => {
    expect(isWorkingDay("2026-07-27", "America/New_York")).toBe(true);
  });

  it("returns true for Friday", () => {
    expect(isWorkingDay("2026-07-31", "America/New_York")).toBe(true);
  });

  it("returns false for Saturday", () => {
    expect(isWorkingDay("2026-08-01", "America/New_York")).toBe(false);
  });

  it("returns false for Sunday", () => {
    expect(isWorkingDay("2026-08-02", "America/New_York")).toBe(false);
  });
});

describe("isBlockedDate", () => {
  it("returns false for a normal date", () => {
    expect(isBlockedDate("2026-07-27")).toBe(false);
  });
});

describe("isExactSlot", () => {
  it("returns true for a valid generated slot", () => {
    const slots = generateTimeSlots("2026-07-27", "America/New_York");
    expect(slots.length).toBeGreaterThan(0);
    expect(isExactSlot(slots[0].start, "2026-07-27", "America/New_York")).toBe(true);
  });

  it("returns false for an arbitrary time", () => {
    expect(isExactSlot("2026-07-27T12:34:56.789Z", "2026-07-27", "America/New_York")).toBe(false);
  });

  it("returns false for a time not matching any slot", () => {
    expect(isExactSlot("2026-07-27T14:05:00.000Z", "2026-07-27", "America/New_York")).toBe(false);
  });
});

describe("DST spring-forward day boundaries", () => {
  // US DST springs forward Mar 8 2026 (Sunday) at 2:00 AM EST → 3:00 AM EDT
  // Midnight Mar 8 ET = 5:00 UTC (EST, UTC-5)
  // Midnight Mar 9 ET = 4:00 UTC (EDT, UTC-4)
  // Difference = 23 hours

  it("spring-forward day is 23 hours", () => {
    const bounds = getDayBoundariesUtc("2026-03-08", "America/New_York");
    expect(bounds).not.toBeNull();
    const startMs = new Date(bounds!.dayStartUtc).getTime();
    const endMs = new Date(bounds!.dayEndUtc).getTime();
    const diffHours = (endMs - startMs) / (1000 * 60 * 60);
    expect(diffHours).toBe(23);
  });

  it("generates correct slots on the Monday after spring-forward", () => {
    // Mar 9 2026 is Monday, EDT (UTC-4)
    const slots = generateTimeSlots("2026-03-09", "America/New_York");
    expect(slots.length).toBe(16);
    // 9:00 AM EDT = 13:00 UTC
    expect(slots[0].start).toBe("2026-03-09T13:00:00.000Z");
    for (const slot of slots) {
      expect(() => new Date(slot.start)).not.toThrow();
    }
  });
});

describe("DST fall-back day boundaries", () => {
  // US DST falls back Nov 1 2026 (Sunday) at 2:00 AM EDT → 1:00 AM EST
  // Midnight Nov 1 ET = 4:00 UTC (EDT, UTC-4)
  // Midnight Nov 2 ET = 5:00 UTC (EST, UTC-5)
  // Difference = 25 hours

  it("fall-back day is 25 hours", () => {
    const bounds = getDayBoundariesUtc("2026-11-01", "America/New_York");
    expect(bounds).not.toBeNull();
    const startMs = new Date(bounds!.dayStartUtc).getTime();
    const endMs = new Date(bounds!.dayEndUtc).getTime();
    const diffHours = (endMs - startMs) / (1000 * 60 * 60);
    expect(diffHours).toBe(25);
  });

  it("generates correct slots on the Monday after fall-back", () => {
    // Nov 2 2026 is Monday, EST (UTC-5)
    const slots = generateTimeSlots("2026-11-02", "America/New_York");
    expect(slots.length).toBe(16);
    // 9:00 AM EST = 14:00 UTC
    expect(slots[0].start).toBe("2026-11-02T14:00:00.000Z");
  });

  it("generates slots on the Friday before fall-back", () => {
    // Oct 30 2026 is Friday, EDT (UTC-4)
    const slots = generateTimeSlots("2026-10-30", "America/New_York");
    expect(slots.length).toBe(16);
    // 9:00 AM EDT = 13:00 UTC
    expect(slots[0].start).toBe("2026-10-30T13:00:00.000Z");
  });
});

describe("normal day boundaries", () => {
  it("normal day is 24 hours", () => {
    const bounds = getDayBoundariesUtc("2026-07-27", "America/New_York");
    expect(bounds).not.toBeNull();
    const startMs = new Date(bounds!.dayStartUtc).getTime();
    const endMs = new Date(bounds!.dayEndUtc).getTime();
    const diffHours = (endMs - startMs) / (1000 * 60 * 60);
    expect(diffHours).toBe(24);
  });

  it("returns boundary timestamps in valid ISO format", () => {
    const bounds = getDayBoundariesUtc("2026-07-27", "America/New_York");
    expect(bounds!.dayStartUtc).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(bounds!.dayEndUtc).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("9:00 AM label across DST dates", () => {
  it("shows 9:00 AM on spring-forward week", () => {
    const slots = generateTimeSlots("2026-03-09", "America/New_York");
    expect(slots[0].label).toBe("9:00 AM");
  });

  it("shows 9:00 AM on summer date (EDT)", () => {
    const slots = generateTimeSlots("2026-07-27", "America/New_York");
    expect(slots[0].label).toBe("9:00 AM");
  });

  it("shows 9:00 AM on fall-back week (EST)", () => {
    const slots = generateTimeSlots("2026-11-02", "America/New_York");
    expect(slots[0].label).toBe("9:00 AM");
  });

  it("shows 9:30 AM consistently across DST dates", () => {
    const summerSlots = generateTimeSlots("2026-07-27", "America/New_York");
    const fallSlots = generateTimeSlots("2026-11-02", "America/New_York");
    expect(summerSlots[1].label).toBe("9:30 AM");
    expect(fallSlots[1].label).toBe("9:30 AM");
  });
});

describe("getLocalMidnightMs", () => {
  it("returns valid epoch ms for a date in America/New_York", () => {
    const ms = getLocalMidnightMs("2026-07-27", "America/New_York");
    expect(isNaN(ms)).toBe(false);
    // Midnight July 27 2026 in ET should be 4am UTC (EDT, UTC-4)
    const utcDate = new Date(ms);
    expect(utcDate.getUTCHours()).toBe(4);
  });

  it("returns NaN for invalid date string", () => {
    expect(isNaN(getLocalMidnightMs("not-a-date", "America/New_York"))).toBe(true);
  });
});

describe("server timezone independence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("getDayBoundariesUtc is independent of server timezone", () => {
    // Set server time to different values
    const testCases = [
      "2026-07-27T00:00:00Z",
      "2026-07-27T12:00:00Z",
      "2026-07-27T23:00:00Z",
    ];
    for (const serverTime of testCases) {
      vi.setSystemTime(new Date(serverTime));
      const bounds = getDayBoundariesUtc("2026-07-27", "America/New_York");
      expect(bounds).not.toBeNull();
      expect(bounds!.dayStartUtc).toBe("2026-07-27T04:00:00.000Z");
      expect(bounds!.dayEndUtc).toBe("2026-07-28T04:00:00.000Z");
    }
  });

  it("generateTimeSlots is independent of server timezone", () => {
    const testCases = [
      "2026-07-27T00:00:00Z",
      "2026-07-27T12:00:00Z",
      "2026-07-27T23:00:00Z",
    ];
    for (const serverTime of testCases) {
      vi.setSystemTime(new Date(serverTime));
      const slots = generateTimeSlots("2026-07-27", "America/New_York");
      expect(slots.length).toBe(16);
      expect(slots[0].start).toBe("2026-07-27T13:00:00.000Z");
    }
  });

  it("isWithinBookingWindow uses America/New_York date, not server timezone", () => {
    // When server is UTC and it's Jan 1 1970 04:00 UTC = Dec 31 1969 23:00 EST
    // So the "today" in ET is 1969-12-31
    vi.setSystemTime(new Date("1970-01-01T04:00:00Z")); // Jan 1 1970 04:00 UTC
    // In ET: Dec 31 1969 23:00 EST
    expect(isWithinBookingWindow("1969-12-31")).toBe(true);
    // 1970-01-01 is tomorrow in ET
    expect(isWithinBookingWindow("1970-01-01")).toBe(true);
  });
});

describe("isSlotAvailable fails closed on DB errors", () => {
  it("throws error when Supabase returns an error", async () => {
    const mockSupabase = {
      from: () => ({
        select: () => ({
          in: () => ({
            lt: () => ({
              gt: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: null,
                    error: { code: "PGRST116", message: "Database error", details: "", hint: "" },
                  }),
              }),
            }),
          }),
        }),
      }),
    };

    const { isSlotAvailable } = await import("@/lib/booking/slots");
    await expect(
      isSlotAvailable(
        "2026-07-27T13:00:00.000Z",
        "2026-07-27T13:30:00.000Z",
        mockSupabase as never,
      ),
    ).rejects.toThrow("Availability check failed: PGRST116");
  });
});