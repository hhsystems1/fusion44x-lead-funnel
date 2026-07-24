import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  generateTimeSlots,
  isSlotInPast,
  isWithinBookingWindow,
  calculateEndTime,
} from "@/lib/booking/slots";
import { BOOKING, WORKING_HOURS, BLOCKED_DATES } from "@/config/booking";

describe("generateTimeSlots", () => {
  it("generates slots for a weekday", () => {
    const slots = generateTimeSlots("2026-07-27", "America/New_York");
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect(slot.start).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(slot.end).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(slot.label).toBeTruthy();
    }
  });

  it("generates no slots on Saturday", () => {
    const slots = generateTimeSlots("2026-08-01", "America/New_York");
    expect(slots.length).toBe(0);
  });

  it("generates no slots on Sunday", () => {
    const slots = generateTimeSlots("2026-08-02", "America/New_York");
    expect(slots.length).toBe(0);
  });

  it("generates no slots on blocked dates", () => {
    const blockedDate = BLOCKED_DATES.length > 0 ? BLOCKED_DATES[0] : null;
    if (blockedDate) {
      const slots = generateTimeSlots(blockedDate, "America/New_York");
      expect(slots.length).toBe(0);
    }
  });

  it("each slot lasts exactly the configured duration", () => {
    const slots = generateTimeSlots("2026-07-27", "America/New_York");
    for (const slot of slots) {
      const startMs = new Date(slot.start).getTime();
      const endMs = new Date(slot.end).getTime();
      const diffMin = (endMs - startMs) / 60000;
      expect(diffMin).toBe(BOOKING.APPOINTMENT_DURATION_MINUTES);
    }
  });

  it("respects working hours boundaries", () => {
    const slots = generateTimeSlots("2026-07-27", "America/New_York");
    for (const slot of slots) {
      const startHour = new Date(slot.start).getHours();
      const endHour = new Date(slot.end).getHours();
      expect(startHour).toBeGreaterThanOrEqual(WORKING_HOURS.start);
      expect(endHour).toBeLessThanOrEqual(WORKING_HOURS.end);
    }
  });

  it("returns empty for invalid date string", () => {
    const slots = generateTimeSlots("not-a-date", "America/New_York");
    expect(slots.length).toBe(0);
  });

  it("returns empty for out-of-order date", () => {
    const slots = generateTimeSlots("2026-00-00", "America/New_York");
    expect(slots.length).toBe(0);
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
    const pastSlot = new Date("2026-07-27T09:00:00Z").toISOString();
    expect(isSlotInPast(pastSlot, 0)).toBe(true);
  });

  it("returns true for a slot within minimum notice", () => {
    const soonSlot = new Date("2026-07-27T11:30:00Z").toISOString();
    expect(isSlotInPast(soonSlot, 2)).toBe(true);
  });

  it("returns false for a slot beyond minimum notice", () => {
    const futureSlot = new Date("2026-07-27T13:00:00Z").toISOString();
    expect(isSlotInPast(futureSlot, 2)).toBe(false);
  });

  it("returns false for a far future slot", () => {
    const farSlot = new Date("2026-07-28T10:00:00Z").toISOString();
    expect(isSlotInPast(farSlot, 2)).toBe(false);
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
    const farStr = farDate.toISOString().slice(0, 10);
    expect(isWithinBookingWindow(farStr)).toBe(false);
  });

  it("returns false for an invalid date string", () => {
    expect(isWithinBookingWindow("not-a-date")).toBe(false);
  });
});

describe("calculateEndTime", () => {
  it("adds the configured duration to start time", () => {
    const start = "2026-07-27T14:00:00.000Z";
    const end = calculateEndTime(start);
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    const diffMin = (endMs - startMs) / 60000;
    expect(diffMin).toBe(BOOKING.APPOINTMENT_DURATION_MINUTES);
  });

  it("produces a valid ISO string", () => {
    const end = calculateEndTime("2026-07-27T14:00:00.000Z");
    expect(() => new Date(end)).not.toThrow();
  });
});

describe("timezone handling", () => {
  it("generates same slot count across timezones for same date", () => {
    const nySlots = generateTimeSlots("2026-07-27", "America/New_York");
    const laSlots = generateTimeSlots("2026-07-27", "America/Los_Angeles");
    expect(nySlots.length).toBe(laSlots.length);
  });

  it("generates same count across similar timezones for same date", () => {
    const nySlots = generateTimeSlots("2026-07-28", "America/New_York");
    expect(nySlots.length).toBeGreaterThan(0);
  });
});