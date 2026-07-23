import type { Lead, LeadSubmission } from "@/types/lead";
import type { Appointment, AppointmentRequest } from "@/types/appointment";
import type { InternalEventPayload } from "@/types/tracking";
import { requireSupabaseServerEnv, publicEnv } from "@/lib/env";

export interface SupabaseClient {
  createLead(data: LeadSubmission): Promise<Lead>;
  getLead(id: string): Promise<Lead | null>;
  updateLead(id: string, data: Partial<Lead>): Promise<Lead>;

  createAppointment(data: AppointmentRequest): Promise<Appointment>;
  getAppointment(id: string): Promise<Appointment | null>;
  updateAppointment(
    id: string,
    data: Partial<Appointment>,
  ): Promise<Appointment>;

  trackFunnelEvent(event: InternalEventPayload): Promise<void>;
  getFunnelEvents(leadId: string): Promise<InternalEventPayload[]>;
}

/** Server-side Supabase client — validates env vars on first call. */
export function getServerClient(): SupabaseClient {
  const env = requireSupabaseServerEnv();
  throw new Error(
    `Supabase server client not implemented. ` +
      `URL and service role key detected (URL ends with: …${env.url.slice(-20)}). ` +
      `Implement the client in src/lib/supabase/index.ts.`,
  );
}

/** Browser-side Supabase client — uses anon key from public env. */
export function getBrowserClient(): SupabaseClient {
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. " +
        "Add it to .env.local (see .env.example).",
    );
  }
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. " +
        "Add it to .env.local (see .env.example).",
    );
  }
  throw new Error(
    "Supabase browser client not implemented. " +
      "Implement the client in src/lib/supabase/index.ts.",
  );
}
