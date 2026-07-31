-- Migration: 20260731000100_exit_popup_and_lead_stages
-- Adds database support for the funnel exit popup and dashboard lead staging.
--
-- Changes:
--   1. Makes diagnostic/contact columns on leads nullable so exit-popup
--      leads can be captured before the full diagnostic is completed.
--   2. Adds leads.lead_origin ('funnel' | 'exit_popup') to record how a
--      lead was first captured.
--   3. Adds leads.stage for the dashboard pipeline stage selector
--      ('contacted' | 'no_show' | 'follow_up' | 'won' | 'lost').
--   4. Creates create_lead_from_popup for exit-popup submissions
--      (idempotent per session, consent enforced, service_role only).
--   5. Upgrades create_lead_from_funnel_session so a session linked to an
--      exit-popup lead can be upgraded in place with the full diagnostic
--      instead of failing with "Session already linked to a lead".
--
-- This migration is NOT applied automatically. See docs/database-schema.md.

-- =============================================================================
-- 1. Relax NOT NULL constraints on leads
-- =============================================================================

do $migration$
declare
  v_sql text;
begin
  for v_sql in
    select format(
      'ALTER TABLE public.leads ALTER COLUMN %I DROP NOT NULL',
      c.column_name
    )
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'leads'
      and c.column_name in (
        'phone',
        'zip_code',
        'water_feature',
        'installation_type',
        'pool_size',
        'current_treatment',
        'primary_goal'
      )
      and c.is_nullable = 'NO'
  loop
    execute v_sql;
  end loop;
end
$migration$;

-- =============================================================================
-- 2. Add leads.lead_origin
-- =============================================================================

do $migration$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'lead_origin'
  ) then
    alter table public.leads
      add column lead_origin text not null default 'funnel'
        constraint leads_lead_origin_check
          check (lead_origin in ('funnel', 'exit_popup'));
  end if;
end
$migration$;

comment on column public.leads.lead_origin is
  'How the lead was first captured: funnel (full diagnostic) or exit_popup.';

-- =============================================================================
-- 3. Add leads.stage
-- =============================================================================

do $migration$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'stage'
  ) then
    alter table public.leads
      add column stage text null
        constraint leads_stage_check
          check (stage in ('contacted', 'no_show', 'follow_up', 'won', 'lost'));
  end if;
end
$migration$;

comment on column public.leads.stage is
  'Manual sales pipeline stage set from the admin dashboard. Null = not staged yet.';

-- =============================================================================
-- 4. create_lead_from_popup
-- =============================================================================
-- Description: Atomically creates a lead from the funnel exit popup form,
-- which captures only name, email, and phone (no diagnostic answers).
--
-- Concurrency:
--   Locks the session row (SELECT ... FOR UPDATE) before checking lead_id
--   so two simultaneous requests cannot both proceed.
--
-- Idempotency:
--   If the session is already linked to an exit_popup lead, the existing
--   lead id is returned without creating a duplicate.
--
-- Validation:
--   - p_consent_to_contact must be true
--
-- Security:
--   - SECURITY DEFINER ensures execution with owner privileges
--   - search_path is set to public for secure resolution
--   - EXECUTE is revoked from public/anon/authenticated
--   - EXECUTE is granted only to service_role
--   - Uses parameterized PL/pgSQL (no dynamic SQL)

create or replace function public.create_lead_from_popup(
  p_session_id            uuid,
  p_first_name            text,
  p_last_name             text,
  p_email                 text,
  p_phone                 text,
  p_zip_code              text,
  p_consent_to_contact    boolean,
  p_consent_text_version  text,
  p_marketing_consent     boolean,
  p_source                text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead_id      uuid;
  v_page_version text;
  v_session_lead_id uuid;
  v_lead_origin  text;
begin
  -- Lock the session row and check existence + lead_id in one query
  select lead_id, page_version
  into strict v_session_lead_id, v_page_version
  from public.funnel_sessions
  where id = p_session_id
  for update;

  -- Session already linked to a lead
  if v_session_lead_id is not null then
    select lead_origin into v_lead_origin
    from public.leads
    where id = v_session_lead_id;

    -- An existing exit_popup lead is idempotent — return it
    if coalesce(v_lead_origin, 'funnel') = 'exit_popup' then
      return v_session_lead_id;
    end if;

    raise exception 'Session already linked to a lead' using errcode = 'P0003';
  end if;

  -- Enforce consent at the database level
  if p_consent_to_contact is not true then
    raise exception 'consent_to_contact must be true' using errcode = 'P0004';
  end if;

  -- Create the lead without diagnostic answers
  insert into public.leads (
    session_id,
    first_name,
    last_name,
    email,
    phone,
    zip_code,
    consent_to_contact,
    consent_to_contact_at,
    marketing_consent,
    marketing_consent_at,
    consent_text_version,
    source,
    lead_origin,
    qualification_summary
  ) values (
    p_session_id,
    p_first_name,
    p_last_name,
    p_email,
    nullif(p_phone, ''),
    nullif(p_zip_code, ''),
    p_consent_to_contact,
    now(),
    p_marketing_consent,
    case when p_marketing_consent then now() else null end,
    p_consent_text_version,
    p_source,
    'exit_popup',
    null
  )
  returning id into v_lead_id;

  -- Update funnel_sessions with the new lead_id and status
  update public.funnel_sessions
  set
    lead_id = v_lead_id,
    status = 'lead_created'
  where id = p_session_id;

  -- Insert lead_created funnel event
  insert into public.funnel_events (
    session_id,
    lead_id,
    event_name,
    section_id,
    page_version
  ) values (
    p_session_id,
    v_lead_id,
    'lead_created',
    'exit-popup',
    v_page_version
  );

  return v_lead_id;
end;
$$;

-- =============================================================================
-- Revoke all execution from public / anon / authenticated
-- =============================================================================
revoke execute on function public.create_lead_from_popup(
  uuid, text, text, text, text, text, boolean, text, boolean, text
) from public, anon, authenticated;

-- =============================================================================
-- Grant execution only to service_role (dashboard user)
-- =============================================================================
grant execute on function public.create_lead_from_popup(
  uuid, text, text, text, text, text, boolean, text, boolean, text
) to service_role;

-- =============================================================================
-- 5. Upgrade create_lead_from_funnel_session
-- =============================================================================
-- When a session is already linked to an exit_popup lead, the full funnel
-- submission upgrades that lead in place with the diagnostic answers instead
-- of raising "Session already linked to a lead". Sessions linked to a funnel
-- lead keep the existing P0003 rejection.

create or replace function public.create_lead_from_funnel_session(
  p_session_id              uuid,
  p_first_name              text,
  p_last_name               text,
  p_email                   text,
  p_phone                   text,
  p_zip_code                text,
  p_water_feature           text,
  p_installation_type       text,
  p_pool_size               text,
  p_current_treatment       text,
  p_current_issues          text[],
  p_primary_goal            text,
  p_consent_to_contact      boolean,
  p_consent_text_version    text,
  p_preferred_contact_method text,
  p_marketing_consent       boolean,
  p_source                  text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead_id      uuid;
  v_issue_text   text;
  v_page_version text;
  v_session_lead_id uuid;
  v_lead_origin  text;
begin
  -- Lock the session row and check existence + lead_id in one query
  select lead_id, page_version
  into strict v_session_lead_id, v_page_version
  from public.funnel_sessions
  where id = p_session_id
  for update;

  -- Enforce consent at the database level
  if p_consent_to_contact is not true then
    raise exception 'consent_to_contact must be true' using errcode = 'P0004';
  end if;

  -- Validate current_issues: not null, not empty, no duplicates
  if p_current_issues is null then
    raise exception 'current_issues must not be null' using errcode = 'P0005';
  end if;

  if array_length(p_current_issues, 1) is null or array_length(p_current_issues, 1) = 0 then
    raise exception 'current_issues must not be empty' using errcode = 'P0006';
  end if;

  if (select count(*) from unnest(p_current_issues) as x) <>
     (select count(distinct x) from unnest(p_current_issues) as x) then
    raise exception 'current_issues must not contain duplicate values' using errcode = 'P0007';
  end if;

  -- Session already linked to a lead
  if v_session_lead_id is not null then
    select lead_origin into v_lead_origin
    from public.leads
    where id = v_session_lead_id;

    -- Only exit_popup leads can be upgraded; funnel leads stay rejected
    if coalesce(v_lead_origin, 'funnel') <> 'exit_popup' then
      raise exception 'Session already linked to a lead' using errcode = 'P0003';
    end if;

    -- Upgrade the exit_popup lead with the full funnel diagnostic
    update public.leads
    set
      phone = coalesce(nullif(p_phone, ''), phone),
      zip_code = coalesce(nullif(p_zip_code, ''), zip_code),
      preferred_contact_method = coalesce(p_preferred_contact_method, preferred_contact_method),
      water_feature = p_water_feature,
      installation_type = p_installation_type,
      pool_size = p_pool_size,
      current_treatment = p_current_treatment,
      primary_goal = p_primary_goal
    where id = v_session_lead_id
    returning id into v_lead_id;

    -- Re-sync lead_answers to match the submitted diagnostic
    delete from public.lead_answers where lead_id = v_lead_id;

    insert into public.lead_answers (lead_id, question_id, answer_code, answer_order)
    values
      (v_lead_id, 'water-feature',       p_water_feature,         1),
      (v_lead_id, 'installation-type',   p_installation_type,     2),
      (v_lead_id, 'pool-size',           p_pool_size,             3),
      (v_lead_id, 'current-treatment',   p_current_treatment,     4),
      (v_lead_id, 'primary-goal',        p_primary_goal,          6);

    for v_issue_text in select distinct unnest(p_current_issues) loop
      insert into public.lead_answers (lead_id, question_id, answer_code, answer_order)
      values (v_lead_id, 'current-issues', v_issue_text, 5);
    end loop;

    update public.funnel_sessions
    set status = 'lead_created'
    where id = p_session_id;

    return v_lead_id;
  end if;

  -- Create the lead
  insert into public.leads (
    session_id,
    first_name,
    last_name,
    email,
    phone,
    zip_code,
    preferred_contact_method,
    water_feature,
    installation_type,
    pool_size,
    current_treatment,
    primary_goal,
    consent_to_contact,
    consent_to_contact_at,
    marketing_consent,
    marketing_consent_at,
    consent_text_version,
    source,
    qualification_summary
  ) values (
    p_session_id,
    p_first_name,
    p_last_name,
    p_email,
    p_phone,
    p_zip_code,
    p_preferred_contact_method,
    p_water_feature,
    p_installation_type,
    p_pool_size,
    p_current_treatment,
    p_primary_goal,
    p_consent_to_contact,
    now(),
    p_marketing_consent,
    case when p_marketing_consent then now() else null end,
    p_consent_text_version,
    p_source,
    null
  )
  returning id into v_lead_id;

  -- Create lead_answers for each single-select diagnostic answer
  insert into public.lead_answers (lead_id, question_id, answer_code, answer_order)
  values
    (v_lead_id, 'water-feature',       p_water_feature,         1),
    (v_lead_id, 'installation-type',   p_installation_type,     2),
    (v_lead_id, 'pool-size',           p_pool_size,             3),
    (v_lead_id, 'current-treatment',   p_current_treatment,     4),
    (v_lead_id, 'primary-goal',        p_primary_goal,          6);

  -- Create lead_answers for each current_issues entry (multi-select)
  for v_issue_text in select distinct unnest(p_current_issues) loop
    insert into public.lead_answers (lead_id, question_id, answer_code, answer_order)
    values (v_lead_id, 'current-issues', v_issue_text, 5);
  end loop;

  -- Update funnel_sessions with the new lead_id and status
  update public.funnel_sessions
  set
    lead_id = v_lead_id,
    status = 'lead_created'
  where id = p_session_id;

  -- Insert lead_created funnel event
  insert into public.funnel_events (
    session_id,
    lead_id,
    event_name,
    section_id,
    page_version
  ) values (
    p_session_id,
    v_lead_id,
    'lead_created',
    'contact-information',
    v_page_version
  );

  return v_lead_id;
end;
$$;

-- =============================================================================
-- 6. Verify schema state
-- =============================================================================

do $verify$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'lead_origin'
  ) then
    raise exception 'leads.lead_origin column must exist';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'stage'
  ) then
    raise exception 'leads.stage column must exist';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'public'
      and p.proname = 'create_lead_from_popup'
  ) then
    raise exception 'create_lead_from_popup function must exist';
  end if;
end
$verify$;
