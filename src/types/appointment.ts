export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed";

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
  created_at?: string;
}

export interface AppointmentRequest {
  lead_id: string;
  date: string;
  start_time: string;
  end_time: string;
}

export type BookingProvider = "google_calendar" | "calendly" | "cal_com";
