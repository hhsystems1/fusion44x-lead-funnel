-- Migration: 20260812000100_drop_contact_submitted_event
-- Removes 'contact_submitted' from the funnel_events event-name whitelist.
--
-- The internal "contact_submitted" event was retired: successful submissions
-- are now tracked exclusively by the "lead_created" event, which the
-- create_lead_from_funnel_session / create_lead_from_popup RPCs insert
-- server-side after a lead row is actually created.
--
-- Historical rows keep their values; only new inserts are affected.
--
-- This migration is NOT applied automatically. See docs/database-schema.md.

alter table public.funnel_events
  drop constraint funnel_events_event_name_check;

alter table public.funnel_events
  add constraint funnel_events_event_name_check
    check (event_name in (
      'page_viewed',
      'hero_cta_clicked',
      'hero_video_opened',
      'hero_video_started',
      'hero_video_completed',
      'testimonials_viewed',
      'testimonial_started',
      'testimonial_completed',
      'diagnostic_started',
      'question_viewed',
      'question_answered',
      'question_changed',
      'validation_error',
      'diagnostic_completed',
      'contact_step_viewed',
      'lead_created',
      'calendar_viewed',
      'time_slot_selected',
      'booking_started',
      'booking_completed',
      'booking_failed',
      'add_to_calendar_clicked',
      'confirmation_viewed',
      'session_inactive',
      'page_hidden',
      'page_exit_attempted'
    ));