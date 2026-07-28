-- =============================================================================
-- Dashboard: Add browser column, dashboard-optimized indexes
-- =============================================================================
-- Adds browser detection column to funnel_sessions for dashboard display.
-- Adds composite indexes optimized for dashboard query patterns.
-- All operations are idempotent (IF NOT EXISTS).

BEGIN;

-- Add browser column for dashboard display
ALTER TABLE public.funnel_sessions
  ADD COLUMN IF NOT EXISTS browser text;

-- Index for funnel_events by session_id and occurred_at (already exists as idx_funnel_events_session_occurred)
-- Index for events by name and date range (already exists as idx_funnel_events_name_occurred)

-- Dashboard query indexes: sessions by date range and status
CREATE INDEX IF NOT EXISTS idx_funnel_sessions_started_at
  ON public.funnel_sessions (started_at);

CREATE INDEX IF NOT EXISTS idx_funnel_sessions_anonymous_id
  ON public.funnel_sessions (anonymous_id);

-- Leads by date range
CREATE INDEX IF NOT EXISTS idx_leads_created_at
  ON public.leads (created_at);

-- Appointments by date range
CREATE INDEX IF NOT EXISTS idx_appointments_start_time
  ON public.appointments (start_time);

-- Integration deliveries by appointment_id for dashboard health view
CREATE INDEX IF NOT EXISTS idx_integration_deliveries_appointment_id
  ON public.integration_deliveries (appointment_id);

-- Funnel events count queries by session
CREATE INDEX IF NOT EXISTS idx_funnel_events_event_name_session
  ON public.funnel_events (event_name, session_id);

COMMIT;
