import type { FunnelStepId, DiagnosticQuestionId } from "@/types/funnel";
import type {
  InternalEventName,
  MetaEventName,
} from "@/config/tracking-events";

export type { InternalEventName, MetaEventName };

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
  /** SHA256-hashed email(s) — normalized and hashed server-side */
  em?: string[];
  /** SHA256-hashed phone(s) — normalized and hashed server-side */
  ph?: string[];
  /** SHA256-hashed first name — normalized and hashed server-side */
  fn?: string;
  /** SHA256-hashed last name — normalized and hashed server-side */
  ln?: string;
  /** SHA256-hashed postal code — normalized and hashed server-side */
  zp?: string;
  /** SHA256-hashed external identifier — normalized and hashed server-side */
  external_id?: string;
  /** RAW — do NOT hash */
  client_ip_address?: string;
  /** RAW — do NOT hash */
  client_user_agent?: string;
  /** RAW — do NOT hash */
  fbc?: string;
  /** RAW — do NOT hash */
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
