# Fusion 44X — Database Schema

## Migration

| File | Timestamp |
|------|-----------|
| `supabase/migrations/20260724_001_initial_funnel_schema.sql` | 2026-07-24 |
| `supabase/migrations/20260731000100_exit_popup_and_lead_stages.sql` | 2026-07-31 |

> Migrations are **not** applied automatically. Each feature doc lists its own migration file; apply them in filename order against the target Supabase project.

## Access Architecture

Browsers never talk to Supabase directly. All requests go to Next.js server-side API routes, which:

1. Validate and sanitize every input.
2. Apply rate limits and security checks.
3. Perform database operations using the Supabase `service_role` key.

The `service_role` bypasses Row Level Security entirely. RLS is still enabled on every table as a defense-in-depth layer — it denies all direct access from anonymous or authenticated non-service-role users.

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

- `(status, last_seen_at)` — session cleanup / abandonment detection

> The `anonymous_id` UNIQUE constraint creates its own unique index implicitly — no redundant index is needed.

---

## 2. `leads`

Stores contact details, diagnostic answers (+ qualification summary), consent records, and CRM integration state.

**Status lifecycle:** `new` → `contacted` → `qualified` → `scheduled` → `completed` | `disqualified` | `archived`

> Note: `status` is the qualification lifecycle. `stage` (added by the exit-popup migration) is a separate manual sales-pipeline field managed from the admin dashboard — see below.

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
| `lead_origin` | How the lead was first captured: `funnel` (full diagnostic) or `exit_popup` (popup form). Defaults to `funnel`. |
| `stage` | Manual sales-pipeline stage: `contacted` / `no_show` / `follow_up` / `won` / `lost`. Null = not staged yet. |
| `source` | Auto-derived attribution: UTM source → referrer mapping → `direct` |
| `assigned_to` | Future: CRM owner |
| `crm_external_id` | Future: CRM record ID |

### Nullability of diagnostic columns

`phone`, `zip_code`, and the diagnostic columns (`water_feature`, `installation_type`, `pool_size`, `current_treatment`, `primary_goal`) are **nullable** so an exit-popup lead can be created before the full diagnostic is completed. When the visitor later completes the funnel, `create_lead_from_funnel_session` upgrades the existing lead in place rather than creating a duplicate.

### CHECK constraints

- `lead_origin IN ('funnel', 'exit_popup')`
- `stage IN ('contacted', 'no_show', 'follow_up', 'won', 'lost')` (nullable)

### Indexes

- `email` — dedup / lookup
- `phone` — dedup / lookup
- `(status, created_at)` — pipeline reporting

### Lead capture RPCs

| Function | Purpose |
|----------|---------|
| `create_lead_from_funnel_session(...)` | Creates a lead from the full diagnostic funnel. If the session is already linked to an `exit_popup` lead, it **upgrades that lead in place** with the diagnostic answers instead of raising `P0003`. Sessions linked to a funnel lead keep the `P0003` rejection. |
| `create_lead_from_popup(...)` | Creates a lead from the exit popup (name/email/phone only). Locks the session `FOR UPDATE`, enforces `consent_to_contact` (`P0004`), is **idempotent** for existing `exit_popup` leads (returns the existing id), raises `P0003` for sessions linked to a funnel lead. Inserts a `lead_created` funnel event with `section_id = 'exit-popup'`. |

Both functions are `SECURITY DEFINER`, run with `set search_path = ''`, and have `EXECUTE` revoked from `public` / `anon` / `authenticated` and granted **only** to `service_role`.

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

- Rows must never be **updated** or **deleted** by application code.
- All INSERT operations go through server-side API routes using the `service_role` key.
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

- **No direct browser database access.** Browsers send requests exclusively to Next.js server-side API routes, which validate and rate-limit every request before touching the database.
- **All trusted database operations use the `service_role` key**, which bypasses RLS entirely.
- **Anonymous and authenticated (non-service-role) users have zero direct table access** — no INSERT, SELECT, UPDATE, or DELETE on any of the six tables.
- **RLS is enabled on every table as a defense-in-depth layer.** Even if a misconfiguration were to expose the Supabase anon key, all direct operations would be denied.
- **Admin read policies may be added later** once an authenticated role model is established in the repository.
- The `service_role` retains full access for maintenance operations (e.g. purging stale `funnel_events`, bulk status updates).

| Table | RLS Enabled | Anon Access | Auth Access | Service Role |
|-------|-------------|-------------|-------------|--------------|
| `funnel_sessions` | ✅ | ❌ All denied | ❌ All denied | ✅ Full access |
| `leads` | ✅ | ❌ All denied | ❌ All denied | ✅ Full access |
| `lead_answers` | ✅ | ❌ All denied | ❌ All denied | ✅ Full access |
| `funnel_events` | ✅ | ❌ All denied | ❌ All denied | ✅ Full access |
| `appointments` | ✅ | ❌ All denied | ❌ All denied | ✅ Full access |
| `integration_deliveries` | ✅ | ❌ All denied | ❌ All denied | ✅ Full access |

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
