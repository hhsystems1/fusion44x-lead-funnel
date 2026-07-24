import { z } from "zod";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
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
// Timezone-safe date conversions (date-fns-tz, no Intl string parsing)
// =============================================================================

function getDateComponents(dateStr: string): { y: number; m: number; d: number } | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { y: parseInt(match[1]), m: parseInt(match[2]), d: parseInt(match[3]) };
}

function getNextDateStr(dateStr: string): string | null {
  const comps = getDateComponents(dateStr);
  if (!comps) return null;
  const d = new Date(Date.UTC(comps.y, comps.m - 1, comps.d + 1));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getLocalMidnightMs(dateStr: string, timezone: string): number {
  const comps = getDateComponents(dateStr);
  if (!comps) return NaN;
  try {
    return fromZonedTime(`${dateStr}T00:00:00`, timezone).getTime();
  } catch {
    return NaN;
  }
}

export function getDayBoundariesUtc(
  dateStr: string,
  timezone: string,
): { dayStartUtc: string; dayEndUtc: string } | null {
  const comps = getDateComponents(dateStr);
  if (!comps) return null;
  const nextDateStr = getNextDateStr(dateStr);
  if (!nextDateStr) return null;
  try {
    const dayStartUtc = fromZonedTime(`${dateStr}T00:00:00`, timezone);
    const dayEndUtc = fromZonedTime(`${nextDateStr}T00:00:00`, timezone);
    return {
      dayStartUtc: dayStartUtc.toISOString(),
      dayEndUtc: dayEndUtc.toISOString(),
    };
  } catch {
    return null;
  }
}

function getDayOfWeekInZone(dateStr: string, timezone: string): number {
  const comps = getDateComponents(dateStr);
  if (!comps) return -1;
  try {
    const midnightUtc = fromZonedTime(`${dateStr}T00:00:00`, timezone);
    return midnightUtc.getUTCDay();
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

  const startHour = WORKING_HOURS.start;
  const endHour = WORKING_HOURS.end;
  const durationMin = BOOKING.APPOINTMENT_DURATION_MINUTES;
  const intervalMin = BOOKING.SLOT_INTERVAL_MINUTES;
  const bufferAfterMin = BOOKING.BUFFER_AFTER_MINUTES;

  const durationMs = durationMin * 60 * 1000;

  let slotStartMinutes = startHour * 60;
  const workEndMinutes = endHour * 60;

  while (slotStartMinutes + durationMin + bufferAfterMin <= workEndMinutes) {
    const h = Math.floor(slotStartMinutes / 60);
    const m = slotStartMinutes % 60;
    const localTimeStr = `${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    const slotStartUtc = fromZonedTime(localTimeStr, timezone);
    const slotEndUtc = new Date(slotStartUtc.getTime() + durationMs);

    slots.push({
      start: slotStartUtc.toISOString(),
      end: slotEndUtc.toISOString(),
      label: formatTimeLabel(slotStartUtc, timezone),
    });
    slotStartMinutes += intervalMin;
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
  const comps = getDateComponents(dateStr);
  if (!comps) return false;

  const now = new Date();
  const todayStr = formatInTimeZone(now, BOOKING.TIMEZONE, "yyyy-MM-dd");
  const todayComps = getDateComponents(todayStr);
  if (!todayComps) return false;

  const todayMidnightUtc = fromZonedTime(`${todayStr}T00:00:00`, BOOKING.TIMEZONE);
  const targetMidnightUtc = fromZonedTime(`${dateStr}T00:00:00`, BOOKING.TIMEZONE);

  const diffDays = Math.round(
    (targetMidnightUtc.getTime() - todayMidnightUtc.getTime()) / 86400000,
  );

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

export async function isSlotAvailable(
  startTimeIso: string,
  endTimeIso: string,
  supabase: SupabaseClient,
): Promise<boolean> {
  const bufBeforeMs = BOOKING.BUFFER_BEFORE_MINUTES * 60 * 1000;
  const bufAfterMs = BOOKING.BUFFER_AFTER_MINUTES * 60 * 1000;

  const windowStart = new Date(new Date(startTimeIso).getTime() - bufBeforeMs).toISOString();
  const windowEnd = new Date(new Date(endTimeIso).getTime() + bufAfterMs).toISOString();

  const { data, error } = await supabase
    .from("appointments")
    .select("id")
    .in("status", ["pending", "confirmed"])
    .lt("start_time", windowEnd)
    .gt("end_time", windowStart)
    .maybeSingle();

  if (error) {
    throw new Error(`Availability check failed: ${error.code}`);
  }

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

function formatTimeLabel(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, "h:mm a");
}

export function formatDateLabel(dateStr: string): string {
  const comps = getDateComponents(dateStr);
  if (!comps) return dateStr;
  const d = new Date(Date.UTC(comps.y, comps.m - 1, comps.d, 12, 0, 0));
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}