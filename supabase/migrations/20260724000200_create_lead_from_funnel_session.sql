-- =============================================================================
-- create_lead_from_funnel_session
-- =============================================================================
-- Description: Atomically creates a lead from a funnel session, including:
--   1. Validates the session exists and is not already linked to a lead
--   2. Creates the lead record
--   3. Creates lead_answers rows for each diagnostic answer
--   4. Updates funnel_sessions.lead_id and status → 'lead_created'
--   5. Inserts a lead_created funnel event
--   6. Returns the new lead ID
--
-- Concurrency:
--   Locks the session row (SELECT ... FOR UPDATE) before checking lead_id
--   so two simultaneous requests cannot both proceed.
--
-- Validation:
--   - p_consent_to_contact must be true
--   - p_current_issues must not be null, empty, or contain duplicates
--
-- Security:
--   - SECURITY DEFINER ensures execution with owner privileges
--   - search_path is set to public for secure resolution
--   - EXECUTE is revoked from public/anon/authenticated
--   - EXECUTE is granted only to service_role
--   - Uses parameterized PL/pgSQL (no dynamic SQL)
-- =============================================================================

-- All parameters are required (no DEFAULT) so the caller must provide
-- explicit values. This avoids invalid PostgreSQL syntax where a
-- defaulted parameter appears before a non-defaulted one.
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
begin
  -- Lock the session row and check existence + lead_id in one query
  select lead_id, page_version
  into strict v_session_lead_id, v_page_version
  from public.funnel_sessions
  where id = p_session_id
  for update;

  -- Reject a session already linked to another lead
  if v_session_lead_id is not null then
    raise exception 'Session already linked to a lead' using errcode = 'P0003';
  end if;

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
-- Revoke all execution from public / anon / authenticated
-- =============================================================================
revoke execute on function public.create_lead_from_funnel_session(
  uuid, text, text, text, text, text, text, text, text, text, text[], text, boolean, text, text, boolean, text
) from public, anon, authenticated;

-- =============================================================================
-- Grant execution only to service_role (dashboard user)
-- =============================================================================
grant execute on function public.create_lead_from_funnel_session(
  uuid, text, text, text, text, text, text, text, text, text, text[], text, boolean, text, text, boolean, text
) to service_role;
