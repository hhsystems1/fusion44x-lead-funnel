import { z } from "zod";
import { BOOKING, WORKING_HOURS, WORKING_DAYS, BLOCKED_DATES } from "@/config/booking";

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

export function calculateEndTime(startTimeIso: string): string {
  const start = new Date(startTimeIso);
  const end = new Date(start.getTime() + BOOKING.APPOINTMENT_DURATION_MINUTES * 60 * 1000);
  return end.toISOString();
}

function getMidnightUtc(dateStr: string, timezone: string): number {
  try {
    const date = new Date(`${dateStr}T12:00:00Z`);
    if (isNaN(date.getTime())) return NaN;
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    };
    const parts = new Intl.DateTimeFormat("en-CA", options).formatToParts(date);
    const localDateStr = parts
      .filter((p) => p.type === "year" || p.type === "month" || p.type === "day")
      .map((p) => p.value.padStart(2, "0"))
      .join("-");
    const midnightLocal = new Date(`${localDateStr}T00:00:00`);
    return midnightLocal.getTime();
  } catch {
    return NaN;
  }
}

function getDayOfWeek(dateStr: string, timezone: string): number {
  const midnightMs = getMidnightUtc(dateStr, timezone);
  return new Date(midnightMs).getUTCDay();
}

export function generateTimeSlots(dateStr: string, timezone: string): Array<{ start: string; end: string; label: string }> {
  const slots: Array<{ start: string; end: string; label: string }> = [];

  const midnightMs = getMidnightUtc(dateStr, timezone);
  if (isNaN(midnightMs)) return slots;

  const dayOfWeek = getDayOfWeek(dateStr, timezone);
  if (!WORKING_DAYS.includes(dayOfWeek)) return slots;

  if (BLOCKED_DATES.includes(dateStr)) return slots;

  const workStartMs = midnightMs + WORKING_HOURS.start * 60 * 60 * 1000;
  const workEndMs = midnightMs + WORKING_HOURS.end * 60 * 60 * 1000;
  const intervalMs = BOOKING.SLOT_INTERVAL_MINUTES * 60 * 1000;
  const durationMs = BOOKING.APPOINTMENT_DURATION_MINUTES * 60 * 1000;

  let slotStartMs = workStartMs;
  while (slotStartMs + durationMs <= workEndMs) {
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