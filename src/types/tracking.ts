import type { FunnelStepId, DiagnosticQuestionId } from "@/types/funnel";
import type { InternalEventName } from "@/config/tracking-events";

// =============================================================================
// Internal (Supabase) Events
// =============================================================================

export interface InternalEventPayload {
  event_name: InternalEventName;
  /** Shared UUID for deduplication between browser and server */
  event_id: string;
  session_id: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  step_id?: FunnelStepId;
  question_id?: DiagnosticQuestionId;
  lead_id?: string;
  duration_ms?: number;
  page_version?: string;
  utm?: UtmParams;
  metadata?: Record<string, unknown>;
}

export interface UtmParams {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

// =============================================================================
// Meta Conversions API Events
// =============================================================================

export type MetaEventName = "Contact" | "Schedule";

export interface MetaEventPayload {
  event_name: MetaEventName;
  /** Shared UUID — same as internal event_id for deduplication */
  event_id: string;
  event_time: number;
  event_source_url?: string;
  action_source: "website" | "server";
  user_data: MetaUserData;
  custom_data?: Record<string, unknown>;
}

export interface MetaUserData {
  /** SHA256-hashed email(s) — hashing NOT YET IMPLEMENTED */
  em?: string[];
  /** SHA256-hashed phone(s) — hashing NOT YET IMPLEMENTED */
  ph?: string[];
  /** SHA256-hashed first name — hashing NOT YET IMPLEMENTED */
  fn?: string;
  /** SHA256-hashed last name — hashing NOT YET IMPLEMENTED */
  ln?: string;
  /** SHA256-hashed postal code — hashing NOT YET IMPLEMENTED */
  zp?: string;
  /** SHA256-hashed external identifier — hashing NOT YET IMPLEMENTED */
  external_id?: string;
  /** RAW IP address — do NOT hash */
  client_ip_address?: string;
  /** RAW user agent — do NOT hash */
  client_user_agent?: string;
  /** RAW Facebook click ID — do NOT hash */
  fbc?: string;
  /** RAW Facebook browser ID — do NOT hash */
  fbp?: string;
}

// =============================================================================
// Customer Information (raw, pre-hash)
// =============================================================================

export interface CustomerInfo {
  email: string;
  phone: string;
  first_name?: string;
  last_name?: string;
  zip_code?: string;
  external_id?: string;
  client_ip_address?: string;
  client_user_agent?: string;
  fbc?: string;
  fbp?: string;
}

// =============================================================================
// Tracking Event (raw data from browser, before processing)
// =============================================================================

export interface TrackingEvent {
  event_name: string;
  event_id: string;
  event_time: number;
  user_data: {
    email?: string;
    phone?: string;
    client_user_agent?: string;
    client_ip_address?: string;
  };
  custom_data?: Record<string, unknown>;
}
