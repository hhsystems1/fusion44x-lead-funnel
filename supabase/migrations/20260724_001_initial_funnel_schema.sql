-- =============================================================================
-- Fusion 44X Lead Funnel — Initial Schema
-- =============================================================================
-- Migration: 20260724_001_initial_funnel_schema
-- Description: Creates core tables for the lead funnel: sessions, leads,
--   diagnostic answers, internal analytics events, appointments, and
--   integration delivery tracking.
--
-- All browser writes flow through server-side API routes using the
-- service_role key. Direct anonymous table access is restricted.
-- =============================================================================

-- =============================================================================
-- Extensions
-- =============================================================================
create extension if not exists "pgcrypto";

-- =============================================================================
-- Reusable updated_at trigger function
-- =============================================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- 1. funnel_sessions
-- =============================================================================
-- Tracks one anonymous funnel visit before and after lead identification.
-- A session is created when a visitor lands on the funnel page and persists
-- through lead creation, booking, and beyond.
--
-- Linking order for circular FKs:
--   1. Insert funnel_session (no lead_id yet)
--   2. Insert lead (with session_id)
--   3. Update funnel_session.lead_id
-- =============================================================================

create table public.funnel_sessions (
  id            uuid        primary key default gen_random_uuid(),
  anonymous_id  text        unique not null,
  lead_id       uuid        null,
  status        text        not null default 'active',
  page_version  text        not null,
  referrer      text        null,
  landing_url   text        null,
  utm_source    text        null,
  utm_medium    text        null,
  utm_campaign   text       null,
  utm_content   text        null,
  utm_term      text        null,
  fbclid        text        null,
  fbc           text        null,
  fbp           text        null,
  device_category text      null,
  started_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  completed_at  timestamptz null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint funnel_sessions_status_check
    check (status in ('active', 'lead_created', 'booking_started', 'booked', 'abandoned'))
);

comment on table public.funnel_sessions is
  'Tracks one anonymous funnel visit from landing through lead identification and booking.';
comment on column public.funnel_sessions.anonymous_id is
  'Client-generated identifier (e.g. crypto.randomUUID) — stable across page reloads within one visit.';
comment on column public.funnel_sessions.lead_id is
  'Set after the lead record is created. Populated second in the circular FK linking order.';
comment on column public.funnel_sessions.status is
  'active → lead_created → booking_started → booked | abandoned. Reflects the highest-progress state.';

-- =============================================================================
-- 2. leads
-- =============================================================================
-- Stores contact details, qualification summary, source attribution, and
-- consent records. Created after the visitor submits contact information.
--
-- Linking order for circular FKs:
--   1. Insert funnel_session (no lead_id yet)
--   2. Insert lead (with session_id) ← this step
--   3. Update funnel_session.lead_id
-- =============================================================================

create table public.leads (
  id                     uuid        primary key default gen_random_uuid(),
  session_id             uuid        unique null,
  first_name             text        not null,
  last_name              text        not null,
  email                  text        not null,
  phone                  text        not null,
  zip_code               text        not null,
  preferred_contact_method text      null,
  water_feature          text        not null,
  installation_type      text        not null,
  pool_size              text        not null,
  current_treatment      text        not null,
  primary_goal           text        not null,
  qualification_summary  text        null,
  status                 text        not null default 'new',
  consent_to_contact     boolean     not null,
  consent_to_contact_at  timestamptz null,
  marketing_consent      boolean     not null default false,
  marketing_consent_at   timestamptz null,
  consent_text_version   text        not null,
  source                 text        null,
  assigned_to            text        null,
  crm_external_id        text        null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint leads_status_check
    check (status in ('new', 'contacted', 'qualified', 'scheduled', 'completed', 'disqualified', 'archived'))
);

comment on table public.leads is
  'Contact details and qualification data collected from the funnel diagnostic.';
comment on column public.leads.session_id is
  'References the originating session. Set first in the circular FK linking order.';
comment on column public.leads.consent_to_contact is
  'Required — explicit opt-in for phone/email follow-up.';
comment on column public.leads.marketing_consent is
  'Optional opt-in for promotional communications.';

-- =============================================================================
-- Circular FK pair: funnel_sessions ↔ leads
-- =============================================================================

alter table public.funnel_sessions
  add constraint funnel_sessions_lead_id_fkey
    foreign key (lead_id) references public.leads(id);

alter table public.leads
  add constraint leads_session_id_fkey
    foreign key (session_id) references public.funnel_sessions(id);

-- =============================================================================
-- 3. lead_answers
-- =============================================================================
-- Stores question/answer pairs from the pool diagnostic in a normalized,
-- append-only way. Keeps answer codes stable and independent from lead
-- column schema changes.
--
-- Supports multi-select questions (e.g. current-issues) via multiple rows
-- per lead_id sharing the same question_id with different answer_code values.
-- =============================================================================

create table public.lead_answers (
  id            uuid        primary key default gen_random_uuid(),
  lead_id       uuid        not null references public.leads(id) on delete cascade,
  question_id   text        not null,
  answer_code   text        not null,
  answer_order  integer     null,
  created_at    timestamptz not null default now(),

  constraint lead_answers_unique_answer
    unique (lead_id, question_id, answer_code)
);

comment on table public.lead_answers is
  'Normalized diagnostic answers stored as stable question_id / answer_code pairs.';
comment on column public.lead_answers.answer_code is
  'Stable code from funnel-questions.ts — never changes after launch.';
comment on column public.lead_answers.answer_order is
  'Optional display order for multi-select answers.';

-- =============================================================================
-- 4. funnel_events
-- =============================================================================
-- Append-only internal analytics timeline.
--
-- Once written, rows must never be updated or deleted by application code
-- (anonymous or authenticated). The service_role may perform maintenance
-- operations (e.g. purging old records if required by data policy).
--
-- Question answers must never be forwarded to Meta. event_name values are
-- restricted to the canonical set defined in src/config/tracking-events.ts.
-- =============================================================================

create table public.funnel_events (
  id           uuid        primary key default gen_random_uuid(),
  session_id   uuid        not null references public.funnel_sessions(id) on delete cascade,
  lead_id      uuid        null references public.leads(id) on delete set null,
  event_name   text        not null,
  section_id   text        null,
  step_id      text        null,
  question_id  text        null,
  answer_code  text        null,
  duration_ms  integer     null,
  page_version text        not null,
  event_id     uuid        null,
  metadata     jsonb       not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),

  constraint funnel_events_event_name_check
    check (event_name in (
      'page_viewed',
      'hero_cta_clicked',
      'hero_video_opened',
      'hero_video_started',
      'hero_video_completed',
      'testimonials_viewed',
      'testimonial_started',
      'testimonial_completed',
      'diagnostic_started',
      'question_viewed',
      'question_answered',
      'question_changed',
      'validation_error',
      'diagnostic_completed',
      'contact_step_viewed',
      'contact_submitted',
      'lead_created',
      'calendar_viewed',
      'time_slot_selected',
      'booking_started',
      'booking_completed',
      'booking_failed',
      'add_to_calendar_clicked',
      'confirmation_viewed',
      'session_inactive',
      'page_hidden',
      'page_exit_attempted'
    )),
  constraint funnel_events_duration_ms_check
    check (duration_ms is null or duration_ms >= 0)
);

comment on table public.funnel_events is
  'Append-only analytics event log. Rows must never be updated or deleted by application code.';
comment on column public.funnel_events.event_name is
  'Canonical internal event name from src/config/tracking-events.ts.';
comment on column public.funnel_events.metadata is
  'Arbitrary JSON payload. Must never contain PII (email, phone, name) or diagnostic answer details sent to Meta.';
comment on column public.funnel_events.event_id is
  'Shared UUID between browser and server events for deduplication purposes.';

-- =============================================================================
-- 5. appointments
-- =============================================================================
-- Stores booking state and external calendar event information.
-- Supports rescheduling by linking to the previous appointment record.
-- =============================================================================

create table public.appointments (
  id                        uuid        primary key default gen_random_uuid(),
  lead_id                   uuid        not null references public.leads(id) on delete cascade,
  session_id                uuid        null references public.funnel_sessions(id) on delete set null,
  status                    text        not null default 'pending',
  provider                  text        not null default 'google_calendar',
  external_event_id         text        null unique,
  start_time                timestamptz not null,
  end_time                  timestamptz not null,
  timezone                  text        not null,
  confirmation_email_sent_at timestamptz null,
  reminder_email_sent_at    timestamptz null,
  cancelled_at              timestamptz null,
  rescheduled_from_id       uuid        null references public.appointments(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint appointments_status_check
    check (status in ('pending', 'confirmed', 'cancelled', 'rescheduled', 'completed', 'no_show', 'failed')),
  constraint appointments_end_after_start_check
    check (end_time > start_time)
);

comment on table public.appointments is
  'Booking appointments with external calendar provider integration.';
comment on column public.appointments.external_event_id is
  'Provider-specific event identifier (e.g. Google Calendar event ID).';
comment on column public.appointments.rescheduled_from_id is
  'Self-referential FK to the original appointment when a booking is rescheduled.';

-- =============================================================================
-- 6. integration_deliveries
-- =============================================================================
-- Tracks outbound delivery attempts to external services (Meta, email, CRM,
-- Google Sheets, Google Calendar). Supports retry with exponential backoff.
-- =============================================================================

create table public.integration_deliveries (
  id             uuid        primary key default gen_random_uuid(),
  lead_id        uuid        null references public.leads(id) on delete cascade,
  appointment_id uuid        null references public.appointments(id) on delete cascade,
  destination    text        not null,
  event_type     text        not null,
  event_id       uuid        null,
  status         text        not null default 'pending',
  attempt_count  integer     not null default 0,
  last_attempt_at timestamptz null,
  delivered_at   timestamptz null,
  response_code  integer     null,
  error_message  text        null,
  payload_hash   text        null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint integration_deliveries_destination_check
    check (destination in ('meta', 'email', 'crm', 'google_sheets', 'google_calendar')),
  constraint integration_deliveries_status_check
    check (status in ('pending', 'processing', 'delivered', 'failed', 'retrying', 'dead_letter')),
  constraint integration_deliveries_attempt_count_check
    check (attempt_count >= 0),
  constraint integration_deliveries_has_reference_check
    check (lead_id is not null or appointment_id is not null)
);

comment on table public.integration_deliveries is
  'Outbound delivery tracking with retry state machine.';
comment on column public.integration_deliveries.payload_hash is
  'SHA256 hash of the outbound payload for idempotency checks.';
comment on column public.integration_deliveries.attempt_count is
  'Number of delivery attempts made. Reset on status change to dead_letter.';

-- =============================================================================
-- Indexes
-- =============================================================================

-- funnel_sessions
create index idx_funnel_sessions_anonymous_id
  on public.funnel_sessions (anonymous_id);
create index idx_funnel_sessions_status_last_seen
  on public.funnel_sessions (status, last_seen_at);

-- leads
create index idx_leads_email
  on public.leads (email);
create index idx_leads_phone
  on public.leads (phone);
create index idx_leads_status_created
  on public.leads (status, created_at);

-- lead_answers
create index idx_lead_answers_lead_id
  on public.lead_answers (lead_id);

-- funnel_events
create index idx_funnel_events_session_occurred
  on public.funnel_events (session_id, occurred_at);
create index idx_funnel_events_lead_occurred
  on public.funnel_events (lead_id, occurred_at);
create index idx_funnel_events_name_occurred
  on public.funnel_events (event_name, occurred_at);

-- appointments
create index idx_appointments_lead_id
  on public.appointments (lead_id);
create index idx_appointments_status_start
  on public.appointments (status, start_time);

-- integration_deliveries
create index idx_integration_deliveries_status_created
  on public.integration_deliveries (status, created_at);
create index idx_integration_deliveries_destination_status
  on public.integration_deliveries (destination, status);

-- =============================================================================
-- updated_at triggers
-- =============================================================================
-- Applied only to mutable tables (funnel_events is append-only and excluded).

create trigger set_funnel_sessions_updated_at
  before update on public.funnel_sessions
  for each row
  execute function set_updated_at();

create trigger set_leads_updated_at
  before update on public.leads
  for each row
  execute function set_updated_at();

create trigger set_appointments_updated_at
  before update on public.appointments
  for each row
  execute function set_updated_at();

create trigger set_integration_deliveries_updated_at
  before update on public.integration_deliveries
  for each row
  execute function set_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================
--
-- Security model:
--   - All browser writes flow through server-side API routes using the
--     service_role key, which bypasses RLS entirely.
--   - Direct anonymous access to leads, appointments, and
--     integration_deliveries is completely blocked.
--   - funnel_events allows anonymous INSERT only (append-only).
--     UPDATE and DELETE are blocked for both anonymous and authenticated
--     non-service-role users.
--   - funnel_sessions allows anonymous INSERT and SELECT (reading own
--     session is required for session continuity). UPDATE/DELETE blocked.
--   - Authenticated admin policies can be added later when a role model
--     is established in the repository.
--   - No permissive anonymous policies exist to simplify development.
--   - The service_role retains full access for maintenance operations
--     (e.g. purging stale funnel_events, bulk status updates).

-- funnel_sessions
alter table public.funnel_sessions enable row level security;

create policy "anon can insert funnel_sessions"
  on public.funnel_sessions
  for insert
  to anon
  with check (true);

create policy "anon can select funnel_sessions"
  on public.funnel_sessions
  for select
  to anon
  using (true);

-- leads
alter table public.leads enable row level security;

-- No anon policies — server-only via service_role.

-- lead_answers
alter table public.lead_answers enable row level security;

-- No anon policies — server-only via service_role.

-- funnel_events
alter table public.funnel_events enable row level security;

create policy "anon can insert funnel_events"
  on public.funnel_events
  for insert
  to anon
  with check (true);

-- No update or delete policies — funnel_events is append-only.

-- appointments
alter table public.appointments enable row level security;

-- No anon policies — server-only via service_role.

-- integration_deliveries
alter table public.integration_deliveries enable row level security;

-- No anon policies — server-only via service_role.
