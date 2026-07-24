-- Migration: 20260724000600_email_delivery_claim_rpc
-- Creates atomic claim RPC for email delivery processing.
-- This prevents concurrent sends and enforces retry/backoff at the database level.

-- Function to atomically claim an email booking_confirmation delivery for processing.
-- Returns true if this caller acquired the delivery, false otherwise.
create or replace function public.claim_email_delivery(
  p_delivery_id uuid,
  p_max_attempts int default 5
) returns boolean
language plpgsql
security definer
as $$
declare
  v_row public.integration_deliveries%rowtype;
  v_now timestamptz := now();
begin
  -- Lock the row and check eligibility
  select *
  into v_row
  from public.integration_deliveries
  where id = p_delivery_id
    and destination = 'email'
    and event_type = 'booking_confirmation'
  for update;

  if not found then
    return false;
  end if;

  -- Reject already delivered
  if v_row.status = 'delivered' then
    return false;
  end if;

  -- Reject currently processing
  if v_row.status = 'processing' then
    return false;
  end if;

  -- Enforce max attempts
  if v_row.attempt_count >= p_max_attempts then
    update public.integration_deliveries
    set status = 'dead_letter',
        updated_at = v_now
    where id = p_delivery_id;
    return false;
  end if;

  -- Enforce next_attempt_at backoff
  if v_row.next_attempt_at is not null and v_row.next_attempt_at > v_now then
    return false;
  end if;

  -- Claim: increment attempt_count, set processing
  update public.integration_deliveries
  set status = 'processing',
      attempt_count = v_row.attempt_count + 1,
      last_attempt_at = v_now,
      updated_at = v_now
  where id = p_delivery_id;

  return true;
end;
$$;

grant execute on function public.claim_email_delivery(uuid, int) to service_role;

-- Function to mark email delivery as delivered (with provider message ID)
create or replace function public.mark_email_delivery_delivered(
  p_delivery_id uuid,
  p_provider_message_id text
) returns void
language plpgsql
security definer
as $$
begin
  update public.integration_deliveries
  set status = 'delivered',
      provider_message_id = p_provider_message_id,
      delivered_at = now(),
      last_attempt_at = now(),
      updated_at = now()
  where id = p_delivery_id
    and destination = 'email'
    and event_type = 'booking_confirmation';
end;
$$;

grant execute on function public.mark_email_delivery_delivered(uuid, text) to service_role;

-- Function to mark email delivery as failed with safe error code and next_attempt_at
create or replace function public.mark_email_delivery_failed(
  p_delivery_id uuid,
  p_safe_error_code text,
  p_retryable boolean,
  p_base_backoff_ms int default 60000,
  p_max_backoff_ms int default 3600000
) returns void
language plpgsql
security definer
as $$
declare
  v_row public.integration_deliveries%rowtype;
  v_next_attempt timestamptz;
  v_backoff_ms int;
begin
  select *
  into v_row
  from public.integration_deliveries
  where id = p_delivery_id
    and destination = 'email'
    and event_type = 'booking_confirmation';

  if not found then
    return;
  end if;

  if p_retryable and v_row.attempt_count < 5 then
    -- Exponential backoff: base * 2^(attempt-1), capped at max
    v_backoff_ms := least(p_base_backoff_ms * power(2, v_row.attempt_count - 1), p_max_backoff_ms);
    v_next_attempt := now() + (v_backoff_ms || ' milliseconds')::interval;

    update public.integration_deliveries
    set status = 'failed',
        error_message = p_safe_error_code,
        next_attempt_at = v_next_attempt,
        last_attempt_at = now(),
        updated_at = now()
    where id = p_delivery_id;
  else
    -- Terminal or max attempts reached
    update public.integration_deliveries
    set status = 'dead_letter',
        error_message = p_safe_error_code,
        next_attempt_at = null,
        last_attempt_at = now(),
        updated_at = now()
    where id = p_delivery_id;
  end if;
end;
$$;

grant execute on function public.mark_email_delivery_failed(uuid, text, boolean, int, int) to service_role;