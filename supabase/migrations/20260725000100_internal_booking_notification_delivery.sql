-- Migration: 20260725000100_internal_booking_notification_delivery
-- Adds database protection for internal booking notification email delivery.
--
-- This migration:
--   1. Verifies integration_deliveries can accept event_type = 'internal_booking_notification'
--   2. Safely adds a check constraint on event_type if one exists and does not allow it
--      (preserves all existing allowed event types)
--   3. Creates a unique partial index for internal booking notifications to enforce idempotency
--
-- This migration is NOT applied automatically. See docs/email-notifications.md.

-- 1. Ensure event_type allows 'internal_booking_notification'
--
-- Only create the check constraint if no event_type check constraint currently exists.
-- The initial schema (000100) does not define one, so this is additive.
-- We use DO $$ ... $$ to check for an existing constraint before altering.

do $$
begin
  -- Only add the constraint if no check constraint exists on event_type yet.
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'integration_deliveries'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%event_type%'
  ) then
    alter table public.integration_deliveries
      add constraint integration_deliveries_event_type_check
        check (event_type in (
          'booking_confirmation',
          'internal_booking_notification'
        ));
  end if;
end
$$;

-- 2. Unique partial index for internal booking notification deliveries
--
-- Prevents duplicate concurrent creation of internal delivery records for the
-- same appointment, destination, event type, and template version.
-- Scoped to destination = 'email' and event_type = 'internal_booking_notification'
-- to avoid conflict with the existing customer booking_confirmation index.

create unique index if not exists idx_integration_deliveries_internal_booking_unique
  on public.integration_deliveries (appointment_id, destination, event_type, template_version)
  where destination = 'email' and event_type = 'internal_booking_notification';

-- 3. Verify both event types are accepted
--
-- These assertions fail the migration if the constraint is missing or incomplete.
-- They are safe to run after the constraint is in place.

do $$
begin
  -- Verify 'booking_confirmation' is accepted (existing customer event type)
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'integration_deliveries'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%booking_confirmation%'
  ) then
    raise exception 'booking_confirmation must be allowed by event_type check constraint';
  end if;

  -- Verify 'internal_booking_notification' is accepted
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'integration_deliveries'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%internal_booking_notification%'
  ) then
    raise exception 'internal_booking_notification must be allowed by event_type check constraint';
  end if;
end
$$;
