# Funnel UI Core

## Page Flow

The funnel is a single-page application with seven sections rendered vertically:

1. **Hero** — Always visible. CTA scrolls to the pool diagnostic.
2. **Video Testimonials** — Always visible. Placeholder state.
3. **How It Works** — Always visible. Three-step explainer.
4. **Pool Diagnostic** — Always visible. Multi-step wizard shown one question at a time.
5. **Contact Information** — Visible after all diagnostic questions are answered.
6. **Booking** — Visible after contact is successfully submitted. Placeholder only.
7. **Confirmation** — Always visible (final section on page).

Navigation within the diagnostic uses next/back controls. All other sections are scrolled to via `scrollIntoView` with smooth animation.

## State Model

State lives in a single `useReducer` in `src/lib/funnel/funnel-context.tsx`.

```typescript
interface FunnelState {
  current_step: FunnelStepId;
  session_id: string | null;
  lead_id: string | null;
  diagnostic_answers: DiagnosticAnswers;
  completed_steps: FunnelStepId[];
  submission_state: "idle" | "submitting" | "success" | "duplicate" | "error";
  validation_errors: Record<string, string>;
  diag_current_index: number;
}
```

Actions are defined in `src/lib/funnel/funnel-reducer.ts`. Key actions:

| Action | Effect |
|--------|--------|
| `GO_TO_STEP` | Sets `current_step` for scroll targets |
| `SET_SESSION` | Stores session ID from server |
| `ANSWER_SINGLE` | Replaces single-select answer |
| `ANSWER_MULTI_TOGGLE` | Toggles multi-select answer |
| `DIAG_NEXT` / `DIAG_BACK` | Advances diagnostic question index |
| `CONTACT_SUBMIT_START` | Sets submitting state, clears errors |
| `CONTACT_SUBMIT_SUCCESS` | Stores lead_id, sets success |
| `CONTACT_SUBMIT_DUPLICATE` | Shows duplicate notification |
| `CONTACT_SUBMIT_ERROR` | Shows error state |
| `SET_VALIDATION_ERRORS` | Stores per-field error messages |

## Local Persistence

All funnel progress survives page refresh via `localStorage`:

| Key | Content |
|-----|---------|
| `fusion44x_anonymous_id` | Stable browser fingerprint for session reuse |
| `fusion44x_session_id` | Server-returned session UUID |
| `fusion44x_diagnostic_answers` | JSON-serialized `DiagnosticAnswers` |
| `fusion44x_diag_index` | Current question index number |

Persistence module: `src/lib/funnel/persistence.ts`
- All reads/writes are wrapped in try/catch — failure is silent.
- `generateAnonymousId()` reuses an existing ID if present.

## Event Tracking Behavior

A browser tracker client at `src/lib/analytics/tracker.ts` sends events to `POST /api/funnel-events`:

- Uses `navigator.sendBeacon` when available (page unload safe).
- Falls back to `fetch` with `keepalive: true`.
- Failures are silent — no error propagation to UI.
- In development mode events are logged to `console.info`.

### Tracked Events

| Event | Trigger | Fields |
|-------|---------|--------|
| `page_viewed` | First page load (after session init) | `step_id` |
| `hero_cta_clicked` | Hero CTA clicked | `step_id` |
| `diagnostic_started` | Diagnostic section rendered | `step_id` |
| `question_viewed` | Question displayed | `step_id`, `question_id` |
| `question_answered` | Option selected | `step_id`, `question_id`, `answer_code` |
| `question_changed` | Single-select answer replaced | `step_id`, `question_id`, `answer_code` |
| `validation_error` | Contact form validation fails | `step_id`, `metadata.fields` |
| `diagnostic_completed` | "See My Results" clicked | `step_id`, `metadata` (counts) |
| `contact_step_viewed` | Contact section becomes visible | `step_id` |
| `contact_submitted` | Contact form submitted | `step_id` |

Events never include PII. Answer codes are sent as `answer_code`, not in metadata.

## Endpoint Usage

| Endpoint | Called From | Purpose |
|----------|-------------|---------|
| `POST /api/funnel-sessions` | `session.ts` on page load | Create/reuse session |
| `POST /api/funnel-events` | `tracker.ts` on each event | Append-only event logging |
| `POST /api/leads` | `api.ts` on form submit | Create lead and link to session |

All calls use the `service_role` key server-side; the browser never sees secrets.

## Error Handling

### Network failures
- Session init: returns null, page still renders without tracking.
- Event tracking: silent failure (sendBeacon/fetch catch).
- Lead submission: shows generic error message, no raw errors exposed.

### Duplicate submission (409)
- Detected by `POST /api/leads` returning 409.
- UI shows "Already Submitted" message instead of form.
- No duplicate lead is created.

### Validation errors
- Client-side Zod validation shown inline on form fields.
- Consent requirement enforced client-side and server-side.
- Server errors are not exposed to the browser.

### 422 validation
- API returns 422 with generic message; logged with `requestId` server-side.

## What Remains Unimplemented

- **Booking calendar** — `BookingPlaceholder` shows dashed placeholder.
- **Meta CAPI** — `src/lib/meta/index.ts` throws "not implemented".
- **Email notifications** — `src/lib/email/index.ts` throws "not implemented".
- **Google Calendar adapter** — `src/lib/booking/index.ts` throws "not implemented".
- **Meta browser pixel** — no `fbq` integration.
- **Hero/video content** — no actual video player; placeholder only.
- **UTM and attribution capture** — session init supports it but no UI.
- **Production media and branding** — placeholder styling only.
- **Admin views and reporting** — not started.

## File Index

### Library
| File | Purpose |
|------|---------|
| `src/lib/funnel/funnel-reducer.ts` | State reducer and action types |
| `src/lib/funnel/funnel-context.tsx` | React context provider and hook |
| `src/lib/funnel/persistence.ts` | localStorage read/write helpers |
| `src/lib/funnel/session.ts` | Session initialization API call |
| `src/lib/funnel/api.ts` | Lead submission API and payload builder |
| `src/lib/funnel/contact-validation.ts` | Zod schema + validator for contact form |
| `src/lib/analytics/tracker.ts` | Browser event tracking client |

### UI Components
| File | Purpose |
|------|---------|
| `src/components/ui/section-container.tsx` | Wrapper with background/width/labelling |
| `src/components/ui/cta-button.tsx` | Button with variants, loading state |
| `src/components/ui/progress-indicator.tsx` | Progress bar with aria attributes |
| `src/components/ui/question-card.tsx` | Diagnostic question card wrapper |
| `src/components/ui/answer-option.tsx` | Single/multi select radio/checkbox button |
| `src/components/ui/text-input.tsx` | Labelled input with error state |
| `src/components/ui/checkbox.tsx` | Checkbox with label and error state |
| `src/components/ui/error-message.tsx` | Alert role error banner |
| `src/components/ui/loading-state.tsx` | Spinner with message |

### Sections
| File | Purpose |
|------|---------|
| `src/components/sections/hero-section.tsx` | Hero with CTA, dark background |
| `src/components/sections/video-testimonials-section.tsx` | Video placeholder |
| `src/components/sections/how-it-works-section.tsx` | Three-step explainer |
| `src/components/sections/pool-diagnostic-section.tsx` | Question-by-question wizard |
| `src/components/sections/contact-section.tsx` | Contact form with validation |
| `src/components/sections/booking-placeholder.tsx` | Booking placeholder, shown after contact |
| `src/components/sections/confirmation-placeholder.tsx` | Final confirmation section |
