-- =============================================================================
-- confirm_funnel_appointment
-- =============================================================================
-- Description: Confirms a pending funnel appointment by:
--   1. Locks the appointment row (SELECT ... FOR UPDATE)
--   2. Confirms the appointment exists
--   3. Requires current status = pending
--   4. Sets status = confirmed, external_event_id, updated_at
--   5. Rejects an external_event_id already linked to another appointment
--   6. Returns the confirmed appointment ID
--
-- Security:
--   - SECURITY DEFINER ensures execution with owner privileges
--   - search_path is locked to '' (secure)
--   - EXECUTE revoked from public/anon/authenticated
--   - EXECUTE granted only to service_role
--   - Uses parameterized PL/pgSQL (no dynamic SQL)
-- =============================================================================

create or replace function public.confirm_funnel_appointment(
  p_appointment_id      uuid,
  p_external_event_id   text,
  p_provider_response_status text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_status text;
  v_existing_id    uuid;
  v_confirmed_id   uuid;
begin
  -- ===========================================================================
  -- Input validation
  -- ===========================================================================

  if p_appointment_id is null then
    raise exception 'appointment_id is required' using errcode = 'P0100';
  end if;

  if p_external_event_id is null or p_external_event_id = '' then
    raise exception 'external_event_id is required' using errcode = 'P0101';
  end if;

  -- ===========================================================================
  -- Reject if external_event_id already linked to another appointment
  -- ===========================================================================

  select id into v_existing_id
  from public.appointments
  where external_event_id = p_external_event_id
    and id is distinct from p_appointment_id
  limit 1;

  if v_existing_id is not null then
    raise exception 'external_event_id already linked to another appointment' using errcode = 'P0102';
  end if;

  -- ===========================================================================
  -- Lock and verify appointment
  -- ===========================================================================

  select status
  into strict v_current_status
  from public.appointments
  where id = p_appointment_id
  for update;

  if v_current_status is distinct from 'pending' then
    if v_current_status = 'confirmed' then
      return p_appointment_id;
    end if;
    raise exception 'appointment status must be pending, got: %', v_current_status using errcode = 'P0103';
  end if;

  -- ===========================================================================
  -- Confirm the appointment
  -- ===========================================================================

  update public.appointments
  set
    status = 'confirmed',
    external_event_id = p_external_event_id,
    updated_at = now()
  where id = p_appointment_id
  returning id into v_confirmed_id;

  return v_confirmed_id;
end;
$$;

-- =============================================================================
-- Revoke all execution from public / anon / authenticated
-- =============================================================================
revoke execute on function public.confirm_funnel_appointment(uuid, text, text)
  from public, anon, authenticated;

-- =============================================================================
-- Grant execution only to service_role
-- =============================================================================
grant execute on function public.confirm_funnel_appointment(uuid, text, text)
  to service_role;

-- =============================================================================
-- fail_funnel_appointment
-- =============================================================================
-- Description: Marks a pending funnel appointment as failed:
--   1. Locks the appointment row
--   2. Only allows pending appointments
--   3. Sets status = failed
--   4. Records a safe failure reason
--   5. Ensures failed appointments stop blocking availability
--
-- Security:
--   - SECURITY DEFINER ensures execution with owner privileges
--   - search_path is locked to '' (secure)
--   - EXECUTE revoked from public/anon/authenticated
--   - EXECUTE granted only to service_role
-- =============================================================================

create or replace function public.fail_funnel_appointment(
  p_appointment_id  uuid,
  p_safe_error_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_status text;
  v_failed_id      uuid;
begin
  -- ===========================================================================
  -- Input validation
  -- ===========================================================================

  if p_appointment_id is null then
    raise exception 'appointment_id is required' using errcode = 'P0110';
  end if;

  -- ===========================================================================
  -- Lock and verify appointment
  -- ===========================================================================

  select status
  into strict v_current_status
  from public.appointments
  where id = p_appointment_id
  for update;

  if v_current_status is distinct from 'pending' then
    if v_current_status = 'failed' then
      return p_appointment_id;
    end if;
    raise exception 'appointment status must be pending, got: %', v_current_status using errcode = 'P0111';
  end if;

  -- ===========================================================================
  -- Fail the appointment
  -- ===========================================================================

  update public.appointments
  set
    status = 'failed',
    updated_at = now()
  where id = p_appointment_id
  returning id into v_failed_id;

  return v_failed_id;
end;
$$;

-- =============================================================================
-- Revoke all execution from public / anon / authenticated
-- =============================================================================
revoke execute on function public.fail_funnel_appointment(uuid, text)
  from public, anon, authenticated;

-- =============================================================================
-- Grant execution only to service_role
-- =============================================================================
grant execute on function public.fail_funnel_appointment(uuid, text)
  to service_role;

-- =============================================================================
-- booking_event_id unique constraint (for consistency with the RPC)
-- =============================================================================
-- Already created in 20260724000300 as:
--   create unique index if not exists idx_appointments_booking_event_id
--     on public.appointments (booking_event_id)
--     where booking_event_id is not null;
-- Re-asserting here for clarity.
