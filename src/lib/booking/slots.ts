import { z } from "zod";
import { BOOKING, WORKING_HOURS, WORKING_DAYS, BLOCKED_DATES } from "@/config/booking";
import type { SupabaseClient } from "@supabase/supabase-js";

export const availabilityQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format"),
  timezone: z.string().min(1).max(64).default(BOOKING.TIMEZONE),
});

export type AvailabilityQuery = z.input<typeof availabilityQuerySchema>;

export const bookingCreateSchema = z.object({
  lead_id: z.string().uuid(),
  session_id: z.string().uuid(),
  start_time: z.string().datetime({ message: "start_time must be ISO 8601" }),
  timezone: z.string().min(1).max(64),
  event_id: z.string().uuid(),
});

export type BookingCreateInput = z.input<typeof bookingCreateSchema>;

export { BOOKING, WORKING_HOURS, WORKING_DAYS, BLOCKED_DATES };

// =============================================================================
// Timezone-safe date conversions (Intl-based, no external deps)
// =============================================================================

function getDateComponents(dateStr: string): { y: number; m: number; d: number } | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { y: parseInt(match[1]), m: parseInt(match[2]), d: parseInt(match[3]) };
}

function dateFromComponents(y: number, m: number, d: number, h: number, min: number, timezone: string): Date {
  const utcDate = new Date(Date.UTC(y, m - 1, d, h, min, 0, 0));
  const localStr = utcDate.toLocaleString("en-US", { timeZone: timezone });
  const parsed = new Date(localStr);
  const offsetMs = parsed.getTime() - utcDate.getTime();
  return new Date(utcDate.getTime() - offsetMs);
}

export function getLocalMidnightMs(dateStr: string, timezone: string): number {
  const comps = getDateComponents(dateStr);
  if (!comps) return NaN;
  try {
    return dateFromComponents(comps.y, comps.m, comps.d, 0, 0, timezone).getTime();
  } catch {
    return NaN;
  }
}

export function getDayBoundariesUtc(
  dateStr: string,
  timezone: string,
): { dayStartUtc: string; dayEndUtc: string } | null {
  const midnightMs = getLocalMidnightMs(dateStr, timezone);
  if (isNaN(midnightMs)) return null;
  const dayStartUtc = new Date(midnightMs).toISOString();
  const dayEndUtc = new Date(midnightMs + 24 * 60 * 60 * 1000).toISOString();
  return { dayStartUtc, dayEndUtc };
}

function getDayOfWeekInZone(dateStr: string, timezone: string): number {
  const comps = getDateComponents(dateStr);
  if (!comps) return -1;
  try {
    const noonUtc = dateFromComponents(comps.y, comps.m, comps.d, 12, 0, timezone);
    return noonUtc.getUTCDay();
  } catch {
    return -1;
  }
}

// =============================================================================
// End time calculation
// =============================================================================

export function calculateEndTime(startTimeIso: string): string {
  const start = new Date(startTimeIso);
  const end = new Date(start.getTime() + BOOKING.APPOINTMENT_DURATION_MINUTES * 60 * 1000);
  return end.toISOString();
}

// =============================================================================
// Slot generation
// =============================================================================

export function generateTimeSlots(dateStr: string, timezone: string): Array<{ start: string; end: string; label: string }> {
  const slots: Array<{ start: string; end: string; label: string }> = [];
  const comps = getDateComponents(dateStr);
  if (!comps) return slots;

  const dayOfWeek = getDayOfWeekInZone(dateStr, timezone);
  if (!WORKING_DAYS.includes(dayOfWeek)) return slots;
  if (BLOCKED_DATES.includes(dateStr)) return slots;

  const midnightMs = getLocalMidnightMs(dateStr, timezone);
  if (isNaN(midnightMs)) return slots;

  const workStartMs = midnightMs + WORKING_HOURS.start * 60 * 60 * 1000;
  const workEndMs = midnightMs + WORKING_HOURS.end * 60 * 60 * 1000;
  const intervalMs = BOOKING.SLOT_INTERVAL_MINUTES * 60 * 1000;
  const durationMs = BOOKING.APPOINTMENT_DURATION_MINUTES * 60 * 1000;
  const bufferAfterMs = BOOKING.BUFFER_AFTER_MINUTES * 60 * 1000;

  let slotStartMs = workStartMs;
  while (slotStartMs + durationMs + bufferAfterMs <= workEndMs) {
    const slotEndMs = slotStartMs + durationMs;
    slots.push({
      start: new Date(slotStartMs).toISOString(),
      end: new Date(slotEndMs).toISOString(),
      label: formatTimeLabel(new Date(slotStartMs), timezone),
    });
    slotStartMs += intervalMs;
  }

  return slots;
}

// =============================================================================
// Validation helpers
// =============================================================================

export function isSlotInPast(slotStartIso: string, minimumNoticeHours: number): boolean {
  const now = Date.now();
  const noticeMs = minimumNoticeHours * 60 * 60 * 1000;
  return new Date(slotStartIso).getTime() <= now + noticeMs;
}

export function isWithinBookingWindow(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseDateOnly(dateStr);
  if (!target) return false;
  const diffMs = target.getTime() - today.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= BOOKING.BOOKING_WINDOW_DAYS;
}

export function isWorkingDay(dateStr: string, timezone: string): boolean {
  const dow = getDayOfWeekInZone(dateStr, timezone);
  return WORKING_DAYS.includes(dow);
}

export function isBlockedDate(dateStr: string): boolean {
  return BLOCKED_DATES.includes(dateStr);
}

export function isExactSlot(
  startTimeIso: string,
  dateStr: string,
  timezone: string,
): boolean {
  const slots = generateTimeSlots(dateStr, timezone);
  return slots.some((s) => s.start === startTimeIso);
}

/**
 * Check whether the given start_time overlaps any active (pending/confirmed)
 * appointments. Optionally exclude a specific appointment ID (for rescheduling).
 * Returns true if the slot is available (no conflict).
 */
export async function isSlotAvailable(
  startTimeIso: string,
  endTimeIso: string,
  supabase: SupabaseClient,
): Promise<boolean> {
  const bufBeforeMs = BOOKING.BUFFER_BEFORE_MINUTES * 60 * 1000;
  const bufAfterMs = BOOKING.BUFFER_AFTER_MINUTES * 60 * 1000;

  const windowStart = new Date(new Date(startTimeIso).getTime() - bufBeforeMs).toISOString();
  const windowEnd = new Date(new Date(endTimeIso).getTime() + bufAfterMs).toISOString();

  const { data } = await supabase
    .from("appointments")
    .select("id")
    .in("status", ["pending", "confirmed"])
    .lt("start_time", windowEnd)
    .gt("end_time", windowStart)
    .maybeSingle();

  return data === null;
}

export function validateTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Formatting
// =============================================================================

function parseDateOnly(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d), 0, 0, 0, 0);
}

function formatTimeLabel(date: Date, timezone: string): string {
  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
    hour12: true,
  };
  return date.toLocaleTimeString("en-US", options);
}

export function formatDateLabel(dateStr: string): string {
  const d = parseDateOnly(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}