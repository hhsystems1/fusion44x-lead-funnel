-- =============================================================================
-- Add booking_event_id to appointments
-- =============================================================================
-- Stores the booking event UUID for deduplication and idempotency checks.
-- A unique partial index ensures that booking_event_id values are unique
-- when non-null, preventing duplicate event_id submissions from creating
-- multiple appointments.
-- =============================================================================

alter table public.appointments
  add column booking_event_id uuid null;

-- Partial unique index: only enforces uniqueness when booking_event_id IS NOT NULL
create unique index idx_appointments_booking_event_id
  on public.appointments (booking_event_id)
  where booking_event_id is not null;

comment on column public.appointments.booking_event_id is
  'Client-generated event UUID for deduplication. Set at booking creation time and used to make repeated requests with the same event_id idempotent.';