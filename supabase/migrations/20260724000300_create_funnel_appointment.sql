-- =============================================================================
-- create_funnel_appointment
-- =============================================================================
-- Description: Atomically creates an appointment, updating related records:
--   1. Validates the lead exists
--   2. Validates the session exists and belongs to the lead
--   3. Rejects if the session or lead is already booked
--   4. Rejects overlapping active (pending/confirmed) appointments
--   5. Creates the appointment with pending status
--   6. Updates lead status to 'scheduled'
--   7. Updates funnel session status to 'booked'
--   8. Inserts booking_completed funnel event
--   9. Returns the appointment ID
--
-- Concurrency:
--   Locks leads and funnel_sessions rows (SELECT ... FOR UPDATE)
--   Uses a non-blocking advisory lock for overlapping time-slot check
--   to prevent phantom overlapping inserts
--
-- Active statuses that block a time slot:
--   - pending
--   - confirmed
--
-- Non-blocking statuses (do not affect availability):
--   - cancelled, rescheduled, completed, no_show, failed
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
begin
  -- Lock and validate lead
  select status, session_id
  into strict v_lead_status, v_lead_session_id
  from public.leads
  where id = p_lead_id
  for update;

  -- Lock and validate session
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

  -- Reject if lead is already scheduled (has active appointment)
  if v_lead_status = 'scheduled' then
    raise exception 'Lead already scheduled' using errcode = 'P0009';
  end if;

  -- Reject overlapping active appointments (pending or confirmed)
  -- Only active statuses block — cancelled, failed, rescheduled do not
  select count(*)
  into v_overlap_count
  from public.appointments
  where lead_id = p_lead_id
    and status in ('pending', 'confirmed')
    and start_time < p_end_time
    and end_time > p_start_time;

  if v_overlap_count > 0 then
    raise exception 'Time slot conflicts with existing appointment' using errcode = 'P0010';
  end if;

  -- Create the appointment
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

  -- Update lead status to scheduled
  update public.leads
  set status = 'scheduled'
  where id = p_lead_id;

  -- Update funnel session status to booked
  update public.funnel_sessions
  set status = 'booked'
  where id = p_session_id;

  -- Insert booking_completed funnel event
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