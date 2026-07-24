import "server-only";

import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import { requireGoogleCalendarEnv } from "@/lib/env";
import type { CalendarProvider, CalendarEventResult, CreateEventInput } from "../types";
import { createEventSchema } from "../types";

export function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, "\n");
}

function createAuthClient(env: { serviceAccountEmail: string; serviceAccountPrivateKey: string }) {
  const key = normalizePrivateKey(env.serviceAccountPrivateKey);
  return new google.auth.JWT({
    email: env.serviceAccountEmail,
    key,
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });
}

function mapGcalStatus(status: string): string {
  switch (status) {
    case "confirmed":
      return "confirmed";
    case "tentative":
      return "pending";
    case "cancelled":
      return "cancelled";
    default:
      return status;
  }
}

interface GcalError {
  code?: number;
  message?: string;
  errors?: Array<{ message?: string; domain?: string; reason?: string }>;
}

function normalizeError(err: unknown): { code: number; message: string } {
  const gcalErr = err as GcalError;
  if (gcalErr?.code && gcalErr?.message) {
    return { code: gcalErr.code, message: gcalErr.message };
  }
  if (err instanceof Error) {
    return { code: 500, message: err.message };
  }
  return { code: 500, message: "Unknown Google Calendar error" };
}

function toCalendarEventResult(data: calendar_v3.Schema$Event): CalendarEventResult {
  return {
    external_event_id: data.id ?? "",
    html_link: data.htmlLink ?? undefined,
    status: mapGcalStatus(data.status ?? "confirmed"),
    created_at: data.created ?? undefined,
  };
}

export function createGoogleCalendarProvider(): CalendarProvider {
  const env = requireGoogleCalendarEnv();
  const auth = createAuthClient(env);
  const calendar = google.calendar({ version: "v3", auth });
  const calendarId = env.calendarId;

  return {
    async createEvent(input: CreateEventInput) {
      const parsed = createEventSchema.parse(input);

      try {
        const response = await calendar.events.insert({
          calendarId,
          requestBody: {
            summary: parsed.summary,
            description: parsed.description,
            start: {
              dateTime: parsed.start,
              timeZone: parsed.timezone,
            },
            end: {
              dateTime: parsed.end,
              timeZone: parsed.timezone,
            },
            extendedProperties: parsed.extendedProperties as
              | calendar_v3.Schema$Event["extendedProperties"]
              | undefined,
          },
        });

        const data = response.data;

        if (!data.id) {
          throw new Error("Google Calendar event created without an ID");
        }

        return toCalendarEventResult(data);
      } catch (err) {
        const normalized = normalizeError(err);
        throw normalized;
      }
    },

    async getEvent(externalEventId: string) {
      try {
        const response = await calendar.events.get({
          calendarId,
          eventId: externalEventId,
        });

        const data = response.data;

        if (!data.id) {
          return null;
        }

        return toCalendarEventResult(data);
      } catch (err) {
        const normalized = normalizeError(err);
        if (normalized.code === 404) {
          return null;
        }
        throw normalized;
      }
    },

    async deleteEvent(externalEventId: string) {
      try {
        await calendar.events.delete({
          calendarId,
          eventId: externalEventId,
        });
      } catch (err) {
        const normalized = normalizeError(err);
        if (normalized.code === 404) {
          return;
        }
        throw normalized;
      }
    },
  };
}
