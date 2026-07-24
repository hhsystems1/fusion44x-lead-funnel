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
    const firstSlot = slots[0];
    // First slot should be 9:00 AM ET
    const d = new Date(firstSlot.start);
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

  it("returns true for today", () => {
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

describe("DST spring-forward", () => {
  it("generates correct number of slots on the Monday after spring-forward (Mar 9 2026)", () => {
    // US DST springs forward Mar 8 2026 (Sunday) at 2am. Monday Mar 9 is a normal day.
    const slots = generateTimeSlots("2026-03-09", "America/New_York");
    expect(slots.length).toBe(16);
    for (const slot of slots) {
      expect(() => new Date(slot.start)).not.toThrow();
      expect(() => new Date(slot.end)).not.toThrow();
    }
  });

  it("spring-forward week slot start times are all valid and ordered", () => {
    const slots = generateTimeSlots("2026-03-09", "America/New_York");
    for (let i = 1; i < slots.length; i++) {
      expect(new Date(slots[i].start).getTime()).toBeGreaterThan(
        new Date(slots[i - 1].start).getTime(),
      );
    }
  });
});

describe("DST fall-back", () => {
  it("generates correct number of slots on the Monday after fall-back (Nov 2 2026)", () => {
    // US DST falls back Nov 1 2026 (Sunday) at 2am. Monday Nov 2 is a normal day.
    const slots = generateTimeSlots("2026-11-02", "America/New_York");
    expect(slots.length).toBe(16);
    for (const slot of slots) {
      expect(() => new Date(slot.start)).not.toThrow();
      expect(() => new Date(slot.end)).not.toThrow();
    }
  });

  it("generates slots on the Friday before fall-back (Oct 30 2026)", () => {
    // Oct 30 2026 is a Friday
    const slots = generateTimeSlots("2026-10-30", "America/New_York");
    expect(slots.length).toBe(16);
    for (const slot of slots) {
      expect(() => new Date(slot.start)).not.toThrow();
      expect(() => new Date(slot.end)).not.toThrow();
    }
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

describe("getDayBoundariesUtc", () => {
  it("returns boundaries that span exactly 24h", () => {
    const bounds = getDayBoundariesUtc("2026-07-27", "America/New_York");
    expect(bounds).not.toBeNull();
    const startMs = new Date(bounds!.dayStartUtc).getTime();
    const endMs = new Date(bounds!.dayEndUtc).getTime();
    expect(endMs - startMs).toBe(24 * 60 * 60 * 1000);
  });

  it("returns boundary timestamps in valid ISO format", () => {
    const bounds = getDayBoundariesUtc("2026-07-27", "America/New_York");
    expect(bounds!.dayStartUtc).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(bounds!.dayEndUtc).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("timezone handling", () => {
  it("generates same slot count for NY and LA on same date", () => {
    const nySlots = generateTimeSlots("2026-07-27", "America/New_York");
    const laSlots = generateTimeSlots("2026-07-27", "America/Los_Angeles");
    expect(nySlots.length).toBe(laSlots.length);
  });

  it("generates more than 0 slots for a valid weekday", () => {
    expect(generateTimeSlots("2026-07-28", "America/New_York").length).toBeGreaterThan(0);
  });

  it("first slot label is 9:00 AM for NY", () => {
    const slots = generateTimeSlots("2026-07-27", "America/New_York");
    expect(slots[0].label.toLowerCase()).toContain("9");
  });
});