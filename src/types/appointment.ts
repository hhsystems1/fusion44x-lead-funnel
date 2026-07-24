export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "rescheduled"
  | "no_show"
  | "failed";

export interface TimeSlot {
  date: string;
  start_time: string;
  end_time: string;
  available: boolean;
}

export interface Appointment {
  id?: string;
  lead_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  provider: string;
  booking_event_id?: string;
  created_at?: string;
}

export interface AppointmentRequest {
  lead_id: string;
  date: string;
  start_time: string;
  end_time: string;
}

export type BookingProvider = "google_calendar" | "calendly" | "cal_com";