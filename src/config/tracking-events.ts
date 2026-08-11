// =============================================================================
// Internal (Supabase) Event Names
// =============================================================================
// These events are stored in Supabase for detailed funnel analytics.
// Question answers must never be forwarded to Meta.

export const InternalEvents = {
  PAGE_VIEWED: "page_viewed",
  HERO_CTA_CLICKED: "hero_cta_clicked",
  HERO_VIDEO_OPENED: "hero_video_opened",
  HERO_VIDEO_STARTED: "hero_video_started",
  HERO_VIDEO_COMPLETED: "hero_video_completed",
  TESTIMONIALS_VIEWED: "testimonials_viewed",
  TESTIMONIAL_STARTED: "testimonial_started",
  TESTIMONIAL_COMPLETED: "testimonial_completed",
  DIAGNOSTIC_STARTED: "diagnostic_started",
  QUESTION_VIEWED: "question_viewed",
  QUESTION_ANSWERED: "question_answered",
  QUESTION_CHANGED: "question_changed",
  VALIDATION_ERROR: "validation_error",
  DIAGNOSTIC_COMPLETED: "diagnostic_completed",
  CONTACT_STEP_VIEWED: "contact_step_viewed",
  CONTACT_SUBMITTED: "contact_submitted",
  CONTACT_SUBMIT_FAILED: "contact_submit_failed",
  LEAD_CREATED: "lead_created",
  CALENDAR_VIEWED: "calendar_viewed",
  TIME_SLOT_SELECTED: "time_slot_selected",
  BOOKING_STARTED: "booking_started",
  BOOKING_COMPLETED: "booking_completed",
  BOOKING_FAILED: "booking_failed",
  ADD_TO_CALENDAR_CLICKED: "add_to_calendar_clicked",
  CONFIRMATION_VIEWED: "confirmation_viewed",
  SESSION_INACTIVE: "session_inactive",
  PAGE_HIDDEN: "page_hidden",
  PAGE_EXIT_ATTEMPTED: "page_exit_attempted",
} as const;

export type InternalEventName =
  (typeof InternalEvents)[keyof typeof InternalEvents];

export const ALL_INTERNAL_EVENT_NAMES: InternalEventName[] =
  Object.values(InternalEvents) as InternalEventName[];

// =============================================================================
// Meta Conversions API Event Names
// =============================================================================
// Only high-value conversion events are sent to Meta.
// Question answers must never appear in Meta event parameters.

export const MetaEvents = {
  CONTACT: "Contact",
  LEAD: "Lead",
  SCHEDULE: "Schedule",
} as const;

export type MetaEventName = (typeof MetaEvents)[keyof typeof MetaEvents];

export const ALL_META_EVENT_NAMES: MetaEventName[] = Object.values(
  MetaEvents,
) as MetaEventName[];
