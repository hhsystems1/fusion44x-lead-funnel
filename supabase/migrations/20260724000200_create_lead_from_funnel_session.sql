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
-- Security:
--   - SECURITY DEFINER ensures execution with owner privileges
--   - search_path is set to public for secure resolution
--   - EXECUTE is revoked from public/anon/authenticated
--   - EXECUTE is granted only to service_role
--   - Uses parameterized PL/pgSQL (no dynamic SQL)
-- =============================================================================

create or replace function public.create_lead_from_funnel_session(
  p_session_id            uuid,
  p_first_name            text,
  p_last_name             text,
  p_email                 text,
  p_phone                 text,
  p_zip_code              text,
  p_preferred_contact_method text default null,
  p_water_feature         text,
  p_installation_type     text,
  p_pool_size             text,
  p_current_treatment     text,
  p_current_issues        text[],
  p_primary_goal          text,
  p_consent_to_contact    boolean,
  p_marketing_consent     boolean default false,
  p_consent_text_version  text,
  p_source                text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_id    uuid;
  v_issue_text text;
begin
  -- Validate the session exists
  if not exists (select 1 from public.funnel_sessions where id = p_session_id) then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  -- Reject a session already linked to another lead
  if exists (select 1 from public.funnel_sessions where id = p_session_id and lead_id is not null) then
    raise exception 'Session already linked to a lead' using errcode = 'P0003';
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
    case when p_consent_to_contact then now() else null end,
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
  for v_issue_text in select unnest(p_current_issues) loop
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
    coalesce(
      (select page_version from public.funnel_sessions where id = p_session_id),
      'unknown'
    )
  );

  return v_lead_id;
end;
$$;

-- =============================================================================
-- Revoke all execution from public / anon / authenticated
-- =============================================================================
revoke execute on function public.create_lead_from_funnel_session(
  uuid, text, text, text, text, text, text, text, text, text, text, text[], text, boolean, boolean, text, text
) from public, anon, authenticated;

-- =============================================================================
-- Grant execution only to service_role (dashboard user)
-- =============================================================================
grant execute on function public.create_lead_from_funnel_session(
  uuid, text, text, text, text, text, text, text, text, text, text, text[], text, boolean, boolean, text, text
) to service_role;
