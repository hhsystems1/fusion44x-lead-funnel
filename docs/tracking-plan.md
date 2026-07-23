# Fusion 44X — Tracking Plan

## Event Architecture

| System | Purpose | Storage |
|--------|---------|---------|
| Internal events | Detailed funnel analytics | Supabase `funnel_events` table |
| Meta browser pixel | Conversion attribution | Meta (browser → pixel) |
| Meta Conversions API | Server-side conversion dedup | Meta (server → CAPI) |

## Internal Event Names

All 27 internal event names are defined in `src/config/tracking-events.ts` (`InternalEvents`).
No hardcoded event name strings anywhere else.

### Funnel lifecycle
- `page_viewed`
- `hero_cta_clicked`
- `hero_video_opened`, `hero_video_started`, `hero_video_completed`
- `testimonials_viewed`, `testimonial_started`, `testimonial_completed`

### Diagnostic
- `diagnostic_started`
- `question_viewed`, `question_answered`, `question_changed`
- `validation_error`
- `diagnostic_completed`

### Contact
- `contact_step_viewed`, `contact_submitted`
- `lead_created`

### Booking
- `calendar_viewed`, `time_slot_selected`
- `booking_started`, `booking_completed`, `booking_failed`
- `add_to_calendar_clicked`

### Confirmation
- `confirmation_viewed`

### Session
- `session_inactive`, `page_hidden`, `page_exit_attempted`

## Internal Event Payload

```typescript
{
  event_name: InternalEventName;  // typed union of all 27 names
  event_id: string;               // UUID v4 — shared with Meta for dedup
  session_id: string;
  timestamp: string;             // ISO 8601
  step_id?: FunnelStepId;        // which funnel step
  question_id?: DiagnosticQuestionId; // which diagnostic question
  lead_id?: string;
  duration_ms?: number;
  page_version?: string;
  utm?: { source, medium, campaign, term, content };
  metadata?: Record<string, unknown>;
}
```

## Meta Event Names

Only 2 conversion events are sent to Meta (defined in `src/config/tracking-events.ts`):

- `Contact` — fired when a lead submits contact information
- `Schedule` — fired when a booking is confirmed

## Meta Shared Event ID

For every conversion:
1. A UUID v4 `event_id` is generated at the moment of the user action.
2. The browser Meta pixel fires with this `event_id`.
3. The server CAPI sends the same `event_id`.
4. Meta deduplicates the two events.

No other mechanism is needed — the shared `event_id` is sufficient.

## Meta Hashing Reference

Meta Conversions API requires SHA256 hashing for certain user data fields.
Hashing is NOT YET IMPLEMENTED in the codebase. This table documents what must happen.

### Fields that require SHA256 hashing

| Customer field | Meta API key | Hash required | Implemented |
|----------------|-------------|---------------|-------------|
| email          | `em`        | Yes           | No          |
| phone          | `ph`        | Yes           | No          |
| first_name     | `fn`        | Yes           | No          |
| last_name      | `ln`        | Yes           | No          |
| zip_code       | `zp`        | Yes           | No          |
| external_id    | `external_id` | Yes         | No          |

### Fields that must NOT be hashed

| Customer field | Meta API key | Hash allowed | Implemented |
|----------------|-------------|--------------|-------------|
| client_ip_address | `client_ip_address` | No — send raw | N/A |
| client_user_agent | `client_user_agent` | No — send raw | N/A |
| fbc (Facebook click ID) | `fbc` | No — send raw | N/A |
| fbp (Facebook browser ID) | `fbp` | No — send raw | N/A |

### Hashing implementation notes (for future)

```typescript
// SHA256 hashing will be implemented in src/lib/meta/hash.ts
import { createHash } from "node:crypto";

function hashValue(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}
```

- Normalize before hashing: lowercase, trim whitespace.
- Phone: remove all non-digit characters before hashing.
- Email: lowercase before hashing.
- Name: lowercase, trim before hashing.

## PII Rules

- Browser analytics (`InternalEventPayload`) must never contain email, phone, or full name.
- PII belongs only in:
  - Meta browser pixel (via `fbq('track')`)
  - Meta CAPI (via server-side API route)
  - Lead creation API call (`POST /api/leads`)
- Question answers must never be sent to Meta in any form.

## Session ID

A session ID is generated once per funnel visit (stored in-memory or sessionStorage).
It is included in every internal event for reconstructing user journeys.

## Question Answers

Detailed question answers are stored only in Supabase.
They are not included in Meta events or browser analytics payloads.
