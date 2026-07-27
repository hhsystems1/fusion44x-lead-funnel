-- Migration: 20260727000100_add_appointment_create_event_type
-- Adds 'appointment_create' to the integration_deliveries event_type CHECK constraint.
--
-- This is required because the Google Calendar integration delivery uses
-- event_type = 'appointment_create', but the existing constraint (added by
-- 20260725000100) only permits 'booking_confirmation' and
-- 'internal_booking_notification'.
--
-- Safety:
--   - Idempotent: no-ops if appointment_create is already allowed
--   - Transactional: all changes roll back on failure
--   - Preserves every existing allowed value
--   - Only modifies the event_type CHECK constraint on integration_deliveries

do $migration$
declare
  v_has_constraint boolean;
  v_has_appointment_create boolean;
  v_old_values     text[];
  v_new_values     text[];
  v_sql            text;
  v_def            text;
begin
  -- =========================================================================
  -- 1. Check whether any CHECK constraint on event_type exists
  -- =========================================================================
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

  -- =========================================================================
  -- 2. Check whether appointment_create is already permitted
  -- =========================================================================
  select exists(
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'integration_deliveries'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%event_type%'
      and pg_get_constraintdef(c.oid) like '%appointment_create%'
  ) into v_has_appointment_create;

  -- =========================================================================
  -- 3. No constraint exists — create one with all three event types
  -- =========================================================================
  if not v_has_constraint then
    alter table public.integration_deliveries
      add constraint integration_deliveries_event_type_check
        check (event_type in (
          'appointment_create',
          'booking_confirmation',
          'internal_booking_notification'
        ));

  -- =========================================================================
  -- 4. Constraint exists but does NOT include appointment_create — replace it
  -- =========================================================================
  elsif not v_has_appointment_create then
    -- Collect all CHECK constraint definitions that reference event_type
    select string_agg(pg_get_constraintdef(c.oid), ' ')
    into v_def
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'integration_deliveries'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%event_type%';

    -- Extract all allowed string literals from the constraint definition
    select array_agg(distinct m[1] order by m[1])
    into v_old_values
    from regexp_matches(v_def, $regex$'([^']+)'(?:::text)?$regex$, 'g') as m;

    -- Safety: extraction must have produced at least one value
    if v_old_values is null or array_length(v_old_values, 1) = 0 then
      raise exception 'could not extract existing event_type values from CHECK constraints — aborting to prevent data loss';
    end if;

    -- Drop all existing event_type CHECK constraints
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

    -- Build new value list: existing values + appointment_create
    select array_agg(distinct v order by v)
    into v_new_values
    from unnest(
      array_cat(
        coalesce(v_old_values, array[]::text[]),
        array['appointment_create']
      )
    ) v;

    -- Recreate the constraint with all allowed values
    execute format(
      'ALTER TABLE public.integration_deliveries
         ADD CONSTRAINT integration_deliveries_event_type_check
           CHECK (event_type = ANY (ARRAY[%s]::text[]))',
      (select string_agg(format('%L', val), ', ') from unnest(v_new_values) val)
    );

  -- =========================================================================
  -- 5. Constraint exists AND already includes appointment_create — no-op
  -- =========================================================================
  end if;
end
$migration$;

-- =============================================================================
-- Verify: all three event types must be accepted
-- =============================================================================

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
      and pg_get_constraintdef(c.oid) like '%appointment_create%'
  ) then
    raise exception 'appointment_create must be allowed by event_type check constraint';
  end if;

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
      and pg_get_constraintdef(c.oid) like '%internal_booking_notification%'
  ) then
    raise exception 'internal_booking_notification must be allowed by event_type check constraint';
  end if;
end
$verify$;
