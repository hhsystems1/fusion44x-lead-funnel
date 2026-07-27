import { z } from "zod";

export const createEventSchema = z.object({
  summary: z.string().min(1).max(256),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  timezone: z.string().min(1).max(64),
  description: z.string().optional(),
  extendedProperties: z
    .object({
      private: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;

export interface CalendarEventResult {
  external_event_id: string;
  html_link?: string;
  status: string;
  created_at?: string;
}

export interface CalendarProvider {
  createEvent(input: CreateEventInput): Promise<CalendarEventResult>;
  getEvent(externalEventId: string): Promise<CalendarEventResult | null>;
  deleteEvent(externalEventId: string): Promise<void>;
}
