-- Migration: 20260729000100_add_booking_followup_event_type
-- Adds database protection for the automated booking follow-up email delivery.
--
-- This migration handles three schema states:
--   1. No event_type CHECK constraint exists → create one
--   2. Existing constraint already permits booking_followup → no-op
--   3. Existing constraint excludes booking_followup → replace it
--      with existing allowed values + booking_followup
--
-- Existing allowed event types are always preserved. The migration is
-- transactional and idempotent.
--
-- This migration is NOT applied automatically. See docs/email-notifications.md.

-- 1. Ensure event_type allows 'booking_followup'

do $migration$
declare
  v_has_constraint boolean;
  v_has_followup   boolean;
  v_old_values     text[];
  v_new_values     text[];
  v_sql            text;
  v_def            text;
begin
  -- Check whether any CHECK constraint on event_type exists
  select exists(
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'integration_deliveries'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%event_type%'
  ) into v_has_constraint;

  -- Check whether any event_type CHECK constraint already permits booking_followup
  select exists(
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'integration_deliveries'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%event_type%'
      and pg_get_constraintdef(c.oid) like '%booking_followup%'
  ) into v_has_followup;

  -- Case 1: No event_type CHECK constraint exists — create one
  if not v_has_constraint then
    alter table public.integration_deliveries
      add constraint integration_deliveries_event_type_check
        check (event_type in (
          'booking_confirmation',
          'booking_followup',
          'internal_booking_notification',
          'appointment_create'
        ));

  -- Case 2: Constraint exists but does not permit booking_followup — replace it
  elsif not v_has_followup then
    -- Collect all CHECK constraint definitions that reference event_type,
    -- then extract allowed string literals from every one of them.
    select string_agg(pg_get_constraintdef(c.oid), ' ')
    into v_def
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'integration_deliveries'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%event_type%';

    select array_agg(distinct m[1] order by m[1])
    into v_old_values
    from regexp_matches(v_def, $regex$'([^']+)'(?:::text)?$regex$, 'g') as m;

    -- Safety: extraction must have produced at least one value
    if v_old_values is null or array_length(v_old_values, 1) = 0 then
      raise exception 'could not extract existing event_type values from CHECK constraints — aborting to prevent data loss';
    end if;

    -- Safety: booking_confirmation must be among the preserved values
    if not ('booking_confirmation' = any(v_old_values)) then
      raise exception 'booking_confirmation is not present in extracted event_type values — aborting to prevent data loss';
    end if;

    -- Drop all existing event_type CHECK constraints (they are incompatible)
    for v_sql in
      select format(
        'ALTER TABLE public.integration_deliveries DROP CONSTRAINT %I',
        c.conname
      )
      from pg_constraint c
      join pg_class t on c.conrelid = t.oid
      join pg_namespace n on t.relnamespace = n.oid
      where n.nspname = 'public'
        and t.relname = 'integration_deliveries'
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) like '%event_type%'
    loop
      execute v_sql;
    end loop;

    -- Build the new value list: existing values + booking_followup
    select array_agg(distinct v order by v)
    into v_new_values
    from unnest(
      array_cat(
        coalesce(v_old_values, array[]::text[]),
        array['booking_followup']
      )
    ) v;

    -- Recreate the constraint with all allowed values
    execute format(
      'ALTER TABLE public.integration_deliveries
         ADD CONSTRAINT integration_deliveries_event_type_check
           CHECK (event_type = ANY (ARRAY[%s]::text[]))',
      (select string_agg(format('%L', val), ', ') from unnest(v_new_values) val)
    );

  -- Case 3: Constraint exists and already permits booking_followup — no-op
  end if;
end
$migration$;

-- 2. Unique partial index for booking follow-up deliveries
--
-- Prevents duplicate concurrent creation of follow-up delivery records for the
-- same appointment, destination, event type, and template version.
-- Scoped to destination = 'email' and event_type = 'booking_followup'
-- to avoid conflict with the existing customer booking_confirmation index.

create unique index if not exists idx_integration_deliveries_booking_followup_unique
  on public.integration_deliveries (appointment_id, destination, event_type, template_version)
  where destination = 'email' and event_type = 'booking_followup';

-- 3. Verify event types are accepted
--
-- These assertions fail the migration if the constraint is missing or incomplete.
-- They are safe to run after the constraint is in place.

do $verify$
begin
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

  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'integration_deliveries'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%booking_followup%'
  ) then
    raise exception 'booking_followup must be allowed by event_type check constraint';
  end if;
end
$verify$;
