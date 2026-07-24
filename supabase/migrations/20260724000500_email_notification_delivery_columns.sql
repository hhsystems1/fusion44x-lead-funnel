-- Migration: 20260724000500_email_notification_delivery_columns
-- Adds columns for email booking-confirmation delivery tracking and RPC functions.
-- This migration is NOT applied automatically. See docs/email-notifications.md.

-- 1. Add columns to integration_deliveries
alter table public.integration_deliveries
  add column if not exists template_version text;

alter table public.integration_deliveries
  add column if not exists provider_message_id text;

alter table public.integration_deliveries
  add column if not exists next_attempt_at timestamptz;

-- 2. Unique partial index for idempotent email booking confirmations
create unique index if not exists idx_integration_deliveries_email_booking_unique
  on public.integration_deliveries (appointment_id, destination, event_type, template_version)
  where destination = 'email' and event_type = 'booking_confirmation';

-- 3. RPC: claim_email_delivery
-- Atomically claims a delivery for processing if eligible.
-- Returns true if claimed, false if not eligible (already delivered, dead_letter, max attempts reached, or not due).
create or replace function public.claim_email_delivery(
  p_delivery_id uuid,
  p_max_attempts int default 5
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_delivery record;
  v_now timestamptz := now();
begin
  -- Lock the row for update
  select *
  into v_delivery
  from public.integration_deliveries
  where id = p_delivery_id
  for update;

  if not found then
    return false;
  end if;

  -- Already delivered - idempotent success
  if v_delivery.status = 'delivered' then
    return false;
  end if;

  -- Dead letter - never retry
  if v_delivery.status = 'dead_letter' then
    return false;
  end if;

  -- Max attempts reached - move to dead_letter
  if v_delivery.attempt_count >= p_max_attempts then
    update public.integration_deliveries
    set status = 'dead_letter',
        last_attempt_at = v_now
    where id = p_delivery_id;
    return false;
  end if;

  -- Not due yet (next_attempt_at in future)
  if v_delivery.next_attempt_at is not null and v_delivery.next_attempt_at > v_now then
    return false;
  end if;

  -- Only claim if pending or failed (retryable)
  if v_delivery.status not in ('pending', 'failed') then
    return false;
  end if;

  -- Claim it
  update public.integration_deliveries
  set status = 'processing',
      attempt_count = v_delivery.attempt_count + 1,
      last_attempt_at = v_now
  where id = p_delivery_id;

  return true;
end;
$$;

-- 4. RPC: mark_email_delivery_delivered
-- Marks delivery as delivered with provider message ID.
create or replace function public.mark_email_delivery_delivered(
  p_delivery_id uuid,
  p_provider_message_id text
)
returns void
language plpgsql
security definer
as $$
begin
  update public.integration_deliveries
  set status = 'delivered',
      provider_message_id = p_provider_message_id,
      delivered_at = now(),
      last_attempt_at = now()
  where id = p_delivery_id;
end;
$$;

-- 5. RPC: mark_email_delivery_failed
-- Marks delivery as failed, schedules next attempt if retryable, or dead_letter if terminal/max attempts.
create or replace function public.mark_email_delivery_failed(
  p_delivery_id uuid,
  p_safe_error_code text,
  p_retryable boolean,
  p_base_backoff_ms int default 60000,
  p_max_backoff_ms int default 3600000
)
returns void
language plpgsql
security definer
as $$
declare
  v_delivery record;
  v_next_attempt timestamptz;
  v_backoff_ms int;
  v_now timestamptz := now();
begin
  -- Lock the row
  select *
  into v_delivery
  from public.integration_deliveries
  where id = p_delivery_id
  for update;

  if not found then
    return;
  end if;

  -- If not retryable, move to dead_letter immediately
  if not p_retryable then
    update public.integration_deliveries
    set status = 'dead_letter',
        error_message = p_safe_error_code,
        last_attempt_at = v_now
    where id = p_delivery_id;
    return;
  end if;

  -- Calculate exponential backoff: base * 2^(attempt-1), capped at max
  v_backoff_ms := least(
    p_base_backoff_ms * pow(2, v_delivery.attempt_count - 1)::int,
    p_max_backoff_ms
  );

  v_next_attempt := v_now + (v_backoff_ms || ' milliseconds')::interval;

  -- If this was the last allowed attempt, move to dead_letter
  if v_delivery.attempt_count >= 5 then
    update public.integration_deliveries
    set status = 'dead_letter',
        error_message = p_safe_error_code,
        last_attempt_at = v_now,
        next_attempt_at = null
    where id = p_delivery_id;
    return;
  end if;

  -- Schedule retry
  update public.integration_deliveries
  set status = 'failed',
      error_message = p_safe_error_code,
      last_attempt_at = v_now,
      next_attempt_at = v_next_attempt
  where id = p_delivery_id;
end;
$$;