import type { Lead } from "@/types/lead";
import { requireEmailEnv } from "@/lib/env";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export interface EmailAdapter {
  send(payload: EmailPayload): Promise<{ id: string }>;
  sendLeadNotification(lead: Lead): Promise<{ id: string }>;
  sendBookingConfirmation(params: {
    lead: Lead;
    appointmentTime: string;
  }): Promise<{ id: string }>;
}

let activeAdapter: EmailAdapter | null = null;

export function registerEmailAdapter(adapter: EmailAdapter): void {
  activeAdapter = adapter;
}

export function getEmailAdapter(): EmailAdapter {
  if (!activeAdapter) {
    throw new Error(
      "No email adapter registered. Call registerEmailAdapter first.",
    );
  }
  return activeAdapter;
}

/** Create an email adapter. Validates env on first call. */
export function createEmailAdapter(): EmailAdapter {
  const env = requireEmailEnv();

  throw new Error(
    `Email adapter not implemented. ` +
      `From address detected: ${env.fromAddress}. ` +
      `Implement the adapter in src/lib/email/index.ts.`,
  );
}
