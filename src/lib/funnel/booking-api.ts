export interface BookingApiResponse {
  appointment_id?: string;
  start_time?: string;
  end_time?: string;
  timezone?: string;
  status?: string;
  error?: { status: number; message: string; code?: string };
}

export async function createBookingRequest(params: {
  lead_id: string;
  session_id: string;
  start_time: string;
  timezone: string;
  event_id: string;
}): Promise<BookingApiResponse> {
  try {
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    const data = await response.json() as BookingApiResponse;

    if (!response.ok) {
      return { error: data.error ?? { status: response.status, message: "Booking failed", code: "BOOKING_UNKNOWN" } };
    }

    return data;
  } catch {
    return { error: { status: 0, message: "Network error", code: "NETWORK_ERROR" } };
  }
}

export interface AvailabilitySlot {
  start: string;
  end: string;
  label: string;
}

export interface AvailabilityResponse {
  slots: AvailabilitySlot[];
  date: string;
  timezone: string;
  error?: { status: number; message: string };
}

export async function fetchAvailability(date: string, timezone: string): Promise<AvailabilityResponse> {
  try {
    const params = new URLSearchParams({ date, timezone });
    const response = await fetch(`/api/availability?${params}`);
    const data = await response.json() as AvailabilityResponse;

    if (!response.ok) {
      return { slots: [], date, timezone, error: data.error ?? { status: response.status, message: "Failed to load availability" } };
    }

    return data;
  } catch {
    return { slots: [], date, timezone, error: { status: 0, message: "Network error" } };
  }
}