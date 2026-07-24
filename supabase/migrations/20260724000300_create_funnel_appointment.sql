-- =============================================================================
-- Add booking_event_id column (must exist before the function references it)
-- =============================================================================

alter table public.appointments
  add column if not exists booking_event_id uuid;

create unique index if not exists idx_appointments_booking_event_id
  on public.appointments (booking_event_id)
  where booking_event_id is not null;

comment on column public.appointments.booking_event_id is
  'Client-generated event UUID for deduplication. Set at booking creation time and used to make repeated requests with the same event_id idempotent.';

-- =============================================================================
-- create_funnel_appointment
-- =============================================================================
-- Description: Atomically creates an appointment, updating related records:
--   1. Acquires a calendar-level transaction-scoped advisory lock to serialize
--      all booking attempts regardless of start time.
--   2. Validates configuration parameters (timezone, provider, duration).
--   3. Checks for duplicate booking event_id with full-field verification
--      for idempotency. Same event_id + identical booking data returns the
--      existing appointment ID. Same event_id + mismatched data is rejected.
--   4. Validates the lead exists
--   5. Validates the session exists and belongs to the lead
--   6. Rejects if the session or lead is already booked
--   7. Rejects ANY overlapping active appointment (global — not per-lead)
--   8. Creates the appointment with pending status
--   9. Updates lead status to 'scheduled'
--  10. Updates funnel session status to 'booked'
--  11. Inserts booking_completed funnel event
--  12. Returns the appointment ID
--
-- Concurrency:
--   A single calendar-level advisory lock serializes all booking attempts.
--   This is acceptable for the funnel's booking volume and prevents
--   overlapping buffered windows with different start times.
--
-- Active statuses that block a time slot:
--   - pending
--   - confirmed
--
-- Non-blocking statuses (do not affect availability):
--   - cancelled, rescheduled, completed, no_show, failed
--
-- Buffer zones:
--   start_time and end_time represent the consultation itself.
--   The overlap window is expanded by p_buffer_before and p_buffer_after
--   so no two appointments overlap including buffers.
--
-- Idempotency:
--   When the same p_event_id already exists, the function loads every
--   booking identity field (lead_id, session_id, start_time, end_time,
--   timezone, provider). Only if all match the supplied parameters is the
--   existing appointment ID returned. Any mismatch raises P0020 to prevent
--   information leakage or accidental reuse.
--
-- Security:
--   - SECURITY DEFINER ensures execution with owner privileges
--   - search_path is locked to '' (secure)
--   - EXECUTE revoked from public/anon/authenticated
--   - EXECUTE granted only to service_role
--   - Uses parameterized PL/pgSQL (no dynamic SQL)
-- =============================================================================

create or replace function public.create_funnel_appointment(
  p_lead_id        uuid,
  p_session_id     uuid,
  p_start_time     timestamptz,
  p_end_time       timestamptz,
  p_timezone       text,
  p_provider       text,
  p_event_id       uuid,
  p_buffer_before  interval default interval '0 minutes',
  p_buffer_after   interval default interval '0 minutes'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead_status       text;
  v_lead_session_id   uuid;
  v_session_status    text;
  v_session_lead_id   uuid;
  v_page_version      text;
  v_appointment_id    uuid;
  v_overlap_count     integer;
  v_locked            boolean;
  v_existing_id       uuid;
  v_existing_lead_id       uuid;
  v_existing_session_id    uuid;
  v_existing_start_time    timestamptz;
  v_existing_end_time      timestamptz;
  v_existing_timezone      text;
  v_existing_provider      text;
begin
  -- ===========================================================================
  -- Calendar-level advisory lock: serialize all booking attempts
  -- ===========================================================================
  -- Uses a deterministic 64-bit key for the entire booking calendar.
  -- This prevents overlapping buffered windows with different start times
  -- from being booked concurrently. Acquired BEFORE the global overlap query.
  select pg_try_advisory_xact_lock(20260724) into v_locked;

  if not v_locked then
    raise exception 'Concurrent booking conflict' using errcode = 'P0011';
  end if;

  -- ===========================================================================
  -- Input validation
  -- ===========================================================================

  if p_start_time >= p_end_time then
    raise exception 'end_time must be after start_time' using errcode = 'P0012';
  end if;

  if p_start_time <= now() then
    raise exception 'start_time must be in the future' using errcode = 'P0013';
  end if;

  if p_event_id is null then
    raise exception 'event_id is required' using errcode = 'P0014';
  end if;

  if p_timezone is null or p_timezone = '' then
    raise exception 'timezone is required' using errcode = 'P0015';
  end if;

  if p_timezone <> 'America/New_York' then
    raise exception 'timezone must be America/New_York' using errcode = 'P0017';
  end if;

  if p_provider is null or p_provider = '' then
    raise exception 'provider is required' using errcode = 'P0016';
  end if;

  if p_provider <> 'google_calendar' then
    raise exception 'provider must be google_calendar' using errcode = 'P0018';
  end if;

  if (p_end_time - p_start_time) <> interval '30 minutes' then
    raise exception 'duration must be exactly 30 minutes' using errcode = 'P0019';
  end if;

  if p_buffer_before is null or p_buffer_before < interval '0' then
    raise exception 'buffer_before must be >= 0' using errcode = 'P0012';
  end if;

  if p_buffer_after is null or p_buffer_after < interval '0' then
    raise exception 'buffer_after must be >= 0' using errcode = 'P0012';
  end if;

  -- ===========================================================================
  -- Idempotency: verify every booking identity field matches
  -- ===========================================================================
  -- Return the existing appointment ID only when *all* booking identity fields
  -- match. If the same p_event_id is reused with different data, raise P0020
  -- to prevent information leakage (never reveal an unrelated appointment ID).

  select
    id,
    lead_id,
    session_id,
    start_time,
    end_time,
    timezone,
    provider
  into
    v_existing_id,
    v_existing_lead_id,
    v_existing_session_id,
    v_existing_start_time,
    v_existing_end_time,
    v_existing_timezone,
    v_existing_provider
  from public.appointments
  where booking_event_id = p_event_id;

  if v_existing_id is not null then
    if v_existing_lead_id   is distinct from p_lead_id
    or v_existing_session_id is distinct from p_session_id
    or v_existing_start_time is distinct from p_start_time
    or v_existing_end_time   is distinct from p_end_time
    or v_existing_timezone   is distinct from p_timezone
    or v_existing_provider   is distinct from p_provider
    then
      raise exception 'Event ID already used with different booking data' using errcode = 'P0020';
    end if;
    return v_existing_id;
  end if;

  -- ===========================================================================
  -- Lock and validate lead
  -- ===========================================================================

  select status, session_id
  into strict v_lead_status, v_lead_session_id
  from public.leads
  where id = p_lead_id
  for update;

  -- ===========================================================================
  -- Lock and validate session
  -- ===========================================================================

  select status, lead_id, page_version
  into strict v_session_status, v_session_lead_id, v_page_version
  from public.funnel_sessions
  where id = p_session_id
  for update;

  -- Confirm session belongs to the lead
  if v_lead_session_id is distinct from p_session_id then
    raise exception 'Session does not belong to this lead' using errcode = 'P0003';
  end if;

  if v_session_lead_id is distinct from p_lead_id then
    raise exception 'Session does not belong to this lead' using errcode = 'P0003';
  end if;

  -- Reject if session is already booked
  if v_session_status = 'booked' then
    raise exception 'Session already booked' using errcode = 'P0008';
  end if;

  -- Reject if lead is already scheduled
  if v_lead_status = 'scheduled' then
    raise exception 'Lead already scheduled' using errcode = 'P0009';
  end if;

  -- ===========================================================================
  -- Global overlap check — ALL leads, not just p_lead_id
  -- ===========================================================================
  -- Only active statuses (pending, confirmed) block.
  -- The overlap window is expanded by buffers so no two appointments
  -- (including their buffer zones) overlap.
  -- Cancelled, failed, rescheduled, completed, no_show do not block.

  select count(*)
  into v_overlap_count
  from public.appointments
  where status in ('pending', 'confirmed')
    and start_time < p_end_time + p_buffer_after
    and end_time > p_start_time - p_buffer_before;

  if v_overlap_count > 0 then
    raise exception 'Time slot conflicts with existing appointment' using errcode = 'P0010';
  end if;

  -- ===========================================================================
  -- Create the appointment
  -- ===========================================================================

  insert into public.appointments (
    lead_id,
    session_id,
    status,
    provider,
    start_time,
    end_time,
    timezone,
    booking_event_id,
    external_event_id
  ) values (
    p_lead_id,
    p_session_id,
    'pending',
    p_provider,
    p_start_time,
    p_end_time,
    p_timezone,
    p_event_id,
    null
  )
  returning id into v_appointment_id;

  -- ===========================================================================
  -- Update lead status to scheduled
  -- ===========================================================================

  update public.leads
  set status = 'scheduled'
  where id = p_lead_id;

  -- ===========================================================================
  -- Update funnel session status to booked
  -- ===========================================================================

  update public.funnel_sessions
  set status = 'booked'
  where id = p_session_id;

  -- ===========================================================================
  -- Insert booking_completed funnel event
  -- ===========================================================================

  insert into public.funnel_events (
    session_id,
    lead_id,
    event_name,
    section_id,
    page_version,
    event_id,
    metadata
  ) values (
    p_session_id,
    p_lead_id,
    'booking_completed',
    'booking',
    v_page_version,
    p_event_id,
    jsonb_build_object(
      'appointment_id', v_appointment_id,
      'start_time', p_start_time,
      'end_time', p_end_time,
      'timezone', p_timezone,
      'provider', p_provider
    )
  );

  return v_appointment_id;
end;
$$;

-- =============================================================================
-- Revoke all execution from public / anon / authenticated
-- =============================================================================
revoke execute on function public.create_funnel_appointment(
  uuid, uuid, timestamptz, timestamptz, text, text, uuid, interval, interval
) from public, anon, authenticated;

-- =============================================================================
-- Grant execution only to service_role
-- =============================================================================
grant execute on function public.create_funnel_appointment(
  uuid, uuid, timestamptz, timestamptz, text, text, uuid, interval, interval
) to service_role;