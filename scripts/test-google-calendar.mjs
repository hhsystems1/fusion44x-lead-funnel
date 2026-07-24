#!/usr/bin/env node

/**
 * Manual Google Calendar Integration Test
 * =========================================
 *
 * Creates and immediately deletes a test event to verify the Google Calendar
 * configuration is working.
 *
 * Usage:
 *   node scripts/test-google-calendar.mjs
 *
 * Requirements:
 *   - GOOGLE_CALENDAR_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL,
 *     GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY set in the environment or .env.local
 *
 * Safety:
 *   - The event is created with a clear "TEST" label
 *   - The event is deleted immediately after creation
 *   - Credentials are never printed
 *   - This script must NOT run automatically during tests or build
 */

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SERVICE_ACCOUNT_PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

if (!CALENDAR_ID || !SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY) {
  console.error("Error: Missing required Google Calendar environment variables.");
  console.error("Ensure GOOGLE_CALENDAR_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and");
  console.error("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY are set in your environment.");
  process.exit(1);
}

const { google } = await import("googleapis");

const key = SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n");

const auth = new google.auth.JWT({
  email: SERVICE_ACCOUNT_EMAIL,
  key,
  scopes: ["https://www.googleapis.com/auth/calendar.events"],
});

const calendar = google.calendar({ version: "v3", auth });

const now = new Date();
const startTime = new Date(now.getTime() + 60000); // 1 minute from now
const endTime = new Date(startTime.getTime() + 300000); // 5 minutes duration

const event = {
  summary: "[TEST] Fusion 44X Calendar Integration Test",
  description:
    "This is an automated test event created by scripts/test-google-calendar.mjs.\n" +
    "It will be deleted immediately after creation. Do not modify or respond to this event.",
  start: {
    dateTime: startTime.toISOString(),
    timeZone: "America/New_York",
  },
  end: {
    dateTime: endTime.toISOString(),
    timeZone: "America/New_York",
  },
};

console.log("Creating test event in calendar:", CALENDAR_ID);

let createdEvent;
try {
  const response = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: event,
  });
  createdEvent = response.data;
  console.log("Test event created successfully.");
  console.log("  Event ID:", createdEvent.id);
  console.log("  Summary:", createdEvent.summary);
  console.log("  Start:", createdEvent.start?.dateTime);
  console.log("  End:", createdEvent.end?.dateTime);
  console.log("  Link:", createdEvent.htmlLink);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("Failed to create test event:", message);
  process.exit(1);
}

if (createdEvent?.id) {
  console.log("\nDeleting test event...");
  try {
    await calendar.events.delete({
      calendarId: CALENDAR_ID,
      eventId: createdEvent.id,
    });
    console.log("Test event deleted successfully.");
    console.log("\n✓ Google Calendar integration is configured correctly.");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Warning: Failed to delete test event:", message);
    console.error("You may need to manually delete event:", createdEvent.id);
    process.exit(1);
  }
}
