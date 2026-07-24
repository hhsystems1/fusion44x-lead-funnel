# Fusion 44X — Database Schema

## Migration

| File | Timestamp |
|------|-----------|
| `supabase/migrations/20260724_001_initial_funnel_schema.sql` | 2026-07-24 |

## Tables

| # | Table | Purpose |
|---|-------|---------|
| 1 | `funnel_sessions` | One anonymous funnel visit before and after lead identification |
| 2 | `leads` | Contact details, qualification summary, source, and consent |
| 3 | `lead_answers` | Normalized diagnostic question IDs and answer codes |
| 4 | `funnel_events` | Append-only internal analytics timeline |
| 5 | `appointments` | Booking state and external calendar event info |
| 6 | `integration_deliveries` | Outbound delivery attempts to external services |

---

## 1. `funnel_sessions`

Tracks a single anonymous funnel visit from landing through lead identification and booking.

**Status lifecycle:** `active` → `lead_created` → `booking_started` → `booked` | `abandoned`

### Key columns

| Column | Notes |
|--------|-------|
| `anonymous_id` | Client-generated ID (e.g. `crypto.randomUUID()`), unique per session, stable across page reloads |
| `lead_id` | Set after lead creation — second step in the circular FK linking order |
| `utm_*` / `fbclid` / `fbc` / `fbp` | Attribution parameters captured on landing |
| `page_version` | App version at time of session for debugging |

### Indexes

- `anonymous_id` — fast session lookup
- `(status, last_seen_at)` — session cleanup / abandonment detection

---

## 2. `leads`

Stores contact details, diagnostic answers (+ qualification summary), consent records, and CRM integration state.

**Status lifecycle:** `new` → `contacted` → `qualified` → `scheduled` → `completed` | `disqualified` | `archived`

### Key columns

| Column | Notes |
|--------|-------|
| `session_id` | References the original session — set first in the FK linking order |
| `first_name` / `last_name` | Split names (not a single `full_name` column) |
| `email` / `phone` | Contact methods (phone normalized during validation) |
| `water_feature` through `primary_goal` | Copied from diagnostic for query convenience; raw pairs also in `lead_answers` |
| `consent_to_contact` | Required explicit opt-in for follow-up |
| `marketing_consent` | Separate optional opt-in for promotional communications |
| `consent_text_version` | Which version of the consent text was shown |
| `assigned_to` | Future: CRM owner |
| `crm_external_id` | Future: CRM record ID |

### Indexes

- `email` — dedup / lookup
- `phone` — dedup / lookup
- `(status, created_at)` — pipeline reporting

---

## 3. `lead_answers`

Normalized diagnostic answers stored as stable `question_id` / `answer_code` pairs. This table exists separately from `leads` so that:

- Answer codes remain stable regardless of lead column schema changes.
- Multi-select questions (like `current-issues`) are naturally supported as multiple rows.
- New questions can be added without ALTER TABLE migrations on `leads`.

### Unique constraint

`UNIQUE (lead_id, question_id, answer_code)` — prevents duplicate answer rows for the same question and code.

### Index

- `lead_id` — fast lookup for all answers belonging to a lead.

---

## Relationship Flow

```
funnel_sessions (1) ──→ leads (0..1) ──→ lead_answers (0..N)
       │                                      │
       │                                      │ (no direct link)
       │                                      │
       └── funnel_events (0..N)               │
       │                                      │
       └── appointments (0..N)                │
                                              │
       integration_deliveries (0..N) ──────────┘
```

### Circular FK linking order

`funnel_sessions` and `leads` have a circular foreign key relationship. Both FKs are nullable to avoid insert-order deadlock. The intended order is:

1. **INSERT `funnel_session`** — no `lead_id` yet.
2. **INSERT `lead`** — sets `session_id` to the session created in step 1.
3. **UPDATE `funnel_session`** — sets `lead_id` to the lead created in step 2.

---

## 4. `funnel_events`

Append-only analytics timeline. Every user action in the funnel produces one or more rows.

### Append-only behavior

- Rows must never be **updated** or **deleted** by application code (anonymous or authenticated).
- INSERT is permitted for anonymous users (via RLS).
- The `service_role` may perform maintenance operations (e.g. purging old records if required by data policy).
- No `updated_at` trigger — the table is intentionally immutable.

### CHECK constraints

- `event_name` must be one of the 27 canonical names from `src/config/tracking-events.ts`.
- `duration_ms` must be NULL or ≥ 0.

### Indexes

- `(session_id, occurred_at)` — per-session timeline queries.
- `(lead_id, occurred_at)` — per-lead timeline queries.
- `(event_name, occurred_at)` — aggregate event analysis.

### Deletion behavior

- If the parent session is deleted, all its events are cascade-deleted.
- If the parent lead is deleted, `lead_id` is set to NULL (preserving the event row).

---

## 5. `appointments`

Booking appointments with external calendar provider integration (initially Google Calendar).

**Status lifecycle:** `pending` → `confirmed` → `completed` | `cancelled` | `rescheduled` | `no_show` | `failed`

### Key columns

| Column | Notes |
|--------|-------|
| `external_event_id` | Provider-specific event ID (unique, nullable) |
| `timezone` | IANA timezone string (e.g. `America/New_York`) |
| `rescheduled_from_id` | Self-referential FK to the original appointment on reschedule |
| `confirmation_email_sent_at` / `reminder_email_sent_at` | Email delivery tracking |

### CHECK constraints

- `end_time > start_time`
- Status restricted to the defined lifecycle.

### Indexes

- `lead_id` — per-lead appointment lookup.
- `(status, start_time)` — upcoming appointment queries.

### Deletion behavior

- Deleting a lead cascade-deletes its appointments.
- Deleting the session sets `session_id` to NULL (preserving the appointment).
- Deleting the original appointment (via `rescheduled_from_id`) sets the reference to NULL.

---

## 6. `integration_deliveries`

Tracks outbound delivery attempts to external services with retry support.

### Destinations

- `meta` — Meta Conversions API
- `email` — Email notification provider (Resend / SendGrid)
- `crm` — Customer relationship management system
- `google_sheets` — Google Sheets logging
- `google_calendar` — Google Calendar booking sync

**Delivery status lifecycle:** `pending` → `processing` → `delivered` | `failed` → `retrying` → `dead_letter`

### Key columns

| Column | Notes |
|--------|-------|
| `payload_hash` | SHA256 of outbound payload for idempotency |
| `attempt_count` | Incremented on each attempt; reset to 0 on `dead_letter` transition |
| `response_code` | HTTP status code from the external service |
| `error_message` | Human-readable error for debugging |

### CHECK constraints

- `attempt_count >= 0`
- At least one of `lead_id` or `appointment_id` must be present.
- Destination must be one of the five defined values.
- Status must be one of the six defined values.

### Retry model

1. Initial state: `pending`, `attempt_count = 0`.
2. On first attempt: `processing`, `last_attempt_at = now()`.
3. On success: `delivered`, `delivered_at = now()`.
4. On transient failure: `retrying`, increment `attempt_count`.
5. After max retries: `dead_letter` for manual review.

### Deletion behavior

- Deleting a lead cascade-deletes its deliveries.
- Deleting an appointment cascade-deletes its deliveries.

### Indexes

- `(status, created_at)` — retry queue queries.
- `(destination, status)` — per-destination delivery monitoring.

---

## RLS Security Model

| Table | Anonymous INSERT | Anonymous SELECT | Anonymous UPDATE | Anonymous DELETE | Notes |
|-------|-----------------|-----------------|-----------------|-----------------|-------|
| `funnel_sessions` | ✅ | ✅ | ❌ | ❌ | Session creation and read-back allowed |
| `leads` | ❌ | ❌ | ❌ | ❌ | Server-only via `service_role` |
| `lead_answers` | ❌ | ❌ | ❌ | ❌ | Server-only via `service_role` |
| `funnel_events` | ✅ | ❌ | ❌ | ❌ | Append-only (INSERT only) |
| `appointments` | ❌ | ❌ | ❌ | ❌ | Server-only via `service_role` |
| `integration_deliveries` | ❌ | ❌ | ❌ | ❌ | Server-only via `service_role` |

- **The `service_role` bypasses RLS entirely** and is used by server-side API routes.
- **No permissive anonymous policies** exist to simplify development.
- **No authenticated admin policies** exist yet — they should be added once a role model is established.
- **Browser writes flow through server-side API routes**, never directly to the database from client-side code.

### Deletion behaviors

| Table | ON DELETE CASCADE | ON DELETE SET NULL | Notes |
|-------|-------------------|-------------------|-------|
| `leads` → `lead_answers` | ✅ | — | Answers are meaningless without the lead |
| `leads` → `appointments` | ✅ | — | Appointments are meaningless without the lead |
| `leads` → `integration_deliveries` | ✅ | — | Deliveries are meaningless without the lead |
| `appointments` → `integration_deliveries` | ✅ | — | Appointment-specific deliveries follow the appointment |
| `funnel_sessions` → `funnel_events` | ✅ | — | Events are meaningless without the session |
| `funnel_sessions` → `leads` | ❌ | ❌ | `session_id` on leads is nullable; lead survives session deletion |
| `funnel_sessions` → `appointments` | ❌ | `set null` | Appointment survives session deletion |
| `leads` → `funnel_events` | ❌ | `set null` | Events survive lead deletion (anonymized) |
| `appointments` → `appointments` (`rescheduled_from_id`) | ❌ | `set null` | Reschedule chain survives original deletion |
| `appointments` → `integration_deliveries` | ✅ | — | Appointment-specific deliveries follow the appointment |

## Data that must never be sent to Meta

The following data must **never** appear in Meta browser pixel events or Meta Conversions API calls:

- **Diagnostic question IDs** (e.g. `water-feature`, `current-treatment`)
- **Diagnostic answer codes** (e.g. `pool`, `chlorine`, `algae`)
- **Raw diagnostic metadata** — any answer-specific context from `funnel_events.metadata`

Only two conversion event types are sent to Meta:

1. `Contact` — when a lead is created.
2. `Schedule` — when an appointment is booked.

All internal analytics (including question answers, step transitions, validation errors) live exclusively in `funnel_events` and `lead_answers` within Supabase.
