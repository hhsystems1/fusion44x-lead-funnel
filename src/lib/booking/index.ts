import type {
  TimeSlot,
  AppointmentRequest,
  Appointment,
  BookingProvider,
} from "@/types/appointment";
import { requireGoogleCalendarEnv, getBookingTimezone } from "@/lib/env";

export interface BookingAdapter {
  getProviderName(): BookingProvider;
  getAvailableSlots(date: string): Promise<TimeSlot[]>;
  createAppointment(request: AppointmentRequest): Promise<Appointment>;
  cancelAppointment(appointmentId: string): Promise<void>;
}

let activeAdapter: BookingAdapter | null = null;

export function registerBookingAdapter(adapter: BookingAdapter): void {
  activeAdapter = adapter;
}

export function getBookingAdapter(): BookingAdapter {
  if (!activeAdapter) {
    throw new Error(
      "No booking adapter registered. Call registerBookingAdapter first.",
    );
  }
  return activeAdapter;
}

/** Create a Google Calendar booking adapter. Validates env on first call. */
export function createGoogleCalendarAdapter(): BookingAdapter {
  requireGoogleCalendarEnv();
  const timezone = getBookingTimezone();

  throw new Error(
    `Google Calendar adapter not implemented. ` +
      `Calendar ID detected, timezone: ${timezone}. ` +
      `Implement the adapter in src/lib/booking/index.ts.`,
  );
}
