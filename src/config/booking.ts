// =============================================================================
// Booking Configuration
// =============================================================================
// All booking settings are defined here — never duplicate these values
// across components, API routes, or tests.

export const BOOKING = {
  APPOINTMENT_DURATION_MINUTES: 30,
  SLOT_INTERVAL_MINUTES: 30,
  TIMEZONE: "America/New_York",
  MINIMUM_NOTICE_HOURS: 2,
  BOOKING_WINDOW_DAYS: 30,
  PAGE_VERSION: "0.1.0",
  BUFFER_BEFORE_MINUTES: 0,
  BUFFER_AFTER_MINUTES: 0,
} as const;

export const WORKING_HOURS: { start: number; end: number } = {
  start: 9,
  end: 17,
};

export const WORKING_DAYS: number[] = [1, 2, 3, 4, 5];

export const BLOCKED_DATES: string[] = [
  // Add blocked dates as 'YYYY-MM-DD' strings
  // Example: "2026-12-25",
  // Example: "2027-01-01",
];