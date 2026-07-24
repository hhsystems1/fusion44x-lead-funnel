-- =============================================================================
-- create_funnel_appointment
-- =============================================================================
-- Description: Atomically creates an appointment, updating related records:
--   1. Acquires a transaction-scoped advisory lock on the requested slot to
--      serialize concurrent bookings for the same time window.
--   2. Validates the lead exists
--   3. Validates the session exists and belongs to the lead
--   4. Rejects if the session or lead is already booked
--   5. Rejects ANY overlapping active appointment (global — not per-lead)
--   6. Creates the appointment with pending status
--   7. Updates lead status to 'scheduled'
--   8. Updates funnel session status to 'booked'
--   9. Inserts booking_completed funnel event
--  10. Returns the appointment ID
--
-- Concurrency:
--   A pg_try_advisory_xact_lock is acquired on a 64-bit key derived from
--   the slot start_time (epoch microseconds). If the lock cannot be acquired
--   immediately (another tx is booking the same slot), the function raises
--   a conflict error. This serializes booking on a single slot without
--   blocking other slots.
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
--   The overlap window is expanded by BUFFER_BEFORE and BUFFER_AFTER
--   (configured server-side) so no two appointments overlap including buffers.
--
-- Security:
--   - SECURITY DEFINER ensures execution with owner privileges
--   - search_path is locked to '' (secure)
--   - EXECUTE revoked from public/anon/authenticated
--   - EXECUTE granted only to service_role
--   - Uses parameterized PL/pgSQL (no dynamic SQL)
-- =============================================================================

create or replace function public.create_funnel_appointment(
  p_lead_id    uuid,
  p_session_id uuid,
  p_start_time timestamptz,
  p_end_time   timestamptz,
  p_timezone   text,
  p_provider   text,
  p_event_id   uuid
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
  v_buffer_before     interval := interval '0 minutes';
  v_buffer_after      interval := interval '0 minutes';
  v_locked            boolean;
begin
  -- ===========================================================================
  -- Advisory lock: serialize on the slot start_time
  -- ===========================================================================
  -- Derive a 64-bit key from the start_time epoch microseconds. This ensures
  -- two simultaneous requests for the exact same slot are serialized.
  -- pg_try_advisory_xact_lock returns false (no exception) if another session
  -- holds the lock, so we bail immediately instead of blocking.
  select pg_try_advisory_xact_lock(
    (extract(epoch from p_start_time) * 1000000)::bigint
  ) into v_locked;

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

  if p_provider is null or p_provider = '' then
    raise exception 'provider is required' using errcode = 'P0016';
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
    and start_time < p_end_time + v_buffer_after
    and end_time > p_start_time - v_buffer_before;

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
    external_event_id
  ) values (
    p_lead_id,
    p_session_id,
    'pending',
    p_provider,
    p_start_time,
    p_end_time,
    p_timezone,
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
  uuid, uuid, timestamptz, timestamptz, text, text, uuid
) from public, anon, authenticated;

-- =============================================================================
-- Grant execution only to service_role
-- =============================================================================
grant execute on function public.create_funnel_appointment(
  uuid, uuid, timestamptz, timestamptz, text, text, uuid
) to service_role;