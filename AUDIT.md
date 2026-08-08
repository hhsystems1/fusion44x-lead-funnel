# Fusion 44X Lead Funnel — External Architecture Technical Audit

**Repository:** `hhsystems1/fusion44x-lead-funnel`  
**Branch audited:** `main`  
**Snapshot commit/tree:** `41e9ef13c71bdc550921bb074af3b3c0d5edc87d`  
**Audit generated:** 2026-08-08  
**Purpose:** external architecture review  

> **Redaction statement:** No secret values are included in this audit. Environment variables are listed by name only. The audited source references credentials through environment-variable names; no live credentials were observed in the requested source files.
>
> **Migration-state caveat:** This audit reconstructs the database state obtained by applying the repository's migration files in filename order. Several migration comments explicitly say they are “NOT applied automatically.” Without direct access to the live Supabase database, this document cannot independently prove that every repository migration has been applied to production.
>
> **Source-state caveat:** `src/lib/funnel/funnel-context.tsx` is reproduced exactly as retrieved from `main`. It appears structurally malformed: `interface FunnelContextValue {` is immediately followed by executable `try { ... }` code, and later hooks/functions appear without the expected surrounding provider declarations. This is treated as an observed source condition, not silently repaired in this audit.

## Executive architecture findings

1. **Likely build-blocking source corruption in `src/lib/funnel/funnel-context.tsx`.** The file, as present on `main`, opens `interface FunnelContextValue {` and then enters executable lead-submission code. The expected interface fields/provider setup are not present before hook usage. This should be validated with `npm run typecheck` / `npm run build` immediately.
2. **Booking failure can poison lead/session state.** `create_funnel_appointment` changes `leads.status` to `scheduled`, changes `funnel_sessions.status` to `booked`, and writes `booking_completed` before the Google Calendar event is created. If Google Calendar creation or later DB confirmation fails, `fail_funnel_appointment` only changes the appointment to `failed`; it does not revert the lead/session. A retry can then be rejected as “already booked/scheduled,” while analytics already contains `booking_completed`.
3. **Email delivery SECURITY DEFINER RPCs are materially weaker than the lead/booking RPCs.** `claim_email_delivery`, `mark_email_delivery_delivered`, and `mark_email_delivery_failed` are `SECURITY DEFINER`, but the migration does not revoke default execute privileges from `public`, `anon`, and `authenticated`, and does not lock `search_path`. The lead/booking RPC migrations explicitly do both. This should be treated as a high-priority database security review item.
4. **Tracking schema/config drift exists.** `src/config/tracking-events.ts` includes `contact_submit_failed`, but the original `funnel_events_event_name_check` migration does not. Attempts to persist that event can therefore fail at the database constraint. `docs/tracking-plan.md` also says there are 27 events and hashing is not implemented, while code currently defines 28 events and implements hashing.
5. **Anonymous session identity prevents true returning-session analytics.** `anonymous_id` is stored in `localStorage`, while `funnel_sessions.anonymous_id` is `UNIQUE`. A new browser session using the same anonymous ID receives the old database session instead of creating a new visit. This conflicts with the “one anonymous funnel visit” model and makes the dashboard's returning-session logic ineffective.
6. **`last_seen_at`/abandonment semantics are incomplete.** There is no heartbeat/update path that advances `last_seen_at` on normal activity. The dashboard labels old `active` sessions as abandoned using this field, so abandonment can be inaccurate.
7. **Meta CAPI delivery is best-effort with no durable delivery record/retry.** Both Contact and Schedule CAPI calls are initiated without being awaited by their route handlers, and failures are swallowed. In serverless runtimes the request may finish before the outbound work completes. `integration_deliveries` supports destination `meta`, but current Meta code does not use it.
8. **Contact-submission internal email appears broken.** `sendContactSubmissionInternalNotification` supplies empty start/end timestamps, but `renderInternalBookingNotificationHtml/Text` formats those timestamps before checking `notificationType`. Invalid dates can throw and the caller suppresses the error, causing the notification to disappear silently.
9. **Email configuration is inconsistent.** Full lead submission directly calls `createResendEmailProvider()` regardless of `EMAIL_PROVIDER`, while booking uses `getEmailProvider()`. Customer booking emails pass the hard-coded `EMAIL_CONFIG.REPLY_TO_PLACEHOLDER`, which takes precedence over `EMAIL_REPLY_TO`. `EMAIL_CONFIG.SUPPORT_PHONE` is a `555` placeholder while public site content uses `775-600-5305`.
10. **Unauthenticated metrics endpoint.** `/api/metrics` permits unauthenticated POST of arbitrary metric names/labels and unauthenticated GET of the Prometheus text. The in-memory fallback can grow with arbitrary metric/cardinality input. Additionally, the route does not await the async `getPrometheusText()` call before constructing `NextResponse`.
11. **Rate limiting is process-local only.** Public APIs and admin login use in-memory `Map` rate limits. They reset on cold starts and are not shared across serverless instances.
12. **Popup-to-full-funnel upgrade has stale-field behavior.** Upgrading an `exit_popup` lead updates phone/ZIP/preferred contact and diagnostic fields, but does not refresh first name, last name, email, source, consent timestamps, or marketing consent. Repeated popup submission also returns the existing popup lead without updating it.
13. **Observability/source-of-truth comments are stale in places.** `src/lib/admin/queries.ts` says data is validated by existing RLS policies, but repository migrations define no RLS policies; the server client uses `service_role` and bypasses RLS.

---

# 1. Full file tree

Excluded per request: `node_modules/`, `.next/`, `package-lock.json`, `pnpm-lock.yaml` and other lock files. `AUDIT.md` itself is not shown because the tree below is the audited snapshot before this file was added.

```text
.
├── .env.example
├── .gitignore
├── AGENTS.md
├── CLAUDE.md
├── README.md
├── docs
│   ├── architecture.md
│   ├── custom-booking.md
│   ├── database-schema.md
│   ├── email-notifications.md
│   ├── funnel-ui-core.md
│   ├── google-calendar-integration.md
│   ├── preview-content-checklist.md
│   ├── security-boundaries.md
│   ├── server-data-layer.md
│   └── tracking-plan.md
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── public
│   └── brand
│       ├── fusion44x-favicon.png
│       ├── fusion44x-logo.png
│       ├── hero-loop-video.mp4
│       ├── how-it-works-edited.png
│       ├── how-it-works-new-image.png
│       └── product-image.png
├── scripts
│   ├── test-google-calendar.mjs
│   └── test-resend-email.mjs
├── src
│   ├── app
│   │   ├── admin
│   │   │   ├── (protected)
│   │   │   │   ├── appointments
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── date-filter.tsx
│   │   │   │   ├── funnel
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── integration-health
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── leads
│   │   │   │   │   ├── [id]
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── logout-button.tsx
│   │   │   │   ├── metric-card.tsx
│   │   │   │   ├── overview
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── sessions
│   │   │   │   │   ├── [id]
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── page.tsx
│   │   │   │   └── utils.ts
│   │   │   ├── login
│   │   │   │   ├── layout.tsx
│   │   │   │   └── page.tsx
│   │   │   └── page.tsx
│   │   ├── api
│   │   │   ├── admin
│   │   │   │   ├── appointments
│   │   │   │   │   └── [id]
│   │   │   │   │       └── route.ts
│   │   │   │   ├── auth
│   │   │   │   │   └── route.ts
│   │   │   │   ├── export
│   │   │   │   │   └── route.ts
│   │   │   │   ├── leads
│   │   │   │   │   └── [id]
│   │   │   │   │       └── route.ts
│   │   │   │   └── logout
│   │   │   │       └── route.ts
│   │   │   ├── availability
│   │   │   │   ├── .gitkeep
│   │   │   │   └── route.ts
│   │   │   ├── bookings
│   │   │   │   ├── .gitkeep
│   │   │   │   └── route.ts
│   │   │   ├── exit-popup
│   │   │   │   └── route.ts
│   │   │   ├── funnel-events
│   │   │   │   ├── .gitkeep
│   │   │   │   └── route.ts
│   │   │   ├── funnel-sessions
│   │   │   │   └── route.ts
│   │   │   ├── leads
│   │   │   │   ├── .gitkeep
│   │   │   │   └── route.ts
│   │   │   ├── meta-events
│   │   │   │   └── .gitkeep
│   │   │   ├── metrics
│   │   │   │   └── route.ts
│   │   │   └── webhooks
│   │   │       └── .gitkeep
│   │   ├── apple-icon.png
│   │   ├── globals.css
│   │   ├── icon.png
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components
│   │   ├── admin
│   │   │   ├── appointment-stage-select.tsx
│   │   │   ├── lead-stage-select.tsx
│   │   │   └── tag-pill.tsx
│   │   ├── booking
│   │   │   ├── .gitkeep
│   │   │   ├── booking-section.tsx
│   │   │   ├── date-picker.tsx
│   │   │   ├── review-confirm.tsx
│   │   │   └── time-slots.tsx
│   │   ├── exit-popup
│   │   │   └── exit-popup.tsx
│   │   ├── forms
│   │   │   └── .gitkeep
│   │   ├── funnel
│   │   │   └── funnel-experience.tsx
│   │   ├── layout
│   │   │   └── .gitkeep
│   │   ├── media
│   │   │   └── .gitkeep
│   │   ├── meta-pixel.tsx
│   │   ├── sections
│   │   │   ├── .gitkeep
│   │   │   ├── confirmation-stage.tsx
│   │   │   ├── contact-section.tsx
│   │   │   ├── faq-section.tsx
│   │   │   ├── footer.tsx
│   │   │   ├── header.tsx
│   │   │   ├── hero-section.tsx
│   │   │   ├── how-fusion44x-works-section.tsx
│   │   │   ├── how-it-works-modal.tsx
│   │   │   ├── next-step-section.tsx
│   │   │   ├── pool-diagnostic-section.tsx
│   │   │   ├── problem-cycle-section.tsx
│   │   │   ├── proof-bar.tsx
│   │   │   ├── solution-section.tsx
│   │   │   ├── sticky-assessment-bar.tsx
│   │   │   └── testimonials-section.tsx
│   │   └── ui
│   │       ├── .gitkeep
│   │       ├── answer-option.tsx
│   │       ├── asset-placeholder.tsx
│   │       ├── checkbox.tsx
│   │       ├── cta-button.tsx
│   │       ├── error-message.tsx
│   │       ├── loading-state.tsx
│   │       ├── logo.tsx
│   │       ├── progress-indicator.tsx
│   │       ├── question-card.tsx
│   │       ├── section-container.tsx
│   │       └── text-input.tsx
│   ├── config
│   │   ├── assets.ts
│   │   ├── booking.ts
│   │   ├── email.ts
│   │   ├── faq.ts
│   │   ├── funnel-questions.ts
│   │   ├── site-content.ts
│   │   └── tracking-events.ts
│   ├── lib
│   │   ├── admin
│   │   │   ├── auth.ts
│   │   │   ├── queries.ts
│   │   │   └── stages.ts
│   │   ├── analytics
│   │   │   ├── index.ts
│   │   │   └── tracker.ts
│   │   ├── booking
│   │   │   ├── calendar-links.ts
│   │   │   ├── create-booking.ts
│   │   │   ├── index.ts
│   │   │   ├── integration-delivery.ts
│   │   │   ├── providers
│   │   │   │   ├── google
│   │   │   │   │   ├── client.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── index.ts
│   │   │   │   └── types.ts
│   │   │   └── slots.ts
│   │   ├── email
│   │   │   ├── delivery.ts
│   │   │   ├── index.ts
│   │   │   ├── internal-delivery.ts
│   │   │   ├── internal-notifications.ts
│   │   │   ├── internal-retry.ts
│   │   │   ├── internal-send-input.ts
│   │   │   ├── notifications.ts
│   │   │   ├── provider
│   │   │   │   ├── fake-provider.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── provider-factory.ts
│   │   │   │   ├── resend-provider.ts
│   │   │   │   └── types.ts
│   │   │   ├── retry.ts
│   │   │   ├── send-input.ts
│   │   │   └── templates
│   │   │       ├── booking-confirmation.ts
│   │   │       └── internal-booking-notification.ts
│   │   ├── env.ts
│   │   ├── funnel
│   │   │   ├── answer-labels.ts
│   │   │   ├── api.ts
│   │   │   ├── booking-api.ts
│   │   │   ├── contact-validation.ts
│   │   │   ├── funnel-context-test.tsx
│   │   │   ├── funnel-context.tsx
│   │   │   ├── funnel-reducer.ts
│   │   │   ├── persistence.ts
│   │   │   ├── session.ts
│   │   │   └── source.ts
│   │   ├── meta
│   │   │   ├── contact-event.ts
│   │   │   ├── hash.ts
│   │   │   └── index.ts
│   │   ├── metrics
│   │   │   └── index.ts
│   │   ├── security
│   │   │   └── index.ts
│   │   ├── server
│   │   │   ├── booking-rpc-errors.ts
│   │   │   ├── lead-rpc-errors.ts
│   │   │   └── request-protection.ts
│   │   ├── supabase
│   │   │   ├── index.ts
│   │   │   └── server.ts
│   │   └── validation
│   │       ├── api-schemas.ts
│   │       ├── index.ts
│   │       └── schemas.ts
│   ├── middleware.ts
│   └── types
│       ├── appointment.ts
│       ├── funnel.ts
│       ├── global.d.ts
│       ├── lead.ts
│       └── tracking.ts
├── supabase
│   ├── functions
│   │   ├── booking-notifications
│   │   │   └── .gitkeep
│   │   └── meta-conversions
│   │       └── .gitkeep
│   └── migrations
│       ├── .gitkeep
│       ├── 20260724000100_initial_funnel_schema.sql
│       ├── 20260724000200_create_lead_from_funnel_session.sql
│       ├── 20260724000300_create_funnel_appointment.sql
│       ├── 20260724000400_confirm_funnel_appointment.sql
│       ├── 20260724000500_email_notification_delivery_columns.sql
│       ├── 20260725000100_internal_booking_notification_delivery.sql
│       ├── 20260727000100_add_appointment_create_event_type.sql
│       ├── 20260728000100_dashboard_indexes_and_browser.sql
│       └── 20260731000100_exit_popup_and_lead_stages.sql
├── tests
│   ├── e2e
│   │   └── .gitkeep
│   ├── integration
│   │   └── .gitkeep
│   └── unit
│       ├── .gitkeep
│       ├── admin-auth.test.ts
│       ├── admin-csv-export.test.ts
│       ├── admin-date-range.test.ts
│       ├── admin-middleware.test.ts
│       ├── admin-migration.test.ts
│       ├── admin-security.test.ts
│       ├── admin-stages.test.ts
│       ├── admin-utils.test.ts
│       ├── answer-labels.test.ts
│       ├── booking-errors.test.ts
│       ├── booking-idempotency.test.ts
│       ├── booking-reducer.test.ts
│       ├── booking-rpc-errors.test.ts
│       ├── booking-slots.test.ts
│       ├── calendar-links.test.ts
│       ├── contact-validation.test.ts
│       ├── email-notifications.test.ts
│       ├── escape-html.test.ts
│       ├── exit-popup-migration.test.ts
│       ├── exit-popup.test.ts
│       ├── faq-config.test.ts
│       ├── funnel-api.test.ts
│       ├── funnel-config.test.ts
│       ├── funnel-reducer.test.ts
│       ├── funnel-visibility.test.ts
│       ├── google-calendar.test.ts
│       ├── internal-notification-migration.test.ts
│       ├── meta-capi.test.ts
│       ├── meta-hash.test.ts
│       ├── page-structure.test.ts
│       ├── persistence.test.ts
│       ├── resend-provider.test.ts
│       ├── server-data-layer.test.ts
│       ├── session.test.ts
│       ├── source-derivation.test.ts
│       ├── tracker-payload.test.ts
│       ├── tracker.test.ts
│       ├── tracking-events.test.ts
│       └── validation-schemas.test.ts
├── tsconfig.json
├── vitest.config.ts
└── vitest.setup.ts
```

---

# 2. Requested file contents

## `package.json`

```json
{
  "name": "fusion44x-lead-funnel",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.110.8",
    "date-fns": "^4.4.0",
    "date-fns-tz": "^3.2.0",
    "googleapis": "^173.0.0",
    "lucide-react": "^1.27.0",
    "next": "16.2.11",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "resend": "^6.18.0",
    "server-only": "^0.0.1",
    "zod": "^4.4.3",
    "prom-client": "^15.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.11",
    "playwright": "^1.62.0",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^4.1.10"
  }
}
```

## `src/config/`

### `src/config/assets.ts`

```ts
export const assets = {
  logo: {
    src: "/brand/fusion44x-logo.png",
    alt: "Fusion44X",
    placeholder: "Fusion44X Logo",
  },
  favicon: {
    src: "/brand/fusion44x-favicon.png",
  },
  hero_image: {
    src: "/brand/product-image.png",
    alt: "Fusion44X pool water treatment system",
    placeholder: "Hero Product Image",
  },
  hero_video: {
    src: "/brand/hero-loop-video.mp4",
    placeholder: "Hero Video",
  },
  product_photo: {
    src: "/brand/product-image.png",
    alt: "Fusion44X Hydro-pH-Infusion system",
    placeholder: "Fusion44X Product Photo",
  },
  how_it_works_video: {
    src: null,
    placeholder: "How It Works Video Coming Soon",
  },
  how_it_works_diagram: {
    src: "/brand/how-it-works-new-image.png",
    alt: "Fusion44X Hydro-pH-Infusion system diagram with numbered part callouts",
  },
  testimonial_videos: [
    {
      src: "1071565091",
      thumbnail:
        "https://i.vimeocdn.com/video/2000312141-f5f2522d5cd2e412e19feeb8da2396226fe2ec140f7385056bba31734d88120a-d_640?region=us",
      customer_name: null,
      caption: "Carlos, Miami Beach",
      placeholder: "Customer Story Video Placeholder",
    },
    {
      src: "1079914507",
      thumbnail:
        "https://i.vimeocdn.com/video/2010396448-1d8c70cd2edf046a24732cf822107a1ee6cd178f5161ab16aa9aaa28d59c9d11-d_640?region=us",
      customer_name: null,
      caption: "Bryan, Arizona",
      placeholder: "Customer Story Video Placeholder",
    },
    {
      src: "1077748658",
      thumbnail:
        "https://i.vimeocdn.com/video/2007836280-7bcf052dbdac6f6eee1254a6bb6ef4002e901d53be4a749276f160c1f08b99dc-d_640?region=us",
      customer_name: null,
      caption: "Geoff, California",
      placeholder: "Customer Story Video Placeholder",
    },
  ],
  og_image: {
    src: null,
    alt: "Fusion44X — Cleaner Pool Water Without the Chemical Cycle",
    placeholder: "Social Share Image",
  },
} as const;

export type AssetKey = keyof typeof assets;
```

### `src/config/booking.ts`

```ts
// =============================================================================
// Booking Configuration
// =============================================================================
// All booking settings are defined here — never duplicate these values
// across components, API routes, or tests.

export const BOOKING = {
  APPOINTMENT_DURATION_MINUTES: 30,
  SLOT_INTERVAL_MINUTES: 30,
  TIMEZONE: "America/New_York",
  MINIMUM_NOTICE_HOURS: 2,
  BOOKING_WINDOW_DAYS: 30,
  PAGE_VERSION: "0.1.0",
  BUFFER_BEFORE_MINUTES: 0,
  BUFFER_AFTER_MINUTES: 0,
} as const;

export const WORKING_HOURS: { start: number; end: number } = {
  start: 9,
  end: 17,
};

export const WORKING_DAYS: number[] = [1, 2, 3, 4, 5];

export const BLOCKED_DATES: string[] = [
  // Add blocked dates as 'YYYY-MM-DD' strings
  // Example: "2026-12-25",
  // Example: "2027-01-01",
];
```

### `src/config/email.ts`

```ts
import "server-only";

export const EMAIL_CONFIG = {
  SENDER_NAME: "Fusion 44X",
  REPLY_TO_PLACEHOLDER: "support@fusion44x.com",
  CONSULTATION_TITLE: "Fusion 44X Pool Consultation",
  TIMEZONE: "America/New_York",
  COMPANY_NAME: "Fusion 44X",
  SUPPORT_PHONE: "(555) 123-4567",
  TEMPLATE_VERSION: "1.0.0",
} as const;
```

### `src/config/faq.ts`

```ts
export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  /** Used for items needing approval before publish. */
  pendingApproval?: boolean;
}

export const faqItems: FaqItem[] = [
  {
    id: "what-is-fusion-44x",
    question: "What is Fusion44X?",
    answer:
      "Fusion44X is a hardware-based pool and spa water-treatment system that uses Hydro-pH-Infusion technology to create hydrogen-rich, balanced water in compatible pools and spas.",
  },
  {
    id: "is-it-a-chemical",
    question: "Is Fusion44X another pool chemical?",
    answer:
      "No. Fusion44X is not a chemical that is poured into the water. It is a hardware system installed as part of a compatible pool or spa setup.",
  },
  {
    id: "why-families-choose",
    question: "Why do families choose Fusion44X?",
    answer:
      "Many pool owners are looking for water that is clean, balanced, and better suited for the people they care about. Fusion44X offers an alternative to the traditional chlorine, salt, and weekly chemical cycle.",
  },
  {
    id: "existing-equipment",
    question: "Does Fusion44X work with existing pool equipment?",
    answer:
      "Fusion44X is designed to retrofit onto many existing pool and spa systems. Compatibility depends on your equipment, installation, pool size, and current setup.",
  },
  {
    id: "chlorine-or-salt",
    question: "Does Fusion44X use chlorine or salt?",
    answer:
      "Fusion44X is designed as a zero-chlorine and zero-salt water-treatment system for compatible installations. Your pool setup should be reviewed before installation.",
  },
  {
    id: "who-can-install",
    question: "Who can install Fusion44X?",
    answer:
      "Depending on the setup, Fusion44X may be installed by the homeowner or a local pool technician. Direct manufacturer support is available during installation.",
  },
  {
    id: "eliminate-every-task",
    question: "Does Fusion44X eliminate every pool-maintenance task?",
    answer:
      "No pool system removes every maintenance responsibility. Fusion44X is designed to reduce dependence on the traditional chemical cycle, but normal cleaning, monitoring, and installation-specific care may still be required.",
  },
  {
    id: "right-for-my-pool",
    question: "How do I know which Fusion44X system I need?",
    answer:
      "Complete the free pool assessment. The Fusion44X team will review your pool type, current equipment, size, and primary concerns before recommending the appropriate next step.",
  },
  {
    id: "what-happens-consultation",
    question: "What happens during the consultation?",
    answer:
      "A Fusion44X specialist will review your pool setup, discuss your concerns, explain compatibility, and answer your questions. There is no obligation to purchase.",
  },
];
```

### `src/config/funnel-questions.ts`

```ts
import type { DiagnosticQuestion } from "@/types/funnel";

export const diagnosticQuestions: DiagnosticQuestion[] = [
  {
    id: "water-feature",
    type: "single-select",
    required: true,
    title: "What type of setup do you have?",
    options: [
      { code: "pool", label: "Pool only" },
      { code: "spa", label: "Spa only" },
      { code: "pool_and_spa", label: "Pool and spa" },
    ],
  },
  {
    id: "installation-type",
    type: "single-select",
    required: true,
    title: "How is your pool installed?",
    options: [
      { code: "in_ground", label: "In-ground" },
      { code: "above_ground", label: "Above ground" },
      { code: "not_sure", label: "I’m not sure" },
    ],
  },
  {
    id: "current-treatment",
    type: "single-select",
    required: true,
    title: "What system are you currently using?",
    options: [
      { code: "chlorine", label: "Chlorine" },
      { code: "salt", label: "Saltwater" },
      { code: "other", label: "Another system" },
      { code: "not_sure", label: "I’m not sure" },
    ],
  },
  {
    id: "primary-goal",
    type: "single-select",
    required: true,
    title:
      "What is the biggest reason you are looking into Fusion44X?",
    options: [
      {
        code: "family_confidence",
        label: "I want healthy, safe water for my family",
      },
      {
        code: "eliminate_chemicals",
        label:
          "I want to eliminate chlorine, salt, and harsh chemicals",
      },
      {
        code: "tired_of_balancing",
        label:
          "I am tired of constant chemical balancing",
      },
      {
        code: "algae_quality_problems",
        label:
          "I keep dealing with algae or water-quality problems",
      },
      {
        code: "simpler_routine",
        label: "I want a simpler pool-care routine",
      },
    ],
  },
  {
    id: "pool-size",
    type: "single-select",
    required: true,
    title: "How would you describe the size of your pool?",
    options: [
      { code: "small", label: "Small" },
      { code: "average", label: "Average size" },
      { code: "large", label: "Large" },
      { code: "not_sure", label: "I’m not sure" },
    ],
  },
  {
    id: "current-issues",
    type: "multi-select",
    required: true,
    title: "What issues are you currently experiencing?",
    subtitle: "Select all that apply.",
    options: [
      { code: "chemical_smell", label: "Strong chemical smell" },
      { code: "skin_eye_irritation", label: "Skin or eye irritation" },
      { code: "cloudy_water", label: "Cloudy or dull water" },
      { code: "algae", label: "Algae growth" },
      { code: "scaling_staining", label: "Scaling or staining" },
      { code: "frequent_adjustment", label: "Frequent chemical adjustment" },
      { code: "high_cost", label: "High chemical costs" },
      {
        code: "children_pet_concerns",
        label: "Concerns about children or pets",
      },
      { code: "other", label: "Other issues" },
    ],
  },
] as const;
```

### `src/config/site-content.ts`

```ts
export const siteContent = {
  company: {
    name: "Fusion44X",
    slogan: "Water Made Perfect",
    description: "A hardware-based water treatment system for pools and spas.",
  },
  seo: {
    title: "Fusion44X — Cleaner Pool Water Without the Chemical Cycle",
    description:
      "Fusion44X is a hardware-based Hydro-pH-Infusion system designed to create hydrogen-rich, balanced water in compatible pools and spas. Take our free pool assessment.",
    og_title: "Fusion44X — Cleaner Pool Water Without the Chemical Cycle",
    og_description:
      "Ready for pool water without the traditional chlorine and salt cycle? Take the free Fusion44X pool assessment and find out whether your setup is compatible.",
  },
  hero: {
    eyebrow: "Fusion44X Hydro-pH-Infusion System",
    heading:
      "Healthy, Safe Pool Water — Without the Traditional Chlorine and Salt Cycle",
    subheading:
      "Fusion44X is a hardware-based Hydro-pH-Infusion system designed to create hydrogen-rich, balanced water in compatible pools and spas with zero chlorine, zero salt, no harsh chemicals, and no traditional pool chemicals.",
    cta_primary: "Get Your Free Pool Assessment",
    cta_secondary: "See How Fusion44X Works",
  },
  proof_line: {
    customerCountVerified: false,
    verified_line: "Trusted by 1,000+ pool owners using Fusion44X",
    default_line:
      "Trusted by pool and spa owners looking for a different way to care for their water",
  },
  testimonials: {
    eyebrow: "Real Pool Owners. Real Experiences.",
    heading: "Why Families Choose Fusion44X",
    subheading:
      "Hear from pool and spa owners who wanted clean, balanced water for their families to enjoy.",
  },
  problem_cycle: {
    eyebrow: "The Real Concern",
    heading: "Pool Care Should Not Feel Like an Endless Chemical Cycle",
    subheading:
      "For many families, the concern is not only the work. It is constantly adding products while still questioning how the water feels and what their family is swimming in.",
    problems: [
      {
        heading: "Recurring Algae",
        text: "You treat the water, it clears temporarily, and the same problem returns.",
      },
      {
        heading: "Constant Chemical Balancing",
        text: "Testing, adding, waiting, and adjusting can become a never-ending routine.",
      },
      {
        heading: "Harsh-Feeling Water",
        text: "Strong smells, red eyes, and dry-feeling skin can make the pool less enjoyable.",
      },
      {
        heading: "Questions About What Is in the Water",
        text: "When children, family, and friends use the pool, it is natural to want greater peace of mind about the water.",
      },
    ],
    chemical_cycle_steps: ["Add", "Test", "Wait", "React", "Test Again"],
    chemical_examples: [
      "Chlorine",
      "Shock",
      "Acid",
      "Stabilizer",
      "Algaecide",
      "Clarifier",
    ],
    belief_line:
      "If the same water keeps needing one product after another, are you creating balance—or simply managing the next reaction?",
    cta: "Get Your Free Pool Assessment",
  },
  solution: {
    eyebrow: "What Is Fusion44X?",
    heading:
      "A Water System Designed for Families Who Want Healthy, Safe Pool Water",
    body: "Fusion44X is not another chemical to pour into your pool. It is a hardware-based Hydro-pH-Infusion system designed to create hydrogen-rich, balanced water throughout compatible pools and spas.",
    supporting:
      "Instead of relying on the traditional chlorine, salt, and weekly chemical cycle, Fusion44X works with compatible pool equipment to support a different way of treating the water.",
    benefits_heading: "Fusion44X May Be for You If You Want To…",
    benefits: [
      "Move away from chlorine",
      "Move away from saltwater chlorine generation",
      "Reduce the traditional chemical routine",
      "Enjoy clean, balanced water",
      "Have greater peace of mind about the water your family uses",
      "Retrofit compatible existing pool equipment",
      "Receive direct manufacturer support",
    ],
    qualification:
      "Compatibility, installation requirements, and ongoing pool-care needs vary. Complete the free assessment so the Fusion44X team can review your setup.",
    cta: "See If Fusion44X Fits My Pool",
  },
  how_fusion44x_works: {
    eyebrow: "Inside the Fusion44X System",
    heading: "How Hydro-pH-Infusion Works",
    subheading:
      "Fusion44X works with compatible pool equipment to generate hydrogen-rich water and support balanced pool and spa conditions while the circulation system is running.",
    callouts: [
      {
        number: 1,
        title: "Fusion44X Probe",
        text: "The probe sits in the container and uses electrolysis to help generate negatively charged molecular hydrogen.",
      },
      {
        number: 2,
        title: "Treatment Solution Container",
        text: "Holds a measured amount of muriatic acid solution used in the Hydro-pH-Infusion process.",
      },
      {
        number: 3,
        title: "Hydrogen Infusion Process",
        text: "As water circulates through the pump and filters, molecular hydrogen is infused into the pool water to help target algae, bacteria, and other contaminants at the source while supporting balanced pH.",
      },
      {
        number: 4,
        title: "Digital Meter and Controller",
        text: "Displays the system reading and helps monitor normal operation.",
      },
      {
        number: 5,
        title: "Pool Equipment Connection",
        text: "Connects with compatible existing pool plumbing and circulation equipment.",
      },
      {
        number: 6,
        title: "Pump and Filter Circulation",
        text: "The system works while the pool pump and filters are running, treating water during normal circulation.",
      },
    ],
    system_facts: [
      "Hydrogen bubbles generated through electrolysis",
      "Supports a pH range of 7.2–7.6",
      "Operates with pump runtime",
      "Annual probe replacement",
      "Compatible with many existing pool systems",
      "Real lifetime warranty",
    ],
  },
  next_step: {
    eyebrow: "Your Next Step",
    heading: "Start With Your Free Pool Assessment",
    subheading:
      "Every pool and spa is different. Tell us about your setup so the Fusion44X team can review compatibility and help you understand the right next step.",
    steps: [
      {
        heading: "Tell Us About Your Pool",
        text: "Answer a few quick questions about your pool, current system, size, and main concerns.",
      },
      {
        heading: "We Review Your Setup",
        text: "The Fusion44X team reviews compatibility and identifies the appropriate system configuration.",
      },
      {
        heading: "Review Your Options",
        text: "Schedule a consultation to ask questions, understand the recommendation, and decide whether Fusion44X is right for your pool.",
      },
    ],
    cta: "Start My Free Assessment",
  },
  diagnostic: {
    heading: "Pool Assessment",
    subheading:
      "Tell us about your pool or spa so we can recommend the right solution.",
    complete_label:
      "Your assessment is complete. Enter your details to view the recommended next step and available consultation times.",
    next: "Continue",
    back: "Back",
    complete: "Complete Assessment",
    progress_label: "Question",
    of: "of",
  },
  contact: {
    heading: "Where Should We Send Your Assessment?",
    subheading:
      "Share your information below so we can review your setup and help determine whether Fusion44X is right for your pool or spa.",
    first_name: "First Name",
    last_name: "Last Name",
    email: "Email Address",
    phone: "Phone Number",
    zip_code: "ZIP Code",
    preferred_contact: "Preferred Contact Method",
    preferred_contact_placeholder: "No preference",
    contact_method_email: "Email",
    contact_method_phone: "Phone",
    contact_method_text: "Text",
    consent_to_contact:
      "I agree to be contacted by Fusion44X about my pool assessment and product options.",
    marketing_consent:
      "I would like to receive occasional pool-care education, product updates, and Fusion44X offers.",
    submit: "Get My Free Pool Assessment",
    submitting: "Submitting Your Assessment…",
    error_required: "This field is required",
    error_invalid_email: "Please enter a valid email address",
    error_invalid_phone: "Please enter a valid phone number",
    error_consent_required: "You must agree to be contacted to proceed",
  },
  exit_popup: {
    heading: "Wait — Get Your Free Pool Assessment",
    subheading:
      "Don’t leave without your free Fusion44X pool assessment. Enter your details and a specialist will follow up with your personalized review.",
    name: "Your Name",
    email: "Email Address",
    phone: "Phone Number",
    phone_optional: "Phone Number (optional)",
    consent:
      "I agree to be contacted by Fusion44X about my pool assessment and product options.",
    submit: "Get My Assessment",
    submitting: "Submitting…",
    success_heading: "Thank You!",
    success_message:
      "Your details are in. A Fusion44X specialist will follow up with your free pool assessment.",
    close: "No thanks, I’ll continue browsing",
    error_required: "This field is required",
    error_invalid_email: "Please enter a valid email address",
    error_invalid_phone: "Please enter a valid phone number",
    error_consent_required: "You must agree to be contacted to proceed",
  },
  booking: {
    heading: "Schedule Your Consultation",
    subheading:
      "Select a date and time for your Fusion44X consultation.",
    timezone_label: "All times shown in",
    timezone_display: "Eastern Time",
    select_date: "Select a Date",
    select_time: "Select a Time",
    no_slots: "No available times for this date.",
    no_slots_sub: "Please select another date.",
    loading_slots: "Loading available times...",
    loading_error: "Could not load available times.",
    try_again: "Try again",
    review_heading: "Review Your Consultation",
    review_date: "Date",
    review_time: "Time",
    review_name: "Name",
    review_email: "Email",
    confirm: "Confirm My Consultation",
    confirming: "Confirming...",
    conflict:
      "That time was just taken. Please choose another available time.",
    error_missing_fields:
      "We’re missing part of your booking information. Please go back and select your date and time again.",
    error_server_error:
      "We couldn’t confirm your appointment right now. Please try again.",
    error_network_error:
      "We lost the connection while confirming your appointment. Please check your connection and try again.",
    error_unknown_error: "Something went wrong. Please try again.",
  },
  booking_transition: {
    heading: "Let’s Review Your Pool Together",
    subheading:
      "Choose a convenient time to speak with a Fusion44X specialist about your pool, your water concerns, and the right next step.",
    reassurance:
      "This is a no-obligation consultation. You will have the opportunity to ask questions and understand whether Fusion44X fits your setup.",
  },
  confirmation: {
    heading: "Your Fusion44X Consultation Is Confirmed",
    subheading:
      "Your appointment is scheduled, and a confirmation email is on its way.",
    next_step:
      "During your consultation, we will review your pool setup, discuss your water concerns, and help determine whether Fusion44X is the right fit for your family.",
    details_heading: "Your Appointment Details",
    date_label: "Date",
    time_label: "Time",
    timezone_label: "Timezone",
    add_to_calendar: "Add to Calendar",
    google_calendar: "Google Calendar",
    outlook: "Outlook Web",
    download_ics: "Download .ics file",
    appointment_ref: "Reference",
    support_line: "Questions before your appointment?",
    support_phone: "775-600-5305",
    support_email: "support@fusion44x.com",
  },
  faq: {
    cta_heading:
      "Ready to Find Out If Fusion44X Fits Your Pool?",
    cta_copy:
      "Start with a free assessment and let our team review your setup.",
    cta_button: "Get My Free Pool Assessment",
  },
  sticky_cta: {
    question: "Ready for healthy, safe pool water?",
    question_mobile: "Need better pool water?",
    button: "Start My Free Assessment",
  },
  footer: {
    brand: "Fusion44X",
    tagline: "Water Made Perfect",
    supporting_line:
      "Helping families move beyond the traditional pool chemical cycle.",
    support_phone: "775-600-5305",
    support_email: "support@fusion44x.com",
    copyright: `© ${new Date().getFullYear()} Fusion44X. All rights reserved.`,
  },
} as const;
```

### `src/config/tracking-events.ts`

```ts
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
  SCHEDULE: "Schedule",
} as const;

export type MetaEventName = (typeof MetaEvents)[keyof typeof MetaEvents];

export const ALL_META_EVENT_NAMES: MetaEventName[] = Object.values(
  MetaEvents,
) as MetaEventName[];
```

## `src/lib/`

> The source dump below is the repository content retrieved from `main`. Large files are presented as one continuous code block even though they were fetched in line ranges.

### `src/lib/admin/auth.ts`

```ts
import "server-only";

import crypto from "node:crypto";
import { requireAdminAuthEnv } from "@/lib/env";

const SESSION_COOKIE = "admin_session";
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// In-memory rate limiter for failed login attempts
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function getAdminSessionConfig() {
  return {
    cookieName: SESSION_COOKIE,
    maxAgeMs: SESSION_MAX_AGE_MS,
  };
}

export function verifyCredentials(
  username: string,
  password: string,
): boolean {
  const env = requireAdminAuthEnv();

  // Use constant-time comparison via HMAC to prevent timing attacks
  function safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const hmacA = crypto
      .createHmac("sha256", "compare")
      .update(a)
      .digest();
    const hmacB = crypto
      .createHmac("sha256", "compare")
      .update(b)
      .digest();
    return crypto.timingSafeEqual(hmacA, hmacB);
  }

  return safeEqual(username, env.username) && safeEqual(password, env.password);
}

export function createSessionToken(username: string): string {
  const env = requireAdminAuthEnv();
  const payload = JSON.stringify({
    u: username,
    iat: Date.now(),
    exp: Date.now() + SESSION_MAX_AGE_MS,
  });
  const data = Buffer.from(payload).toString("base64url");
  const signature = crypto
    .createHmac("sha256", env.sessionSecret)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

export function verifySessionToken(token: string): boolean {
  try {
    const env = requireAdminAuthEnv();
    const [data, signature] = token.split(".");
    if (!data || !signature) return false;

    const expectedSig = crypto
      .createHmac("sha256", env.sessionSecret)
      .update(data)
      .digest("base64url");

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSig),
      )
    ) {
      return false;
    }

    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function checkLoginRateLimit(
  ip: string,
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let entry = loginAttempts.get(ip);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    loginAttempts.set(ip, entry);
  }

  entry.count++;
  const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);

  return { allowed: entry.count <= RATE_LIMIT_MAX, remaining };
}

export function resetLoginRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}
```

### `src/lib/admin/queries.ts`

```ts
import "server-only";

import { getServerSupabaseClient } from "@/lib/supabase";
import type { LeadStage, AppointmentStage } from "@/lib/admin/stages";

// Supabase without generated Database types returns `never` for query results.
// We use `any` casts on query builder results to work around this.
// All data is validated by the existing RLS policies and server-side checks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export type DateFilter =
  | { type: "today" }
  | { type: "last7" }
  | { type: "last30" }
  | { type: "custom"; from: string; to: string };

export function resolveDateRange(filter: DateFilter): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  switch (filter.type) {
    case "today": {
      const from = new Date(now);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case "last7": {
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case "last30": {
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case "custom": {
      const from = new Date(filter.from + "T00:00:00.000Z");
      const customTo = new Date(filter.to + "T23:59:59.999Z");
      return { from, to: customTo };
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function supabase() {
  return getServerSupabaseClient();
}

export interface OverviewMetrics {
  uniqueVisitors: number;
  totalPageViews: number;
  uniqueFunnelSessions: number;
  returningSessions: number;
  diagnosticStarts: number;
  diagnosticCompletions: number;
  contactSubmissions: number;
  successfulLeads: number;
  abandonedSessions: number;
  bookingStageVisitors: number;
  confirmedAppointments: number;
  bookingConversionRate: number;
  visitorToLeadRate: number;
  leadToBookingRate: number;
}

export async function getOverviewMetrics(filter: DateFilter): Promise<OverviewMetrics> {
  const { from, to } = resolveDateRange(filter);
  const fromISO = from.toISOString();
  const toISO = to.toISOString();
  const db = supabase();
  const [
    { count: uniqueVisitors }, { count: totalPageViews }, { count: uniqueFunnelSessions },
    { count: diagnosticStarts }, { count: diagnosticCompletions }, { count: contactSubmissions },
    { count: successfulLeads }, { count: bookingStageVisitors }, { count: confirmedAppointments },
  ] = await Promise.all([
    db.from("funnel_sessions").select("anonymous_id", { count: "exact", head: true }).gte("started_at", fromISO).lte("started_at", toISO),
    db.from("funnel_events").select("id", { count: "exact", head: true }).eq("event_name", "page_viewed").gte("occurred_at", fromISO).lte("occurred_at", toISO),
    db.from("funnel_sessions").select("id", { count: "exact", head: true }).gte("started_at", fromISO).lte("started_at", toISO),
    db.from("funnel_events").select("id", { count: "exact", head: true }).eq("event_name", "diagnostic_started").gte("occurred_at", fromISO).lte("occurred_at", toISO),
    db.from("funnel_events").select("id", { count: "exact", head: true }).eq("event_name", "diagnostic_completed").gte("occurred_at", fromISO).lte("occurred_at", toISO),
    db.from("funnel_events").select("id", { count: "exact", head: true }).eq("event_name", "contact_submitted").gte("occurred_at", fromISO).lte("occurred_at", toISO),
    db.from("funnel_events").select("id", { count: "exact", head: true }).eq("event_name", "lead_created").gte("occurred_at", fromISO).lte("occurred_at", toISO),
    db.from("funnel_events").select("id", { count: "exact", head: true }).eq("event_name", "calendar_viewed").gte("occurred_at", fromISO).lte("occurred_at", toISO),
    db.from("appointments").select("id", { count: "exact", head: true }).eq("status", "confirmed").gte("created_at", fromISO).lte("created_at", toISO),
  ]);
  const { data: currentAnonymousIds } = await db.from("funnel_sessions").select("anonymous_id").gte("started_at", fromISO).lte("started_at", toISO);
  let returningSessions = 0;
  const anonRows = (currentAnonymousIds ?? []) as AnyRow[];
  if (anonRows.length > 0) {
    const anonIds = [...new Set(anonRows.map((s) => s.anonymous_id as string))];
    const { count: priorSessionCount } = await db.from("funnel_sessions").select("id", { count: "exact", head: true }).in("anonymous_id", anonIds).lt("started_at", fromISO);
    returningSessions = priorSessionCount ?? 0;
  }
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { count: abandonedSessions } = await db.from("funnel_sessions").select("id", { count: "exact", head: true }).eq("status", "active").lte("last_seen_at", thirtyMinAgo).gte("started_at", fromISO).lte("started_at", toISO);
  const sv = uniqueVisitors ?? 0;
  const sl = successfulLeads ?? 0;
  const sa = confirmedAppointments ?? 0;
  const bs = bookingStageVisitors ?? 0;
  return {
    uniqueVisitors: sv, totalPageViews: totalPageViews ?? 0,
    uniqueFunnelSessions: uniqueFunnelSessions ?? 0, returningSessions,
    diagnosticStarts: diagnosticStarts ?? 0, diagnosticCompletions: diagnosticCompletions ?? 0,
    contactSubmissions: contactSubmissions ?? 0, successfulLeads: sl,
    abandonedSessions: abandonedSessions ?? 0, bookingStageVisitors: bs,
    confirmedAppointments: sa, bookingConversionRate: bs > 0 ? round2((sa / bs) * 100) : 0,
    visitorToLeadRate: sv > 0 ? round2((sl / sv) * 100) : 0,
    leadToBookingRate: sl > 0 ? round2((sa / sl) * 100) : 0,
  };
}

export interface SessionRow {
  id: string; anonymous_id: string | null; started_at: string; last_seen_at: string;
  status: string; page_version: string; referrer: string | null; landing_url: string | null;
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null;
  utm_content: string | null; utm_term: string | null; device_category: string | null;
  lead_id: string | null;
  lead: { id: string; first_name: string; last_name: string; email: string; phone: string; status: string; created_at: string } | null;
  appointment: { id: string; status: string; start_time: string; end_time: string; timezone: string } | null;
  page_view_count: number; event_count: number; furthest_step: string | null;
  diagnostic_completed: boolean; contact_submitted: boolean; has_booking: boolean;
}

export type SessionSortBy = "newest" | "oldest" | "most_page_views" | "furthest_progress" | "most_recent_activity";
export type SessionStatusFilter = "all" | "abandoned" | "submitted" | "booked" | "completed";
export interface SessionFilters { dateFilter: DateFilter; status?: SessionStatusFilter; utmSource?: string; campaign?: string; device?: string; hasError?: boolean; }
export interface SessionListResult { sessions: SessionRow[]; total: number; page: number; pageSize: number; }

const STEP_ORDER = ["page_viewed", "diagnostic_started", "question_viewed", "diagnostic_completed", "contact_step_viewed", "contact_submitted", "lead_created", "calendar_viewed", "time_slot_selected", "booking_completed", "confirmation_viewed"];

function computeFurthestStep(events: Array<Record<string, unknown>>): string | null {
  let furthest = -1;
  for (const ev of events) { const idx = STEP_ORDER.indexOf(ev.event_name as string); if (idx > furthest) furthest = idx; }
  return furthest >= 0 ? STEP_ORDER[furthest] : null;
}

export async function getSessionList(filters: SessionFilters, sort: SessionSortBy, page: number, pageSize: number = 25): Promise<SessionListResult> {
  const { from, to } = resolveDateRange(filters.dateFilter); const fromISO = from.toISOString(); const toISO = to.toISOString(); const offset = (page - 1) * pageSize; const db = supabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = db.from("funnel_sessions").select("id, anonymous_id, started_at, last_seen_at, status, page_version, referrer, landing_url, utm_source, utm_medium, utm_campaign, utm_content, utm_term, device_category, lead_id, lead:leads!funnel_sessions_lead_id_fkey(id, first_name, last_name, email, phone, status, created_at), appointment:appointments(id, status, start_time, end_time, timezone)", { count: "exact" }).gte("started_at", fromISO).lte("started_at", toISO);
  if (filters.status === "abandoned") { const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString(); query = query.eq("status", "active").lte("last_seen_at", thirtyMinAgo); }
  else if (filters.status === "submitted") query = query.eq("status", "lead_created");
  else if (filters.status === "booked") query = query.eq("status", "booked");
  else if (filters.status === "completed") query = query.in("status", ["lead_created", "booked"]);
  if (filters.utmSource) query = query.eq("utm_source", filters.utmSource);
  if (filters.campaign) query = query.eq("utm_campaign", filters.campaign);
  if (filters.device) query = query.eq("device_category", filters.device);
  switch (sort) { case "oldest": query = query.order("started_at", { ascending: true }); break; case "most_recent_activity": query = query.order("last_seen_at", { ascending: false }); break; case "newest": default: query = query.order("started_at", { ascending: false }); break; }
  query = query.range(offset, offset + pageSize - 1);
  const { data, count } = await query as { data: AnyRow[] | null; count: number | null };
  const sessionIds = ((data ?? []) as AnyRow[]).map((s: AnyRow) => s.id as string);
  const pageViewCounts: Record<string, number> = {}; const eventCounts: Record<string, number> = {}; const furthestSteps: Record<string, string | null> = {}; const diagnosticStatus: Record<string, boolean> = {}; const contactStatus: Record<string, boolean> = {}; const bookingStatus: Record<string, boolean> = {};
  if (sessionIds.length > 0) {
    const [pvResult, evResult, diagResult, contactResult, bookResult] = await Promise.all([
      db.from("funnel_events").select("session_id").eq("event_name", "page_viewed").in("session_id", sessionIds),
      db.from("funnel_events").select("session_id, event_name").in("session_id", sessionIds),
      db.from("funnel_events").select("session_id").eq("event_name", "diagnostic_completed").in("session_id", sessionIds),
      db.from("funnel_events").select("session_id").eq("event_name", "contact_submitted").in("session_id", sessionIds),
      db.from("funnel_events").select("session_id").eq("event_name", "booking_completed").in("session_id", sessionIds),
    ]);
    for (const ev of (pvResult.data ?? []) as AnyRow[]) { const sid = ev.session_id as string; pageViewCounts[sid] = (pageViewCounts[sid] ?? 0) + 1; }
    for (const ev of (evResult.data ?? []) as AnyRow[]) { const sid = ev.session_id as string; eventCounts[sid] = (eventCounts[sid] ?? 0) + 1; const eventName = ev.event_name as string; const idx = STEP_ORDER.indexOf(eventName); if (idx >= 0) { const current = STEP_ORDER.indexOf(furthestSteps[sid] ?? ""); if (current < 0 || idx > current) furthestSteps[sid] = eventName; } }
    for (const ev of (diagResult.data ?? []) as AnyRow[]) diagnosticStatus[ev.session_id as string] = true;
    for (const ev of (contactResult.data ?? []) as AnyRow[]) contactStatus[ev.session_id as string] = true;
    for (const ev of (bookResult.data ?? []) as AnyRow[]) bookingStatus[ev.session_id as string] = true;
  }
  const sessions: SessionRow[] = ((data ?? []) as AnyRow[]).map((s: AnyRow) => { const rawLead = Array.isArray(s.lead) ? s.lead[0] ?? null : s.lead; const rawAppt = Array.isArray(s.appointment) ? s.appointment[0] ?? null : s.appointment; return { id: s.id as string, anonymous_id: s.anonymous_id as string | null, started_at: s.started_at as string, last_seen_at: s.last_seen_at as string, status: s.status as string, page_version: s.page_version as string, referrer: s.referrer as string | null, landing_url: s.landing_url as string | null, utm_source: s.utm_source as string | null, utm_medium: s.utm_medium as string | null, utm_campaign: s.utm_campaign as string | null, utm_content: s.utm_content as string | null, utm_term: s.utm_term as string | null, device_category: s.device_category as string | null, lead_id: s.lead_id as string | null, lead: rawLead ? { id: rawLead.id as string, first_name: rawLead.first_name as string, last_name: rawLead.last_name as string, email: rawLead.email as string, phone: rawLead.phone as string, status: rawLead.status as string, created_at: rawLead.created_at as string } : null, appointment: rawAppt ? { id: rawAppt.id as string, status: rawAppt.status as string, start_time: rawAppt.start_time as string, end_time: rawAppt.end_time as string, timezone: rawAppt.timezone as string } : null, page_view_count: pageViewCounts[s.id as string] ?? 0, event_count: eventCounts[s.id as string] ?? 0, furthest_step: furthestSteps[s.id as string] ?? null, diagnostic_completed: diagnosticStatus[s.id as string] ?? false, contact_submitted: contactStatus[s.id as string] ?? false, has_booking: bookingStatus[s.id as string] ?? false }; });
  return { sessions, total: count ?? 0, page, pageSize };
}

export interface SessionDetail { session: SessionRow; events: Array<{ id: string; event_name: string; occurred_at: string; step_id: string | null; question_id: string | null; answer_code: string | null; metadata: Record<string, unknown>; lead_id: string | null; duration_ms: number | null; }>; funnelPath: Array<{ step: string; reached: boolean; timestamp: string | null; }>; }

function buildFunnelPath(events: Array<Record<string, unknown>>): Array<{ step: string; reached: boolean; timestamp: string | null }> { const reachedMap = new Map<string, string>(); for (const ev of events) { const eventName = ev.event_name as string; const occurredAt = ev.occurred_at as string; if (STEP_ORDER.includes(eventName) && !reachedMap.has(eventName)) reachedMap.set(eventName, occurredAt); } return STEP_ORDER.map((step) => ({ step, reached: reachedMap.has(step), timestamp: reachedMap.get(step) ?? null })); }

export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  const db = supabase();
  const { data: session, error: sessionError } = await db.from("funnel_sessions").select("*, lead:leads!funnel_sessions_lead_id_fkey(id, first_name, last_name, email, phone, zip_code, water_feature, installation_type, pool_size, current_treatment, primary_goal, status, created_at), appointment:appointments(id, status, start_time, end_time, timezone, external_event_id, created_at)").eq("id", sessionId).single();
  if (sessionError || !session) return null;
  const rawSession = session as AnyRow; const rawLead = Array.isArray(rawSession.lead) ? rawSession.lead[0] ?? null : rawSession.lead; const rawAppt = Array.isArray(rawSession.appointment) ? rawSession.appointment[0] ?? null : rawSession.appointment;
  const { data: events } = await db.from("funnel_events").select("id, event_name, occurred_at, step_id, question_id, answer_code, metadata, lead_id, duration_ms").eq("session_id", sessionId).order("occurred_at", { ascending: true });
  const { count: pageViewCount } = await db.from("funnel_events").select("id", { count: "exact", head: true }).eq("session_id", sessionId).eq("event_name", "page_viewed");
  const eventRows = (events ?? []) as AnyRow[];
  const enrichedSession: SessionRow = { id: rawSession.id as string, anonymous_id: rawSession.anonymous_id as string | null, started_at: rawSession.started_at as string, last_seen_at: rawSession.last_seen_at as string, status: rawSession.status as string, page_version: rawSession.page_version as string, referrer: rawSession.referrer as string | null, landing_url: rawSession.landing_url as string | null, utm_source: rawSession.utm_source as string | null, utm_medium: rawSession.utm_medium as string | null, utm_campaign: rawSession.utm_campaign as string | null, utm_content: rawSession.utm_content as string | null, utm_term: rawSession.utm_term as string | null, device_category: rawSession.device_category as string | null, lead_id: rawSession.lead_id as string | null, lead: rawLead ? { id: rawLead.id as string, first_name: rawLead.first_name as string, last_name: rawLead.last_name as string, email: rawLead.email as string, phone: rawLead.phone as string, status: rawLead.status as string, created_at: rawLead.created_at as string } : null, appointment: rawAppt ? { id: rawAppt.id as string, status: rawAppt.status as string, start_time: rawAppt.start_time as string, end_time: rawAppt.end_time as string, timezone: rawAppt.timezone as string } : null, page_view_count: pageViewCount ?? 0, event_count: eventRows.length, furthest_step: computeFurthestStep(eventRows), diagnostic_completed: eventRows.some((e) => e.event_name === "diagnostic_completed"), contact_submitted: eventRows.some((e) => e.event_name === "contact_submitted"), has_booking: eventRows.some((e) => e.event_name === "booking_completed") };
  return { session: enrichedSession, events: eventRows.map((e) => ({ id: e.id as string, event_name: e.event_name as string, occurred_at: e.occurred_at as string, step_id: e.step_id as string | null, question_id: e.question_id as string | null, answer_code: e.answer_code as string | null, metadata: (typeof e.metadata === "object" && e.metadata !== null ? e.metadata : {}) as Record<string, unknown>, lead_id: e.lead_id as string | null, duration_ms: e.duration_ms as number | null })), funnelPath: buildFunnelPath(eventRows) };
}

export interface FunnelStage { name: string; eventName: string; sessionsEntering: number; sessionsCompleting: number; conversionPct: number; dropoff: number; dropoffPct: number; }
export async function getFunnelReport(filter: DateFilter): Promise<FunnelStage[]> { const { from, to } = resolveDateRange(filter); const fromISO = from.toISOString(); const toISO = to.toISOString(); const db = supabase(); const { count: totalSessions } = await db.from("funnel_sessions").select("id", { count: "exact", head: true }).gte("started_at", fromISO).lte("started_at", toISO); const total = totalSessions ?? 0; const stages = [{ name: "Page Viewed", eventName: "page_viewed" }, { name: "Diagnostic Started", eventName: "diagnostic_started" }, { name: "Diagnostic Completed", eventName: "diagnostic_completed" }, { name: "Contact Viewed", eventName: "contact_step_viewed" }, { name: "Contact Submitted", eventName: "contact_submitted" }, { name: "Booking Viewed", eventName: "calendar_viewed" }, { name: "Slot Selected", eventName: "time_slot_selected" }, { name: "Booking Completed", eventName: "booking_completed" }, { name: "Confirmation Viewed", eventName: "confirmation_viewed" }]; const results: FunnelStage[] = []; for (let i = 0; i < stages.length; i++) { const stage = stages[i]; const { count: completingCount } = await db.from("funnel_events").select("session_id", { count: "exact", head: true }).eq("event_name", stage.eventName).gte("occurred_at", fromISO).lte("occurred_at", toISO); const completing = completingCount ?? 0; const entering = i === 0 ? total : (results[i - 1]?.sessionsCompleting ?? 0); const conversionPct = entering > 0 ? round2((completing / entering) * 100) : 0; const dropoff = entering - completing; const dropoffPct = entering > 0 ? round2((dropoff / entering) * 100) : 0; results.push({ name: stage.name, eventName: stage.eventName, sessionsEntering: entering, sessionsCompleting: completing, conversionPct, dropoff, dropoffPct }); } return results; }

export interface LeadRow { id: string; first_name: string; last_name: string; email: string; phone: string; status: string; source: string | null; stage: string | null; lead_origin: string; view_count: number; created_at: string; diagnostic_completed: boolean; appointment_status: string | null; water_feature: string; installation_type: string; pool_size: string; current_treatment: string; primary_goal: string; current_issues: string[]; }
export interface LeadDetail extends LeadRow { last_name: string; zip_code: string; water_feature: string; installation_type: string; pool_size: string; current_treatment: string; current_issues: string[]; primary_goal: string; qualification_summary: string | null; consent_to_contact: boolean; consent_to_contact_at: string | null; marketing_consent: boolean; source: string | null; session_id: string | null; }

export async function getLeadsList(filter: DateFilter, page: number, pageSize: number = 25): Promise<{ leads: LeadRow[]; total: number; page: number; pageSize: number }> {
  const { from, to } = resolveDateRange(filter); const fromISO = from.toISOString(); const toISO = to.toISOString(); const offset = (page - 1) * pageSize; const db = supabase();
  const { data, count } = await db.from("leads").select("id, first_name, last_name, email, phone, status, source, stage, lead_origin, created_at, session_id, water_feature, installation_type, pool_size, current_treatment, primary_goal", { count: "exact" }).gte("created_at", fromISO).lte("created_at", toISO).order("created_at", { ascending: false }).range(offset, offset + pageSize - 1) as { data: AnyRow[] | null; count: number | null };
  const leadIds = ((data ?? []) as AnyRow[]).map((l: AnyRow) => l.id as string); const appointmentStatuses: Record<string, string> = {}; const sessionIds = ((data ?? []) as AnyRow[]).map((l: AnyRow) => l.session_id as string | null); const viewCounts: Record<string, number> = {}; const issuesByLead: Record<string, string[]> = {};
  if (leadIds.length > 0) { const apptPromise = db.from("appointments").select("lead_id, status").in("lead_id", leadIds); const viewPromise = sessionIds.some(Boolean) ? db.from("funnel_events").select("session_id").eq("event_name", "page_viewed").in("session_id", sessionIds.filter((s): s is string => Boolean(s))) : Promise.resolve({ data: [] }); const issuesPromise = db.from("lead_answers").select("lead_id, answer_code").eq("question_id", "current-issues").in("lead_id", leadIds); const [apptResult, viewResult, issuesResult] = await Promise.all([apptPromise, viewPromise, issuesPromise]); for (const a of (apptResult.data ?? []) as AnyRow[]) appointmentStatuses[a.lead_id as string] = a.status as string; for (const ev of (viewResult.data ?? []) as AnyRow[]) { const sid = ev.session_id as string; viewCounts[sid] = (viewCounts[sid] ?? 0) + 1; } for (const ans of (issuesResult.data ?? []) as AnyRow[]) { const lid = ans.lead_id as string; const code = ans.answer_code as string; if (!issuesByLead[lid]) issuesByLead[lid] = []; issuesByLead[lid].push(code); } }
  const leads: LeadRow[] = ((data ?? []) as AnyRow[]).map((l: AnyRow) => ({ id: l.id as string, first_name: l.first_name as string, last_name: l.last_name as string, email: l.email as string, phone: (l.phone as string) ?? "", status: l.status as string, source: l.source as string | null, stage: l.stage as string | null, lead_origin: l.lead_origin as string ?? "funnel", view_count: (l.session_id ? (viewCounts[l.session_id as string] ?? 0) : 0), created_at: l.created_at as string, diagnostic_completed: true, appointment_status: appointmentStatuses[l.id as string] ?? null, water_feature: (l.water_feature as string) ?? "", installation_type: (l.installation_type as string) ?? "", pool_size: (l.pool_size as string) ?? "", current_treatment: (l.current_treatment as string) ?? "", primary_goal: (l.primary_goal as string) ?? "", current_issues: issuesByLead[l.id as string] ?? [] }));
  return { leads, total: count ?? 0, page, pageSize };
}

export async function getLeadDetail(leadId: string): Promise<LeadDetail | null> { const db = supabase(); const { data, error } = await db.from("leads").select("*").eq("id", leadId).single(); if (error || !data) return null; const raw = data as AnyRow; const { data: answers } = await db.from("lead_answers").select("answer_code").eq("lead_id", leadId).eq("question_id", "current-issues"); const currentIssues = ((answers ?? []) as AnyRow[]).map((a: AnyRow) => a.answer_code as string); const { data: apptData } = await db.from("appointments").select("status").eq("lead_id", leadId).maybeSingle(); const appointmentStatus = apptData ? (apptData as AnyRow).status as string : null; let viewCount = 0; if (raw.session_id) { const { count } = await db.from("funnel_events").select("id", { count: "exact", head: true }).eq("session_id", raw.session_id as string).eq("event_name", "page_viewed"); viewCount = count ?? 0; } return { id: raw.id as string, first_name: raw.first_name as string, last_name: raw.last_name as string, email: raw.email as string, phone: (raw.phone as string) ?? "", zip_code: (raw.zip_code as string) ?? "", water_feature: (raw.water_feature as string) ?? "", installation_type: (raw.installation_type as string) ?? "", pool_size: (raw.pool_size as string) ?? "", current_treatment: (raw.current_treatment as string) ?? "", current_issues: currentIssues, primary_goal: (raw.primary_goal as string) ?? "", qualification_summary: raw.qualification_summary as string | null, status: raw.status as string, stage: raw.stage as string | null, source: raw.source as string | null, lead_origin: (raw.lead_origin as string) ?? "funnel", view_count: viewCount, created_at: raw.created_at as string, diagnostic_completed: true, appointment_status: appointmentStatus, consent_to_contact: raw.consent_to_contact as boolean, consent_to_contact_at: raw.consent_to_contact_at as string | null, marketing_consent: raw.marketing_consent as boolean, session_id: raw.session_id as string | null }; }

export async function updateLeadStage(leadId: string, stage: LeadStage | null): Promise<boolean> { const { error } = await supabase().from("leads").update({ stage } as never).eq("id", leadId); return !error; }

export interface AppointmentRow { id: string; lead_id: string; lead_name: string; lead_email: string; start_time: string; end_time: string; timezone: string; status: string; google_calendar_status: string | null; customer_email_status: string | null; internal_email_status: string | null; safe_error_code: string | null; created_at: string; updated_at: string; }
export async function getAppointmentsList(filter: DateFilter, page: number, pageSize: number = 25): Promise<{ appointments: AppointmentRow[]; total: number; page: number; pageSize: number }> { const { from, to } = resolveDateRange(filter); const fromISO = from.toISOString(); const toISO = to.toISOString(); const offset = (page - 1) * pageSize; const db = supabase(); const { data, count } = await db.from("appointments").select("id, lead_id, start_time, end_time, timezone, status, created_at, updated_at", { count: "exact" }).gte("created_at", fromISO).lte("created_at", toISO).order("created_at", { ascending: false }).range(offset, offset + pageSize - 1) as { data: AnyRow[] | null; count: number | null }; const apptIds = ((data ?? []) as AnyRow[]).map((a: AnyRow) => a.id as string); const leadIds = ((data ?? []) as AnyRow[]).map((a: AnyRow) => a.lead_id as string); const leadNames: Record<string, { name: string; email: string }> = {}; const deliveryMap: Record<string, AnyRow[]> = {}; if (apptIds.length > 0) { const [leadsResult, deliveriesResult] = await Promise.all([db.from("leads").select("id, first_name, last_name, email").in("id", leadIds), db.from("integration_deliveries").select("appointment_id, destination, status, error_message").in("appointment_id", apptIds)]); for (const l of (leadsResult.data ?? []) as AnyRow[]) leadNames[l.id as string] = { name: `${l.first_name as string} ${l.last_name as string}`, email: l.email as string }; for (const d of (deliveriesResult.data ?? []) as AnyRow[]) { const apptId = d.appointment_id as string; if (!deliveryMap[apptId]) deliveryMap[apptId] = []; deliveryMap[apptId].push(d); } } const appointments: AppointmentRow[] = ((data ?? []) as AnyRow[]).map((a: AnyRow) => { const apptId = a.id as string; const deliveries = deliveryMap[apptId] ?? []; const gcDelivery = deliveries.find((d) => d.destination === "google_calendar"); const custEmail = deliveries.find((d) => d.destination === "email" && d.status === "delivered" && d.error_message === null); const intEmail = deliveries.find((d) => d.destination === "email" && d.event_type === "internal_booking_notification"); const failedDelivery = deliveries.find((d) => d.status === "failed" || d.status === "dead_letter"); const leadInfo = leadNames[a.lead_id as string]; return { id: apptId, lead_id: a.lead_id as string, lead_name: leadInfo?.name ?? "Unknown", lead_email: leadInfo?.email ?? "", start_time: a.start_time as string, end_time: a.end_time as string, timezone: a.timezone as string, status: a.status as string, google_calendar_status: gcDelivery?.status as string ?? null, customer_email_status: custEmail?.status as string ?? null, internal_email_status: intEmail?.status as string ?? null, safe_error_code: failedDelivery?.error_message as string ?? null, created_at: a.created_at as string, updated_at: a.updated_at as string }; }); return { appointments, total: count ?? 0, page, pageSize }; }

export async function updateAppointmentStatus(appointmentId: string, status: AppointmentStage): Promise<boolean> { const { error } = await supabase().from("appointments").update({ status } as never).eq("id", appointmentId); return !error; }

export interface IntegrationHealthMetrics { googleCalendarDelivered: number; googleCalendarFailed: number; customerEmailDelivered: number; customerEmailFailed: number; internalEmailDelivered: number; internalEmailFailed: number; pendingDeliveries: number; deadLetterDeliveries: number; recentFailures: Array<{ id: string; destination: string; event_type: string; status: string; error_message: string | null; created_at: string; appointment_id: string | null; }>; }
export async function getIntegrationHealth(filter: DateFilter): Promise<IntegrationHealthMetrics> { const { from, to } = resolveDateRange(filter); const fromISO = from.toISOString(); const toISO = to.toISOString(); const db = supabase(); const [{ count: gcDelivered }, { count: gcFailed }, { count: custDelivered }, { count: custFailed }, { count: intDelivered }, { count: intFailed }, { count: pending }, { count: deadLetter }] = await Promise.all([db.from("integration_deliveries").select("id", { count: "exact", head: true }).eq("destination", "google_calendar").eq("status", "delivered").gte("created_at", fromISO).lte("created_at", toISO), db.from("integration_deliveries").select("id", { count: "exact", head: true }).eq("destination", "google_calendar").in("status", ["failed", "dead_letter"]).gte("created_at", fromISO).lte("created_at", toISO), db.from("integration_deliveries").select("id", { count: "exact", head: true }).eq("destination", "email").eq("event_type", "booking_confirmation").eq("status", "delivered").gte("created_at", fromISO).lte("created_at", toISO), db.from("integration_deliveries").select("id", { count: "exact", head: true }).eq("destination", "email").eq("event_type", "booking_confirmation").in("status", ["failed", "dead_letter"]).gte("created_at", fromISO).lte("created_at", toISO), db.from("integration_deliveries").select("id", { count: "exact", head: true }).eq("destination", "email").eq("event_type", "internal_booking_notification").eq("status", "delivered").gte("created_at", fromISO).lte("created_at", toISO), db.from("integration_deliveries").select("id", { count: "exact", head: true }).eq("destination", "email").eq("event_type", "internal_booking_notification").in("status", ["failed", "dead_letter"]).gte("created_at", fromISO).lte("created_at", toISO), db.from("integration_deliveries").select("id", { count: "exact", head: true }).in("status", ["pending", "processing", "retrying"]).gte("created_at", fromISO).lte("created_at", toISO), db.from("integration_deliveries").select("id", { count: "exact", head: true }).eq("status", "dead_letter").gte("created_at", fromISO).lte("created_at", toISO)]); const { data: recentFailures } = await db.from("integration_deliveries").select("id, destination, event_type, status, error_message, created_at, appointment_id").in("status", ["failed", "dead_letter"]).gte("created_at", fromISO).lte("created_at", toISO).order("created_at", { ascending: false }).limit(20); return { googleCalendarDelivered: gcDelivered ?? 0, googleCalendarFailed: gcFailed ?? 0, customerEmailDelivered: custDelivered ?? 0, customerEmailFailed: custFailed ?? 0, internalEmailDelivered: intDelivered ?? 0, internalEmailFailed: intFailed ?? 0, pendingDeliveries: pending ?? 0, deadLetterDeliveries: deadLetter ?? 0, recentFailures: ((recentFailures ?? []) as AnyRow[]).map((f) => ({ id: f.id as string, destination: f.destination as string, event_type: f.event_type as string, status: f.status as string, error_message: f.error_message as string | null, created_at: f.created_at as string, appointment_id: f.appointment_id as string | null })) }; }

function escapeCsvValue(value: unknown): string { const str = value == null ? "" : String(value); if (/^[=+\-@\t\r]/.test(str)) return `'${str}`; if (str.includes(",") || str.includes('"') || str.includes("\n")) return `"${str.replace(/"/g, '""')}"`; return str; }
export function toCsv(rows: Record<string, unknown>[], columns: string[]): string { const header = columns.map(escapeCsvValue).join(","); const body = rows.map((row) => columns.map((col) => escapeCsvValue(row[col])).join(",")).join("\n"); return `${header}\n${body}\n`; }
export async function exportSessionsCsv(filter: DateFilter): Promise<string> { const result = await getSessionList({ dateFilter: filter }, "newest", 1, 10000); const columns = ["id", "anonymous_id", "started_at", "last_seen_at", "status", "page_view_count", "furthest_step", "diagnostic_completed", "contact_submitted", "has_booking", "utm_source", "utm_medium", "utm_campaign", "device_category", "referrer"]; return toCsv(result.sessions.map((s) => ({ ...s, diagnostic_completed: s.diagnostic_completed ? "Yes" : "No", contact_submitted: s.contact_submitted ? "Yes" : "No", has_booking: s.has_booking ? "Yes" : "No" })), columns); }
export async function exportLeadsCsv(filter: DateFilter): Promise<string> { const result = await getLeadsList(filter, 1, 10000); const columns = ["id", "first_name", "last_name", "email", "phone", "status", "source", "stage", "lead_origin", "water_feature", "installation_type", "pool_size", "current_treatment", "primary_goal", "current_issues", "view_count", "appointment_status", "created_at"]; return toCsv(result.leads.map((l) => ({ ...l, current_issues: l.current_issues.join("; ") })), columns); }
export async function exportAppointmentsCsv(filter: DateFilter): Promise<string> { const result = await getAppointmentsList(filter, 1, 10000); const columns = ["id", "lead_name", "lead_email", "start_time", "end_time", "timezone", "status", "google_calendar_status", "customer_email_status", "internal_email_status", "safe_error_code", "created_at"]; return toCsv(result.appointments.map((a) => ({ ...a, lead_email: a.lead_email ? `${a.lead_email.substring(0, 3)}***@***` : "" })), columns); }
```

> **Audit note:** The block above preserves the logic and statements of the retrieved file, but long one-line formatting was compacted in this audit for size. For architecture semantics it is complete; whitespace is not byte-for-byte identical.

### `src/lib/admin/stages.ts`

```ts
import { z } from "zod";

export const LEAD_STAGES = ["contacted", "no_show", "follow_up", "won", "lost"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
export const LEAD_STAGE_LABELS: Record<LeadStage, string> = { contacted: "Contacted", no_show: "No Show", follow_up: "Follow-up", won: "Won", lost: "Lost" };
export const leadStageSchema = z.enum(LEAD_STAGES).nullable();
export function leadStageLabel(stage: string | null): string { if (!stage) return "Unstaged"; return LEAD_STAGE_LABELS[stage as LeadStage] ?? stage; }
export const APPOINTMENT_STAGES = ["no_show", "completed"] as const;
export type AppointmentStage = (typeof APPOINTMENT_STAGES)[number];
export const APPOINTMENT_STAGE_LABELS: Record<AppointmentStage, string> = { no_show: "No Show", completed: "Complete" };
export const appointmentStageSchema = z.enum(APPOINTMENT_STAGES);
export function appointmentStageLabel(stage: string | null): string { if (!stage) return "Unstaged"; return APPOINTMENT_STAGE_LABELS[stage as AppointmentStage] ?? stage; }
```

### `src/lib/analytics/index.ts`

```ts
import type { InternalEventPayload } from "@/types/tracking";
export function trackInternalEvent(event: InternalEventPayload): void {
  if (typeof window === "undefined") return;
  try {
    const { event_name, event_id, session_id, step_id, question_id, duration_ms } = event;
    console.info("[Analytics] internal_event:", { event_name, event_id, session_id, step_id, question_id, duration_ms });
  } catch {}
}
```

### `src/lib/analytics/tracker.ts`

```ts
import type { InternalEventName } from "@/config/tracking-events";
import type { FunnelStepId, DiagnosticQuestionId } from "@/types/funnel";
const PAGE_VERSION = "0.1.0";
interface TrackerConfig { session_id: string; }
interface TrackOptions { step_id?: FunnelStepId; question_id?: DiagnosticQuestionId; answer_code?: string; duration_ms?: number; lead_id?: string; metadata?: Record<string, unknown>; }
export function createTracker(config: TrackerConfig) {
  const { session_id } = config;
  function track(event_name: InternalEventName, options?: TrackOptions): void {
    const payload: Record<string, unknown> = { session_id, event_name, page_version: PAGE_VERSION };
    if (options?.step_id) payload.step_id = options.step_id;
    if (options?.question_id) payload.question_id = options.question_id;
    if (options?.answer_code) payload.answer_code = options.answer_code;
    if (options?.duration_ms != null) payload.duration_ms = options.duration_ms;
    if (options?.lead_id) payload.lead_id = options.lead_id;
    if (options?.metadata) payload.metadata = options.metadata;
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/funnel-events", blob);
    } else {
      fetch("/api/funnel-events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
    if (process.env.NODE_ENV === "development") console.info("[tracker]", event_name, options ?? "");
  }
  return { track };
}
export type Tracker = ReturnType<typeof createTracker>;
```

### `src/lib/booking/calendar-links.ts`

```ts
export function generateGoogleCalendarUrl(params: { startTime: string; endTime: string; title: string; description?: string; location?: string; }): string {
  const base = "https://calendar.google.com/calendar/render?action=TEMPLATE"; const url = new URL(base); url.searchParams.set("text", params.title); url.searchParams.set("dates", `${formatGCalDate(params.startTime)}/${formatGCalDate(params.endTime)}`); if (params.description) url.searchParams.set("details", params.description); if (params.location) url.searchParams.set("location", params.location); url.searchParams.set("ctz", "America/New_York"); return url.toString();
}
export function generateOutlookWebUrl(params: { startTime: string; endTime: string; title: string; description?: string; location?: string; }): string { const base = "https://outlook.live.com/calendar/0/deeplink/compose"; const url = new URL(base); url.searchParams.set("body", params.description ?? ""); url.searchParams.set("subject", params.title); url.searchParams.set("startdt", params.startTime); url.searchParams.set("enddt", params.endTime); if (params.location) url.searchParams.set("location", params.location); url.searchParams.set("path", "/calendar/action/compose&rru=addevent"); return url.toString(); }
export function generateIcsContent(params: { startTime: string; endTime: string; title: string; description?: string; location?: string; organizer?: string; }): string { const formatIcsDt = (iso: string): string => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Fusion44X//Booking//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT", `UID:${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}@fusion44x.com`, `DTSTART:${formatIcsDt(params.startTime)}`, `DTEND:${formatIcsDt(params.endTime)}`, `SUMMARY:${params.title}`]; if (params.description) lines.push(`DESCRIPTION:${params.description.replace(/\n/g, "\\n")}`); if (params.location) lines.push(`LOCATION:${params.location}`); if (params.organizer) lines.push(`ORGANIZER;CN=${params.organizer}:mailto:${params.organizer}`); lines.push("END:VEVENT", "END:VCALENDAR"); return lines.join("\r\n"); }
function formatGCalDate(iso: string): string { return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
```

### `src/lib/booking/create-booking.ts`

```ts
import { getServerSupabaseClient } from "@/lib/supabase";
import { createGoogleCalendarProvider } from "@/lib/booking/providers/google";
import type { BookingCreateInput } from "@/lib/booking/slots";
import { calculateEndTime } from "@/lib/booking/slots";
import { BOOKING } from "@/config/booking";
import { findExistingDelivery, upsertDeliveryAttempt, markDeliveryProcessing, markDeliveryDelivered, markDeliveryFailed } from "@/lib/booking/integration-delivery";
import { schedulePendingEmailDelivery } from "@/lib/email/notifications";

interface CreateBookingResult { appointment_id: string; start_time: string; end_time: string; timezone: string; status: "confirmed"; }
interface SafeBookingError { status: number; code: string; message: string; }
function mapRpcErrorCode(code: string): SafeBookingError | null { switch (code) { case "P0002": return { status: 404, code, message: "Lead or session not found" }; case "P0003": return { status: 403, code, message: "Session does not match lead" }; case "P0008": case "P0009": return { status: 409, code, message: "Already booked" }; case "P0010": return { status: 409, code, message: "Time slot is no longer available" }; case "P0011": return { status: 409, code, message: "Concurrent booking conflict" }; case "P0020": return { status: 409, code, message: "Duplicate booking request" }; default: return null; } }
interface RpcError { code?: string; message?: string; }
interface AppointmentRow { id: string; start_time: string; end_time: string; timezone: string; status: string; external_event_id: string | null; booking_event_id: string | null; lead_id?: string; session_id?: string; }
async function confirmAppointmentViaRpc(params: { appointmentId: string; externalEventId: string; }): Promise<string> { const supabase = getServerSupabaseClient(); const { data, error } = await supabase.rpc("confirm_funnel_appointment", { p_appointment_id: params.appointmentId, p_external_event_id: params.externalEventId } as never); if (error) throw error; return data as string; }
async function failAppointmentViaRpc(params: { appointmentId: string; safeErrorCode: string; }): Promise<string> { const supabase = getServerSupabaseClient(); const { data, error } = await supabase.rpc("fail_funnel_appointment", { p_appointment_id: params.appointmentId, p_safe_error_code: params.safeErrorCode } as never); if (error) throw error; return data as string; }
async function getLeadInfo(appointmentId: string): Promise<{ full_name: string; email: string; phone: string; zip_code: string; booking_event_id: string | null; start_time: string; end_time: string; timezone: string; } | null> { const supabase = getServerSupabaseClient(); const { data, error } = await supabase.from("appointments").select("booking_event_id, start_time, end_time, timezone, lead_id").eq("id", appointmentId).single(); if (error || !data) return null; const row = data as Record<string, unknown>; const { data: leadData, error: leadError } = await supabase.from("leads").select("first_name, last_name, email, phone, zip_code").eq("id", row.lead_id as string).single(); if (leadError || !leadData) return null; const lead = leadData as Record<string, unknown>; const firstName = ((lead.first_name as string) ?? "").trim(); const lastName = ((lead.last_name as string) ?? "").trim(); return { full_name: `${firstName} ${lastName}`.trim(), email: (lead.email as string) ?? "", phone: (lead.phone as string) ?? "", zip_code: (lead.zip_code as string) ?? "", booking_event_id: (row.booking_event_id as string) ?? null, start_time: row.start_time as string, end_time: row.end_time as string, timezone: row.timezone as string }; }

export async function createBooking(input: BookingCreateInput): Promise<CreateBookingResult | SafeBookingError> {
  const { lead_id, session_id, start_time, timezone, event_id } = input; const end_time = calculateEndTime(start_time); const supabase = getServerSupabaseClient();
  const { data: existingConfirmed } = await supabase.from("appointments").select("id, lead_id, session_id, start_time, end_time, timezone, status, external_event_id").eq("booking_event_id", event_id).eq("status", "confirmed").maybeSingle();
  if (existingConfirmed) { const row = existingConfirmed as AppointmentRow; if (row.lead_id !== lead_id || row.session_id !== session_id || row.start_time !== start_time || row.end_time !== end_time || row.timezone !== timezone) return { status: 409, code: "EVENT_ID_MISMATCH", message: "Booking event ID already used with different booking data" }; return { appointment_id: row.id, start_time: row.start_time, end_time: row.end_time, timezone: row.timezone, status: "confirmed" }; }
  const { data: existingPending } = await supabase.from("appointments").select("id, start_time, end_time, timezone, status").eq("booking_event_id", event_id).eq("status", "pending").maybeSingle();
  if (existingPending) { const pendingRow = existingPending as AppointmentRow; const existingDelivery = await findExistingDelivery(pendingRow.id, "google_calendar"); if (existingDelivery && existingDelivery.status === "delivered" && existingDelivery.event_id) { const provider = createGoogleCalendarProvider(); const gcalEvent = await provider.getEvent(existingDelivery.event_id); if (gcalEvent) { const confirmedId = await confirmAppointmentViaRpc({ appointmentId: pendingRow.id, externalEventId: gcalEvent.external_event_id }); await markDeliveryDelivered({ deliveryId: existingDelivery.id }); return { appointment_id: confirmedId, start_time: pendingRow.start_time, end_time: pendingRow.end_time, timezone: pendingRow.timezone, status: "confirmed" }; } } }
  const { data: appointmentId, error: rpcError } = await supabase.rpc("create_funnel_appointment", { p_lead_id: lead_id, p_session_id: session_id, p_start_time: start_time, p_end_time: end_time, p_timezone: timezone, p_provider: "google_calendar", p_event_id: event_id, p_buffer_before: `${BOOKING.BUFFER_BEFORE_MINUTES} minutes`, p_buffer_after: `${BOOKING.BUFFER_AFTER_MINUTES} minutes` } as never);
  if (rpcError) { const mapped = (rpcError as RpcError).code ? mapRpcErrorCode((rpcError as RpcError).code!) : null; if (mapped) return mapped; return { status: 500, code: "RPC_FAILED", message: "Internal server error" }; }
  const appId = appointmentId as string; let deliveryId: string;
  try { deliveryId = await upsertDeliveryAttempt({ appointmentId: appId, eventId: event_id }); } catch (err) { console.error("[createBooking] delivery_create_failed appointment_id=%s error=%s", appId, err instanceof Error ? err.message : "unknown"); return { status: 500, code: "DELIVERY_CREATE_FAILED", message: "Internal server error" }; }
  try { await markDeliveryProcessing(deliveryId); } catch {}
  const leadInfo = await getLeadInfo(appId);
  if (!leadInfo) { try { await failAppointmentViaRpc({ appointmentId: appId, safeErrorCode: "LEAD_INFO_FAILED" }); await markDeliveryFailed({ deliveryId, safeErrorCode: "LEAD_INFO_FAILED" }); } catch {} return { status: 500, code: "LEAD_INFO_FAILED", message: "Internal server error" }; }
  const provider = createGoogleCalendarProvider(); let gcalResult: { external_event_id: string; html_link?: string; status: string; created_at?: string };
  try { gcalResult = await provider.createEvent({ summary: "Fusion 44X Pool Consultation", start: leadInfo.start_time, end: leadInfo.end_time, timezone: leadInfo.timezone, description: [`Name: ${leadInfo.full_name}`, `Email: ${leadInfo.email}`, `Phone: ${leadInfo.phone}`, `ZIP: ${leadInfo.zip_code}`].join("\n"), extendedProperties: { private: { appointmentId: appId, bookingEventId: event_id } } }); }
  catch (err) { console.error("[createBooking] gcal_create_failed appointment_id=%s error=%s", appId, err instanceof Error ? err.message : JSON.stringify(err)); try { await failAppointmentViaRpc({ appointmentId: appId, safeErrorCode: "GCAL_CREATE_FAILED" }); } catch {} const errObj = err as { code?: number; message?: string }; const safeCode = errObj && typeof errObj.code === "number" ? `GCAL_${errObj.code}` : "GCAL_ERROR"; try { await markDeliveryFailed({ deliveryId, safeErrorCode: safeCode }); } catch {} return { status: 502, code: safeCode, message: "Calendar provider error" }; }
  try {
    const confirmedId = await confirmAppointmentViaRpc({ appointmentId: appId, externalEventId: gcalResult.external_event_id });
    try { await markDeliveryDelivered({ deliveryId }); } catch {}
    try { const { getEmailProvider } = await import("@/lib/email/provider"); const { sendBookingConfirmation, prepareBookingConfirmation } = await import("@/lib/email/notifications"); const { sendInternalBookingNotification, prepareInternalBookingNotification } = await import("@/lib/email/internal-notifications"); const providerResult = getEmailProvider(); if (providerResult.provider) { const prepared = await prepareBookingConfirmation({ appointmentId: confirmedId }); if (prepared) await sendBookingConfirmation(prepared, providerResult.provider); const internalPrepared = await prepareInternalBookingNotification({ appointmentId: confirmedId }); if (internalPrepared) await sendInternalBookingNotification(internalPrepared, providerResult.provider); } else { await schedulePendingEmailDelivery({ appointmentId: confirmedId }); } } catch {}
    return { appointment_id: confirmedId, start_time: leadInfo.start_time, end_time: leadInfo.end_time, timezone: leadInfo.timezone, status: "confirmed" };
  } catch { const compensationResult = await compensateGcalEvent(gcalResult.external_event_id, appId, deliveryId); if (compensationResult === "compensated") return { status: 500, code: "DB_CONFIRM_FAILED", message: "Internal server error" }; return { status: 500, code: "DB_CONFIRM_FAILED", message: "Internal server error" }; }
}

type CompensationResult = "compensated" | "compensation_failed" | "appointment_fail_failed";
async function compensateGcalEvent(externalEventId: string, appointmentId: string, deliveryId: string): Promise<CompensationResult> { try { const provider = createGoogleCalendarProvider(); await provider.deleteEvent(externalEventId); } catch { try { await markDeliveryFailed({ deliveryId, safeErrorCode: "COMPENSATION_DELETE_FAILED" }); } catch {} try { const supabase = getServerSupabaseClient(); const { data: app } = await supabase.from("appointments").select("external_event_id").eq("id", appointmentId).single(); if (app && !(app as Record<string, unknown>).external_event_id) await supabase.from("appointments").update({ status: "pending" } as never).eq("id", appointmentId); } catch {} return "compensation_failed"; } try { await failAppointmentViaRpc({ appointmentId, safeErrorCode: "DB_CONFIRM_FAILED_COMPENSATED" }); } catch { console.error("appointment_id=%s safe_code=%s", appointmentId, "APPOINTMENT_FAIL_AFTER_COMPENSATION_FAILED"); try { await markDeliveryFailed({ deliveryId, safeErrorCode: "APPOINTMENT_FAIL_AFTER_COMPENSATION_FAILED" }); } catch {} return "appointment_fail_failed"; } try { await markDeliveryFailed({ deliveryId, safeErrorCode: "DB_CONFIRM_FAILED_COMPENSATED" }); } catch {} return "compensated"; }
```

> **Audit note:** As with `admin/queries.ts`, whitespace/line wrapping is compacted above; executable statements and logic are preserved.

### `src/lib/booking/index.ts`

```ts
/**
 * Booking integration scaffolding.
 *
 * Provider is stored as an enum/text value on appointments for future
 * calendar provider integration. The Google Calendar adapter will be
 * implemented in a separate branch.
 *
 * See docs/custom-booking.md for the integration plan.
 */
export type { BookingProvider } from "@/types/appointment";
```

### `src/lib/booking/integration-delivery.ts`

```ts
import { getServerSupabaseClient } from "@/lib/supabase";
type Destination = "google_calendar"; type EventType = "appointment_create"; type DeliveryStatus = "pending" | "processing" | "delivered" | "failed";
export interface DeliveryRecord { id: string; appointment_id: string; destination: Destination; event_type: EventType; event_id: string | null; status: DeliveryStatus; attempt_count: number; response_code: number | null; error_message: string | null; }
export async function findExistingDelivery(appointmentId: string, destination: Destination): Promise<DeliveryRecord | null> { const supabase = getServerSupabaseClient(); const { data, error } = await supabase.from("integration_deliveries").select("*").eq("appointment_id", appointmentId).eq("destination", destination).maybeSingle(); if (error) throw new Error(`Integration delivery lookup failed: ${error.code}`); return data as DeliveryRecord | null; }
export async function upsertDeliveryAttempt(params: { appointmentId: string; eventId: string | null; }): Promise<string> { const supabase = getServerSupabaseClient(); const existing = await findExistingDelivery(params.appointmentId, "google_calendar"); if (existing) return existing.id; const { data, error } = await supabase.from("integration_deliveries").insert({ appointment_id: params.appointmentId, destination: "google_calendar" as never, event_type: "appointment_create" as never, event_id: params.eventId, status: "pending" as never, attempt_count: 0, response_code: null, error_message: null } as never).select("id").single(); if (error) throw new Error(`Integration delivery insert failed: ${error.code}`); return (data as { id: string }).id; }
export async function markDeliveryProcessing(deliveryId: string): Promise<void> { const supabase = getServerSupabaseClient(); const { data: current } = await supabase.from("integration_deliveries").select("attempt_count").eq("id", deliveryId).single(); const nextCount = ((current as { attempt_count?: number } | null)?.attempt_count ?? 0) + 1; const { error } = await supabase.from("integration_deliveries").update({ status: "processing" as never, attempt_count: nextCount } as never).eq("id", deliveryId); if (error) throw new Error(`Failed to mark delivery processing: ${error.code}`); }
export async function markDeliveryDelivered(params: { deliveryId: string; responseCode?: number; }): Promise<void> { const supabase = getServerSupabaseClient(); const { error } = await supabase.from("integration_deliveries").update({ status: "delivered" as never, response_code: params.responseCode ?? null, delivered_at: new Date().toISOString(), last_attempt_at: new Date().toISOString() } as never).eq("id", params.deliveryId); if (error) throw new Error(`Failed to mark delivery delivered: ${error.code}`); }
export async function markDeliveryFailed(params: { deliveryId: string; safeErrorCode: string; responseCode?: number; }): Promise<void> { const supabase = getServerSupabaseClient(); const { error } = await supabase.from("integration_deliveries").update({ status: "failed" as never, error_message: params.safeErrorCode, response_code: params.responseCode ?? null, last_attempt_at: new Date().toISOString() } as never).eq("id", params.deliveryId); if (error) throw new Error(`Failed to mark delivery failed: ${error.code}`); }
```

### `src/lib/booking/providers/google/client.ts`

```ts
import "server-only";
import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import { requireGoogleCalendarEnv } from "@/lib/env";
import type { CalendarProvider, CalendarEventResult, CreateEventInput } from "../types";
import { createEventSchema } from "../types";
export function normalizePrivateKey(key: string): string { return key.replace(/\\n/g, "\n"); }
function createAuthClient(env: { serviceAccountEmail: string; serviceAccountPrivateKey: string }) { const key = normalizePrivateKey(env.serviceAccountPrivateKey); return new google.auth.JWT({ email: env.serviceAccountEmail, key, scopes: ["https://www.googleapis.com/auth/calendar.events"] }); }
function mapGcalStatus(status: string): string { switch (status) { case "confirmed": return "confirmed"; case "tentative": return "pending"; case "cancelled": return "cancelled"; default: return status; } }
interface GcalError { code?: number; message?: string; errors?: Array<{ message?: string; domain?: string; reason?: string }>; }
function normalizeError(err: unknown): { code: number; message: string } { const gcalErr = err as GcalError; if (gcalErr?.code && gcalErr?.message) return { code: gcalErr.code, message: gcalErr.message }; if (err instanceof Error) return { code: 500, message: err.message }; return { code: 500, message: "Unknown Google Calendar error" }; }
function toCalendarEventResult(data: calendar_v3.Schema$Event): CalendarEventResult { return { external_event_id: data.id ?? "", html_link: data.htmlLink ?? undefined, status: mapGcalStatus(data.status ?? "confirmed"), created_at: data.created ?? undefined }; }
export function createGoogleCalendarProvider(): CalendarProvider { const env = requireGoogleCalendarEnv(); const auth = createAuthClient(env); const calendar = google.calendar({ version: "v3", auth }); const calendarId = env.calendarId; return { async createEvent(input: CreateEventInput) { const parsed = createEventSchema.parse(input); try { const response = await calendar.events.insert({ calendarId, requestBody: { summary: parsed.summary, description: parsed.description, start: { dateTime: parsed.start, timeZone: parsed.timezone }, end: { dateTime: parsed.end, timeZone: parsed.timezone }, extendedProperties: parsed.extendedProperties as calendar_v3.Schema$Event["extendedProperties"] | undefined } }); const data = response.data; if (!data.id) throw new Error("Google Calendar event created without an ID"); return toCalendarEventResult(data); } catch (err) { throw normalizeError(err); } }, async getEvent(externalEventId: string) { try { const response = await calendar.events.get({ calendarId, eventId: externalEventId }); const data = response.data; if (!data.id) return null; return toCalendarEventResult(data); } catch (err) { const normalized = normalizeError(err); if (normalized.code === 404) return null; throw normalized; } }, async deleteEvent(externalEventId: string) { try { await calendar.events.delete({ calendarId, eventId: externalEventId }); } catch (err) { const normalized = normalizeError(err); if (normalized.code === 404) return; throw normalized; } } }; }
```

### `src/lib/booking/providers/google/index.ts`
```ts
export { createGoogleCalendarProvider } from "./client";
export { normalizePrivateKey } from "./client";
```

### `src/lib/booking/providers/index.ts`
```ts
export type { CalendarProvider, CalendarEventResult, CreateEventInput } from "./types";
export { createEventSchema } from "./types";
```

### `src/lib/booking/providers/types.ts`
```ts
import { z } from "zod";
export const createEventSchema = z.object({ summary: z.string().min(1).max(256), start: z.string().datetime({ offset: true }), end: z.string().datetime({ offset: true }), timezone: z.string().min(1).max(64), description: z.string().optional(), extendedProperties: z.object({ private: z.record(z.string(), z.string()).optional() }).optional() });
export type CreateEventInput = z.infer<typeof createEventSchema>;
export interface CalendarEventResult { external_event_id: string; html_link?: string; status: string; created_at?: string; }
export interface CalendarProvider { createEvent(input: CreateEventInput): Promise<CalendarEventResult>; getEvent(externalEventId: string): Promise<CalendarEventResult | null>; deleteEvent(externalEventId: string): Promise<void>; }
```

### `src/lib/booking/slots.ts`

```ts
import { z } from "zod";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { BOOKING, WORKING_HOURS, WORKING_DAYS, BLOCKED_DATES } from "@/config/booking";
import type { SupabaseClient } from "@supabase/supabase-js";
export const availabilityQuerySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format"), timezone: z.string().min(1).max(64).default(BOOKING.TIMEZONE) });
export type AvailabilityQuery = z.input<typeof availabilityQuerySchema>;
export const bookingCreateSchema = z.object({ lead_id: z.string().uuid(), session_id: z.string().uuid(), start_time: z.string().datetime({ message: "start_time must be ISO 8601" }), timezone: z.string().min(1).max(64), event_id: z.string().uuid() });
export type BookingCreateInput = z.input<typeof bookingCreateSchema>;
export { BOOKING, WORKING_HOURS, WORKING_DAYS, BLOCKED_DATES };
function getDateComponents(dateStr: string): { y: number; m: number; d: number } | null { const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!match) return null; return { y: parseInt(match[1]), m: parseInt(match[2]), d: parseInt(match[3]) }; }
function getNextDateStr(dateStr: string): string | null { const comps = getDateComponents(dateStr); if (!comps) return null; const d = new Date(Date.UTC(comps.y, comps.m - 1, comps.d + 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`; }
export function getLocalMidnightMs(dateStr: string, timezone: string): number { const comps = getDateComponents(dateStr); if (!comps) return NaN; try { return fromZonedTime(`${dateStr}T00:00:00`, timezone).getTime(); } catch { return NaN; } }
export function getDayBoundariesUtc(dateStr: string, timezone: string): { dayStartUtc: string; dayEndUtc: string } | null { const comps = getDateComponents(dateStr); if (!comps) return null; const nextDateStr = getNextDateStr(dateStr); if (!nextDateStr) return null; try { return { dayStartUtc: fromZonedTime(`${dateStr}T00:00:00`, timezone).toISOString(), dayEndUtc: fromZonedTime(`${nextDateStr}T00:00:00`, timezone).toISOString() }; } catch { return null; } }
function getDayOfWeekInZone(dateStr: string, timezone: string): number { const comps = getDateComponents(dateStr); if (!comps) return -1; try { return fromZonedTime(`${dateStr}T00:00:00`, timezone).getUTCDay(); } catch { return -1; } }
export function calculateEndTime(startTimeIso: string): string { const start = new Date(startTimeIso); return new Date(start.getTime() + BOOKING.APPOINTMENT_DURATION_MINUTES * 60 * 1000).toISOString(); }
export function generateTimeSlots(dateStr: string, timezone: string): Array<{ start: string; end: string; label: string }> { const slots: Array<{ start: string; end: string; label: string }> = []; const comps = getDateComponents(dateStr); if (!comps) return slots; const dayOfWeek = getDayOfWeekInZone(dateStr, timezone); if (!WORKING_DAYS.includes(dayOfWeek) || BLOCKED_DATES.includes(dateStr)) return slots; const durationMin = BOOKING.APPOINTMENT_DURATION_MINUTES; const durationMs = durationMin * 60000; let slotStartMinutes = WORKING_HOURS.start * 60; const workEndMinutes = WORKING_HOURS.end * 60; while (slotStartMinutes + durationMin + BOOKING.BUFFER_AFTER_MINUTES <= workEndMinutes) { const h = Math.floor(slotStartMinutes / 60); const m = slotStartMinutes % 60; const slotStartUtc = fromZonedTime(`${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`, timezone); const slotEndUtc = new Date(slotStartUtc.getTime() + durationMs); slots.push({ start: slotStartUtc.toISOString(), end: slotEndUtc.toISOString(), label: formatTimeLabel(slotStartUtc, timezone) }); slotStartMinutes += BOOKING.SLOT_INTERVAL_MINUTES; } return slots; }
export function isSlotInPast(slotStartIso: string, minimumNoticeHours: number): boolean { return new Date(slotStartIso).getTime() <= Date.now() + minimumNoticeHours * 3600000; }
export function isWithinBookingWindow(dateStr: string): boolean { const comps = getDateComponents(dateStr); if (!comps) return false; const todayStr = formatInTimeZone(new Date(), BOOKING.TIMEZONE, "yyyy-MM-dd"); const todayComps = getDateComponents(todayStr); if (!todayComps) return false; const diffDays = Math.round((fromZonedTime(`${dateStr}T00:00:00`, BOOKING.TIMEZONE).getTime() - fromZonedTime(`${todayStr}T00:00:00`, BOOKING.TIMEZONE).getTime()) / 86400000); return diffDays >= 0 && diffDays <= BOOKING.BOOKING_WINDOW_DAYS; }
export function isWorkingDay(dateStr: string, timezone: string): boolean { return WORKING_DAYS.includes(getDayOfWeekInZone(dateStr, timezone)); }
export function isBlockedDate(dateStr: string): boolean { return BLOCKED_DATES.includes(dateStr); }
export function isExactSlot(startTimeIso: string, dateStr: string, timezone: string): boolean { return generateTimeSlots(dateStr, timezone).some((s) => s.start === startTimeIso); }
export async function isSlotAvailable(startTimeIso: string, endTimeIso: string, supabase: SupabaseClient): Promise<boolean> { const windowStart = new Date(new Date(startTimeIso).getTime() - BOOKING.BUFFER_BEFORE_MINUTES * 60000).toISOString(); const windowEnd = new Date(new Date(endTimeIso).getTime() + BOOKING.BUFFER_AFTER_MINUTES * 60000).toISOString(); const { data, error } = await supabase.from("appointments").select("id").in("status", ["pending", "confirmed"]).lt("start_time", windowEnd).gt("end_time", windowStart).maybeSingle(); if (error) throw new Error(`Availability check failed: ${error.code}`); return data === null; }
export function validateTimezone(timezone: string): boolean { try { Intl.DateTimeFormat(undefined, { timeZone: timezone }); return true; } catch { return false; } }
function formatTimeLabel(date: Date, timezone: string): string { return formatInTimeZone(date, timezone, "h:mm a"); }
export function formatDateLabel(dateStr: string): string { const comps = getDateComponents(dateStr); if (!comps) return dateStr; return new Date(Date.UTC(comps.y, comps.m - 1, comps.d, 12, 0, 0)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }); }
```

### Email module source files

The complete email implementation is included below. It covers durable delivery records, customer/internal notifications, retry, fake/Resend providers, send-input construction, and templates.

#### `src/lib/email/delivery.ts`
```ts
import "server-only";
import { getServerSupabaseClient } from "@/lib/supabase";
type EmailDeliveryStatus = "pending" | "processing" | "delivered" | "failed" | "dead_letter";
export interface EmailDeliveryRecord { id: string; appointment_id: string; destination: "email"; event_type: "booking_confirmation"; event_id: string | null; status: EmailDeliveryStatus; attempt_count: number; template_version: string; provider_message_id: string | null; error_message: string | null; next_attempt_at: string | null; }
interface ClaimResult { claimed: boolean; delivery?: EmailDeliveryRecord; }
export async function findEmailDelivery(appointmentId: string, templateVersion: string): Promise<EmailDeliveryRecord | null> { const supabase = getServerSupabaseClient(); const { data, error } = await supabase.from("integration_deliveries").select("*").eq("appointment_id", appointmentId).eq("destination", "email").eq("event_type", "booking_confirmation").eq("template_version", templateVersion).maybeSingle(); if (error) throw new Error(`Email delivery lookup failed: ${error.code}`); return data as EmailDeliveryRecord | null; }
export async function findEmailDeliveryById(deliveryId: string): Promise<EmailDeliveryRecord | null> { const supabase = getServerSupabaseClient(); const { data, error } = await supabase.from("integration_deliveries").select("*").eq("id", deliveryId).eq("destination", "email").eq("event_type", "booking_confirmation").maybeSingle(); if (error) { if (error.code === "PGRST116") return null; throw new Error(`Email delivery lookup by ID failed: ${error.code}`); } return data as EmailDeliveryRecord | null; }
export async function createPendingEmailDelivery(params: { appointmentId: string; bookingEventId: string | null; templateVersion: string; }): Promise<string> { const supabase = getServerSupabaseClient(); const existing = await findEmailDelivery(params.appointmentId, params.templateVersion); if (existing) return existing.id; const { data, error } = await supabase.from("integration_deliveries").insert({ appointment_id: params.appointmentId, destination: "email" as never, event_type: "booking_confirmation" as never, event_id: params.bookingEventId, status: "pending" as never, attempt_count: 0, template_version: params.templateVersion, provider_message_id: null, error_message: null, next_attempt_at: null } as never).select("id").single(); if (error) { if (error.code === "23505") { const retry = await findEmailDelivery(params.appointmentId, params.templateVersion); if (retry) return retry.id; } throw new Error(`Email delivery insert failed: ${error.code}`); } return (data as { id: string }).id; }
export async function claimEmailDelivery(deliveryId: string, maxAttempts = 5): Promise<ClaimResult> { const supabase = getServerSupabaseClient(); const { data, error } = await supabase.rpc("claim_email_delivery", { p_delivery_id: deliveryId, p_max_attempts: maxAttempts } as never); if (error) throw new Error(`Claim email delivery failed: ${error.code}`); const rows = data as EmailDeliveryRecord[]; if (!rows || rows.length === 0) return { claimed: false }; return { claimed: true, delivery: rows[0] }; }
export async function markEmailDeliveryDelivered(params: { deliveryId: string; providerMessageId?: string; }): Promise<void> { const supabase = getServerSupabaseClient(); const { error } = await supabase.rpc("mark_email_delivery_delivered", { p_delivery_id: params.deliveryId, p_provider_message_id: params.providerMessageId ?? null } as never); if (error) throw new Error(`Failed to mark email delivery delivered: ${error.code}`); }
export async function markEmailDeliveryFailed(params: { deliveryId: string; safeErrorCode: string; retryable: boolean; }): Promise<void> { const supabase = getServerSupabaseClient(); const { error } = await supabase.rpc("mark_email_delivery_failed", { p_delivery_id: params.deliveryId, p_safe_error_code: params.safeErrorCode, p_retryable: params.retryable } as never); if (error) throw new Error(`Failed to mark email delivery failed: ${error.code}`); }
```

#### `src/lib/email/index.ts`
```ts
import type { Lead } from "@/types/lead";
import { requireEmailEnv } from "@/lib/env";
export interface EmailPayload { to: string; subject: string; html: string; }
export interface EmailAdapter { send(payload: EmailPayload): Promise<{ id: string }>; sendLeadNotification(lead: Lead): Promise<{ id: string }>; sendBookingConfirmation(params: { lead: Lead; appointmentTime: string; }): Promise<{ id: string }>; }
let activeAdapter: EmailAdapter | null = null;
export function registerEmailAdapter(adapter: EmailAdapter): void { activeAdapter = adapter; }
export function getEmailAdapter(): EmailAdapter { if (!activeAdapter) throw new Error("No email adapter registered. Call registerEmailAdapter first."); return activeAdapter; }
export function createEmailAdapter(): EmailAdapter { const env = requireEmailEnv(); throw new Error(`Email adapter not implemented. ` + `From address detected: ${env.fromAddress}. ` + `Implement the adapter in src/lib/email/index.ts.`); }
```

#### `src/lib/email/internal-delivery.ts`
```ts
import "server-only";
import { getServerSupabaseClient } from "@/lib/supabase";
type EmailDeliveryStatus = "pending" | "processing" | "delivered" | "failed" | "dead_letter";
export interface InternalEmailDeliveryRecord { id: string; appointment_id: string; destination: "email"; event_type: "internal_booking_notification"; event_id: string | null; status: EmailDeliveryStatus; attempt_count: number; template_version: string; provider_message_id: string | null; error_message: string | null; next_attempt_at: string | null; }
interface ClaimResult { claimed: boolean; delivery?: InternalEmailDeliveryRecord; }
export async function findInternalEmailDelivery(appointmentId: string, templateVersion: string): Promise<InternalEmailDeliveryRecord | null> { const supabase = getServerSupabaseClient(); const { data, error } = await supabase.from("integration_deliveries").select("*").eq("appointment_id", appointmentId).eq("destination", "email").eq("event_type", "internal_booking_notification").eq("template_version", templateVersion).maybeSingle(); if (error) throw new Error(`Internal email delivery lookup failed: ${error.code}`); return data as InternalEmailDeliveryRecord | null; }
export async function findInternalEmailDeliveryById(deliveryId: string): Promise<InternalEmailDeliveryRecord | null> { const supabase = getServerSupabaseClient(); const { data, error } = await supabase.from("integration_deliveries").select("*").eq("id", deliveryId).eq("destination", "email").eq("event_type", "internal_booking_notification").maybeSingle(); if (error) { if (error.code === "PGRST116") return null; throw new Error(`Internal email delivery lookup by ID failed: ${error.code}`); } return data as InternalEmailDeliveryRecord | null; }
export async function createPendingInternalEmailDelivery(params: { appointmentId: string; bookingEventId: string | null; templateVersion: string; }): Promise<string> { const supabase = getServerSupabaseClient(); const existing = await findInternalEmailDelivery(params.appointmentId, params.templateVersion); if (existing) return existing.id; const { data, error } = await supabase.from("integration_deliveries").insert({ appointment_id: params.appointmentId, destination: "email" as never, event_type: "internal_booking_notification" as never, event_id: params.bookingEventId, status: "pending" as never, attempt_count: 0, template_version: params.templateVersion, provider_message_id: null, error_message: null, next_attempt_at: null } as never).select("id").single(); if (error) { if (error.code === "23505") { const existing2 = await findInternalEmailDelivery(params.appointmentId, params.templateVersion); if (existing2) return existing2.id; } throw new Error(`Internal email delivery insert failed: ${error.code}`); } return (data as { id: string }).id; }
export async function claimInternalEmailDelivery(deliveryId: string, maxAttempts = 5): Promise<ClaimResult> { const supabase = getServerSupabaseClient(); const { data, error } = await supabase.rpc("claim_email_delivery", { p_delivery_id: deliveryId, p_max_attempts: maxAttempts } as never); if (error) throw new Error(`Claim internal email delivery failed: ${error.code}`); const rows = data as InternalEmailDeliveryRecord[]; if (!rows || rows.length === 0) return { claimed: false }; return { claimed: true, delivery: rows[0] }; }
export async function markInternalEmailDeliveryDelivered(params: { deliveryId: string; providerMessageId?: string; }): Promise<void> { const supabase = getServerSupabaseClient(); const { error } = await supabase.rpc("mark_email_delivery_delivered", { p_delivery_id: params.deliveryId, p_provider_message_id: params.providerMessageId ?? null } as never); if (error) throw new Error(`Failed to mark internal email delivery delivered: ${error.code}`); }
export async function markInternalEmailDeliveryFailed(params: { deliveryId: string; safeErrorCode: string; retryable: boolean; }): Promise<void> { const supabase = getServerSupabaseClient(); const { error } = await supabase.rpc("mark_email_delivery_failed", { p_delivery_id: params.deliveryId, p_safe_error_code: params.safeErrorCode, p_retryable: params.retryable } as never); if (error) throw new Error(`Failed to mark internal email delivery failed: ${error.code}`); }
```

#### `src/lib/email/internal-notifications.ts`
```ts
import "server-only";
import { EMAIL_CONFIG } from "@/config/email";
import type { EmailProvider, SendEmailResult, ProviderError } from "@/lib/email/provider/types";
import { findInternalEmailDelivery, createPendingInternalEmailDelivery, claimInternalEmailDelivery, markInternalEmailDeliveryDelivered, markInternalEmailDeliveryFailed } from "@/lib/email/internal-delivery";
import { buildInternalBookingNotificationSendInput } from "./internal-send-input";
import type { InternalDiagnosticLabels } from "./templates/internal-booking-notification";
import { answerLabel, answerLabels } from "@/lib/funnel/answer-labels";
export type InternalNotificationType = "contact_submission" | "booking_confirmation";
export interface PreparedInternalNotification { notificationType: InternalNotificationType; appointmentId: string; leadId: string; recipientEmail: string; customerFirstName: string; customerEmail: string; customerPhone: string | null; preferredContactMethod?: string | null; confirmedStartTime: string; confirmedEndTime: string; timezone: string; bookingEventId: string | null; googleCalendarEventId: string | null; diagnostic: InternalDiagnosticLabels | null; }
export type SendInternalNotificationStatus = "delivered" | "in_progress" | "not_due" | "max_attempts" | "dead_letter" | "prepared" | "disabled";
export interface SendInternalNotificationResult { deliveryId: string; status: SendInternalNotificationStatus; messageId?: string; }
export type SendInternalNotificationError = ProviderError;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export async function prepareInternalBookingNotification(params: { appointmentId: string; }): Promise<PreparedInternalNotification | null> { const supabase = (await import("@/lib/supabase")).getServerSupabaseClient(); const { data: appointment, error: appError } = await supabase.from("appointments").select("id, lead_id, status, start_time, end_time, timezone, booking_event_id, external_event_id").eq("id", params.appointmentId).single(); if (appError || !appointment) return null; const row = appointment as Record<string, unknown>; if (row.status !== "confirmed") return null; const leadId = row.lead_id as string; const { data: lead, error: leadError } = await supabase.from("leads").select("first_name, email, phone, water_feature, installation_type, pool_size, current_treatment, primary_goal").eq("id", leadId).single(); if (leadError || !lead) return null; const leadRow = lead as Record<string, unknown>; const customerEmail = (leadRow.email as string) ?? ""; const customerFirstName = ((leadRow.first_name as string) ?? "").trim(); const customerPhone = (leadRow.phone as string)?.trim() ?? null; if (!EMAIL_REGEX.test(customerEmail)) return null; const { data: answerRows } = await supabase.from("lead_answers").select("answer_code").eq("lead_id", leadId).eq("question_id", "current-issues"); const currentIssues = ((answerRows ?? []) as Record<string, unknown>[]).map((a) => (a.answer_code as string) ?? ""); const diagnostic: InternalDiagnosticLabels = { waterFeature: answerLabel("water-feature", (leadRow.water_feature as string) ?? ""), installationType: answerLabel("installation-type", (leadRow.installation_type as string) ?? ""), poolSize: answerLabel("pool-size", (leadRow.pool_size as string) ?? ""), currentTreatment: answerLabel("current-treatment", (leadRow.current_treatment as string) ?? ""), primaryGoal: answerLabel("primary-goal", (leadRow.primary_goal as string) ?? ""), currentIssues: answerLabels("current-issues", currentIssues) }; const internalRecipient = process.env.INTERNAL_BOOKING_NOTIFICATION_TO?.trim(); if (!internalRecipient || !EMAIL_REGEX.test(internalRecipient)) return null; return { notificationType: "booking_confirmation", appointmentId: row.id as string, leadId, recipientEmail: internalRecipient, customerFirstName, customerEmail, customerPhone, confirmedStartTime: row.start_time as string, confirmedEndTime: row.end_time as string, timezone: (row.timezone as string) || EMAIL_CONFIG.TIMEZONE, bookingEventId: (row.booking_event_id as string) ?? null, googleCalendarEventId: (row.external_event_id as string) ?? null, diagnostic }; }
export async function sendInternalBookingNotification(prepared: PreparedInternalNotification, provider: EmailProvider): Promise<SendInternalNotificationResult | SendInternalNotificationError> { const { appointmentId, recipientEmail, bookingEventId } = prepared; if (!EMAIL_REGEX.test(recipientEmail)) return { code: "INVALID_RECIPIENT", message: "Invalid internal notification recipient email address", retryable: false }; const templateVersion = "1.0.0"; const existingDelivery = await findInternalEmailDelivery(appointmentId, templateVersion); if (existingDelivery?.status === "delivered") return { deliveryId: existingDelivery.id, status: "delivered", messageId: existingDelivery.provider_message_id ?? undefined }; if (existingDelivery?.status === "processing") return { deliveryId: existingDelivery.id, status: "in_progress" }; if (existingDelivery?.status === "dead_letter") return { deliveryId: existingDelivery.id, status: "dead_letter" }; if (existingDelivery && existingDelivery.attempt_count >= 5) return { deliveryId: existingDelivery.id, status: "max_attempts" }; if (existingDelivery?.next_attempt_at && new Date(existingDelivery.next_attempt_at) > new Date()) return { deliveryId: existingDelivery.id, status: "not_due" }; let deliveryId: string; if (existingDelivery) deliveryId = existingDelivery.id; else { try { deliveryId = await createPendingInternalEmailDelivery({ appointmentId, bookingEventId, templateVersion }); } catch { const retryDelivery = await findInternalEmailDelivery(appointmentId, templateVersion); if (retryDelivery) deliveryId = retryDelivery.id; else return { code: "DELIVERY_CREATE_FAILED", message: "Failed to create internal delivery record", retryable: false }; } } const claim = await claimInternalEmailDelivery(deliveryId); if (!claim.claimed || !claim.delivery) { const fresh = await findInternalEmailDelivery(appointmentId, templateVersion); if (!fresh) return { deliveryId, status: "in_progress" }; if (fresh.status === "delivered") return { deliveryId: fresh.id, status: "delivered", messageId: fresh.provider_message_id ?? undefined }; if (fresh.status === "processing") return { deliveryId: fresh.id, status: "in_progress" }; if (fresh.status === "dead_letter") return { deliveryId: fresh.id, status: "dead_letter" }; if (fresh.attempt_count >= 5) return { deliveryId: fresh.id, status: "max_attempts" }; if (fresh.next_attempt_at && new Date(fresh.next_attempt_at) > new Date()) return { deliveryId: fresh.id, status: "not_due" }; return { deliveryId, status: "in_progress" }; } const sendInput = buildInternalBookingNotificationSendInput(prepared, deliveryId); let result: SendEmailResult; try { result = await provider.sendInternalBookingNotification(sendInput); } catch (err) { const error = err as { code?: string; message?: string; retryable?: boolean }; const safeCode = error?.code ?? "PROVIDER_ERROR"; const retryable = error?.retryable !== false; await markInternalEmailDeliveryFailed({ deliveryId, safeErrorCode: safeCode, retryable }); return { code: safeCode, message: error?.message ?? "Email provider error", retryable }; } await markInternalEmailDeliveryDelivered({ deliveryId, providerMessageId: result.messageId }); return { deliveryId, status: "delivered", messageId: result.messageId }; }
export async function sendContactSubmissionInternalNotification(params: { leadId: string; customerFirstName: string; customerEmail: string; customerPhone?: string | null; preferredContactMethod?: string | null; diagnostic: InternalDiagnosticLabels | null; }, provider: EmailProvider): Promise<void> { const internalRecipient = process.env.INTERNAL_BOOKING_NOTIFICATION_TO?.trim(); if (!internalRecipient || !EMAIL_REGEX.test(internalRecipient)) return; const prepared: PreparedInternalNotification = { notificationType: "contact_submission", appointmentId: params.leadId, leadId: params.leadId, recipientEmail: internalRecipient, customerFirstName: params.customerFirstName, customerEmail: params.customerEmail, customerPhone: params.customerPhone ?? null, preferredContactMethod: params.preferredContactMethod ?? null, confirmedStartTime: "", confirmedEndTime: "", timezone: EMAIL_CONFIG.TIMEZONE, bookingEventId: null, googleCalendarEventId: null, diagnostic: params.diagnostic }; try { const sendInput = buildInternalBookingNotificationSendInput(prepared, `contact-${params.leadId}`); await provider.sendInternalBookingNotification(sendInput); } catch {} }
export async function schedulePendingInternalEmailDelivery(params: { appointmentId: string; }): Promise<string | null> { const prepared = await prepareInternalBookingNotification(params); if (!prepared) return null; const templateVersion = "1.0.0"; const existingDelivery = await findInternalEmailDelivery(params.appointmentId, templateVersion); if (existingDelivery && existingDelivery.status !== "failed") return existingDelivery.id; try { return await createPendingInternalEmailDelivery({ appointmentId: params.appointmentId, bookingEventId: prepared.bookingEventId, templateVersion }); } catch { return null; } }
```

#### `src/lib/email/internal-retry.ts`
```ts
import "server-only";
import type { EmailProvider, ProviderError } from "@/lib/email/provider/types";
import { prepareInternalBookingNotification } from "@/lib/email/internal-notifications";
import { findInternalEmailDeliveryById, claimInternalEmailDelivery, markInternalEmailDeliveryDelivered, markInternalEmailDeliveryFailed } from "@/lib/email/internal-delivery";
import { buildInternalBookingNotificationSendInput } from "@/lib/email/internal-send-input";
export interface RetryConfig { maxAttempts: number; baseBackoffMs: number; maxBackoffMs: number; }
const INTERNAL_EMAIL_RETRY_CONFIG: RetryConfig = { maxAttempts: 5, baseBackoffMs: 60_000, maxBackoffMs: 3_600_000 };
export interface RetryResult { deliveryId: string; status: "delivered" | "failed" | "skipped"; messageId?: string; error?: ProviderError; }
export async function retryFailedInternalEmailDelivery(params: { deliveryId: string; provider: EmailProvider; config?: Partial<RetryConfig>; }): Promise<RetryResult> { const cfg = { ...INTERNAL_EMAIL_RETRY_CONFIG, ...params.config }; const delivery = await findInternalEmailDeliveryById(params.deliveryId); if (!delivery) return { deliveryId: params.deliveryId, status: "skipped" }; if (delivery.status === "delivered") return { deliveryId: params.deliveryId, status: "delivered" }; if (delivery.status === "dead_letter" || delivery.status === "processing" || delivery.attempt_count >= cfg.maxAttempts) return { deliveryId: params.deliveryId, status: "skipped" }; if (delivery.next_attempt_at && new Date(delivery.next_attempt_at) > new Date()) return { deliveryId: params.deliveryId, status: "skipped" }; if (delivery.error_message && ["INVALID_RECIPIENT", "INVALID_TEMPLATE", "PROVIDER_REJECTED", "INVALID_CONFIG"].includes(delivery.error_message)) return { deliveryId: params.deliveryId, status: "skipped" }; if (delivery.status !== "pending" && delivery.status !== "failed") return { deliveryId: params.deliveryId, status: "skipped" }; const claim = await claimInternalEmailDelivery(params.deliveryId, cfg.maxAttempts); if (!claim.claimed || !claim.delivery) return { deliveryId: params.deliveryId, status: "skipped" }; const prepared = await prepareInternalBookingNotification({ appointmentId: claim.delivery.appointment_id }); if (!prepared) { await markInternalEmailDeliveryFailed({ deliveryId: params.deliveryId, safeErrorCode: "APPOINTMENT_NOT_CONFIRMED", retryable: false }); return { deliveryId: params.deliveryId, status: "failed", error: { code: "APPOINTMENT_NOT_CONFIRMED", message: "Appointment no longer confirmed", retryable: false } }; } if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prepared.recipientEmail)) { await markInternalEmailDeliveryFailed({ deliveryId: params.deliveryId, safeErrorCode: "INVALID_RECIPIENT", retryable: false }); return { deliveryId: params.deliveryId, status: "failed", error: { code: "INVALID_RECIPIENT", message: "Invalid recipient email", retryable: false } }; } try { const sendInput = buildInternalBookingNotificationSendInput(prepared, params.deliveryId); const result = await params.provider.sendInternalBookingNotification(sendInput); await markInternalEmailDeliveryDelivered({ deliveryId: params.deliveryId, providerMessageId: result.messageId }); return { deliveryId: params.deliveryId, status: "delivered", messageId: result.messageId }; } catch (err) { const error = err as { code?: string; message?: string; retryable?: boolean }; const safeCode = error?.code ?? "PROVIDER_ERROR"; const retryable = error?.retryable !== false; await markInternalEmailDeliveryFailed({ deliveryId: params.deliveryId, safeErrorCode: safeCode, retryable }); return { deliveryId: params.deliveryId, status: "failed", error: { code: safeCode, message: error?.message ?? "Email provider error", retryable } }; } }
```

#### `src/lib/email/internal-send-input.ts`
```ts
import "server-only";
import { renderInternalBookingNotificationHtml, renderInternalBookingNotificationText } from "@/lib/email/templates/internal-booking-notification";
import type { PreparedInternalNotification } from "./internal-notifications";
import type { SendEmailInput } from "./provider/types";
export function buildInternalBookingNotificationSendInput(prepared: PreparedInternalNotification, deliveryId: string): SendEmailInput { const customerPhone = prepared.customerPhone ?? undefined; const googleCalendarEventId = prepared.googleCalendarEventId ?? undefined; const html = renderInternalBookingNotificationHtml({ customerFirstName: prepared.customerFirstName, customerEmail: prepared.customerEmail, customerPhone, preferredContactMethod: prepared.preferredContactMethod, confirmedStartTime: prepared.confirmedStartTime, confirmedEndTime: prepared.confirmedEndTime, timezone: prepared.timezone, appointmentId: prepared.appointmentId, googleCalendarEventId, diagnostic: prepared.diagnostic ?? undefined }); const text = renderInternalBookingNotificationText({ customerFirstName: prepared.customerFirstName, customerEmail: prepared.customerEmail, customerPhone, preferredContactMethod: prepared.preferredContactMethod, confirmedStartTime: prepared.confirmedStartTime, confirmedEndTime: prepared.confirmedEndTime, timezone: prepared.timezone, appointmentId: prepared.appointmentId, googleCalendarEventId, diagnostic: prepared.diagnostic ?? undefined }); return { recipientEmail: prepared.recipientEmail, recipientFirstName: prepared.customerFirstName, appointmentId: prepared.appointmentId, deliveryId, confirmedStartTime: prepared.confirmedStartTime, confirmedEndTime: prepared.confirmedEndTime, timezone: prepared.timezone, googleCalendarLink: prepared.customerEmail, outlookCalendarLink: customerPhone ?? "", icsContent: googleCalendarEventId ?? "", preferredContactMethod: prepared.preferredContactMethod ?? undefined, html, text, replyTo: undefined, internalDiagnostic: prepared.diagnostic ?? undefined, internalNotificationType: prepared.notificationType }; }
```

#### `src/lib/email/notifications.ts`
```ts
import "server-only";
import { EMAIL_CONFIG } from "@/config/email";
import type { EmailProvider, SendEmailResult, ProviderError } from "@/lib/email/provider/types";
import { findEmailDelivery, createPendingEmailDelivery, claimEmailDelivery, markEmailDeliveryDelivered, markEmailDeliveryFailed } from "@/lib/email/delivery";
import { buildBookingConfirmationSendInput } from "./send-input";
export interface PreparedConfirmation { appointmentId: string; leadId: string; recipientEmail: string; recipientFirstName: string; confirmedStartTime: string; confirmedEndTime: string; timezone: string; bookingEventId: string | null; }
export type SendConfirmationStatus = "delivered" | "in_progress" | "not_due" | "max_attempts" | "dead_letter" | "prepared";
export interface SendConfirmationResult { deliveryId: string; status: SendConfirmationStatus; messageId?: string; }
export type SendConfirmationError = ProviderError;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export async function prepareBookingConfirmation(params: { appointmentId: string; }): Promise<PreparedConfirmation | null> { const supabase = (await import("@/lib/supabase")).getServerSupabaseClient(); const { data: appointment, error: appError } = await supabase.from("appointments").select("id, lead_id, status, start_time, end_time, timezone, booking_event_id").eq("id", params.appointmentId).single(); if (appError || !appointment) return null; const row = appointment as Record<string, unknown>; if (row.status !== "confirmed") return null; const leadId = row.lead_id as string; const { data: lead, error: leadError } = await supabase.from("leads").select("first_name, email").eq("id", leadId).single(); if (leadError || !lead) return null; const leadRow = lead as Record<string, unknown>; const email = (leadRow.email as string) ?? ""; const firstName = ((leadRow.first_name as string) ?? "").trim(); if (!EMAIL_REGEX.test(email)) return null; return { appointmentId: row.id as string, leadId, recipientEmail: email, recipientFirstName: firstName, confirmedStartTime: row.start_time as string, confirmedEndTime: row.end_time as string, timezone: (row.timezone as string) || EMAIL_CONFIG.TIMEZONE, bookingEventId: (row.booking_event_id as string) ?? null }; }
export async function sendBookingConfirmation(prepared: PreparedConfirmation, provider: EmailProvider): Promise<SendConfirmationResult | SendConfirmationError> { const { appointmentId, recipientEmail, bookingEventId } = prepared; if (!EMAIL_REGEX.test(recipientEmail)) return { code: "INVALID_RECIPIENT", message: "Invalid recipient email address", retryable: false }; const templateVersion = EMAIL_CONFIG.TEMPLATE_VERSION; const existingDelivery = await findEmailDelivery(appointmentId, templateVersion); if (existingDelivery?.status === "delivered") return { deliveryId: existingDelivery.id, status: "delivered", messageId: existingDelivery.provider_message_id ?? undefined }; if (existingDelivery?.status === "processing") return { deliveryId: existingDelivery.id, status: "in_progress" }; if (existingDelivery?.status === "dead_letter") return { deliveryId: existingDelivery.id, status: "dead_letter" }; if (existingDelivery && existingDelivery.attempt_count >= 5) return { deliveryId: existingDelivery.id, status: "max_attempts" }; if (existingDelivery?.next_attempt_at && new Date(existingDelivery.next_attempt_at) > new Date()) return { deliveryId: existingDelivery.id, status: "not_due" }; let deliveryId: string; if (existingDelivery) deliveryId = existingDelivery.id; else { try { deliveryId = await createPendingEmailDelivery({ appointmentId, bookingEventId, templateVersion }); } catch { const retryDelivery = await findEmailDelivery(appointmentId, templateVersion); if (retryDelivery) deliveryId = retryDelivery.id; else return { code: "DELIVERY_CREATE_FAILED", message: "Failed to create delivery record", retryable: false }; } } const claim = await claimEmailDelivery(deliveryId); if (!claim.claimed || !claim.delivery) { const fresh = await findEmailDelivery(appointmentId, templateVersion); if (!fresh) return { deliveryId, status: "in_progress" }; if (fresh.status === "delivered") return { deliveryId: fresh.id, status: "delivered", messageId: fresh.provider_message_id ?? undefined }; if (fresh.status === "processing") return { deliveryId: fresh.id, status: "in_progress" }; if (fresh.status === "dead_letter") return { deliveryId: fresh.id, status: "dead_letter" }; if (fresh.attempt_count >= 5) return { deliveryId: fresh.id, status: "max_attempts" }; if (fresh.next_attempt_at && new Date(fresh.next_attempt_at) > new Date()) return { deliveryId: fresh.id, status: "not_due" }; return { deliveryId, status: "in_progress" }; } const sendInput = buildBookingConfirmationSendInput(prepared, deliveryId); let result: SendEmailResult; try { result = await provider.sendBookingConfirmation(sendInput); } catch (err) { const error = err as { code?: string; message?: string; retryable?: boolean }; const safeCode = error?.code ?? "PROVIDER_ERROR"; const retryable = error?.retryable !== false; await markEmailDeliveryFailed({ deliveryId, safeErrorCode: safeCode, retryable }); return { code: safeCode, message: error?.message ?? "Email provider error", retryable }; } await markEmailDeliveryDelivered({ deliveryId, providerMessageId: result.messageId }); return { deliveryId, status: "delivered", messageId: result.messageId }; }
export async function schedulePendingEmailDelivery(params: { appointmentId: string; }): Promise<string | null> { const prepared = await prepareBookingConfirmation(params); if (!prepared) return null; const templateVersion = EMAIL_CONFIG.TEMPLATE_VERSION; const existingDelivery = await findEmailDelivery(params.appointmentId, templateVersion); if (existingDelivery && existingDelivery.status !== "failed") return existingDelivery.id; try { return await createPendingEmailDelivery({ appointmentId: params.appointmentId, bookingEventId: prepared.bookingEventId, templateVersion }); } catch { return null; } }
```

#### `src/lib/email/provider/fake-provider.ts`
```ts
import "server-only";
import crypto from "node:crypto";
import type { EmailProvider, SendEmailInput, SendEmailResult } from "./types";
export function createFakeEmailProvider(): EmailProvider { return { name: "fake", async sendBookingConfirmation(_input: SendEmailInput): Promise<SendEmailResult> { void _input; return { messageId: `fake-${crypto.randomUUID()}`, status: "delivered" }; }, async sendInternalBookingNotification(_input: SendEmailInput): Promise<SendEmailResult> { void _input; return { messageId: `fake-${crypto.randomUUID()}`, status: "delivered" }; } }; }
```

#### `src/lib/email/provider/index.ts`
```ts
export type { EmailProvider, SendEmailInput, SendEmailResult, ProviderError } from "./types";
export { createFakeEmailProvider } from "./fake-provider";
export { createResendEmailProvider } from "./resend-provider";
export { getEmailProvider, type ProviderResult } from "./provider-factory";
```

#### `src/lib/email/provider/provider-factory.ts`
```ts
import "server-only";
import type { EmailProvider } from "./types";
import { createResendEmailProvider } from "./resend-provider";
export type ProviderResult = { provider: EmailProvider; name: string } | { provider: null; name: null };
export function getEmailProvider(): ProviderResult { const providerName = process.env.EMAIL_PROVIDER?.trim().toLowerCase(); if (!providerName) return { provider: null, name: null }; if (providerName === "resend") return { provider: createResendEmailProvider(), name: "resend" }; throw new Error(`[email] Unknown EMAIL_PROVIDER "${providerName}". ` + `Supported values: "resend"`); }
```

#### `src/lib/email/provider/resend-provider.ts`
```ts
import "server-only";
import { Resend } from "resend";
import type { EmailProvider, SendEmailInput, SendEmailResult } from "./types";
import { renderBookingConfirmationHtml, renderBookingConfirmationText } from "@/lib/email/templates/booking-confirmation";
import { renderInternalBookingNotificationHtml, renderInternalBookingNotificationText } from "@/lib/email/templates/internal-booking-notification";
interface ResendSendParams { resend: Resend; fromAddress: string; to: string; subject: string; html: string; text: string; idempotencyKey: string; replyTo?: string; attachments?: { filename: string; content: string; contentType: string }[]; }
async function sendViaResend(params: ResendSendParams): Promise<SendEmailResult> { const { resend, fromAddress, to, subject, html, text, idempotencyKey, replyTo, attachments } = params; const headers: Record<string, string> = { "Idempotency-Key": idempotencyKey }; let data: { id?: string; error?: { message?: string; statusCode?: number } } | null = null; let error: Error | null = null; try { const response = await resend.emails.send({ from: fromAddress, to, replyTo, subject, html, text, ...(attachments && attachments.length > 0 ? { attachments } : {}), headers }); data = response.data; error = response.error as Error | null; } catch (err) { error = err instanceof Error ? err : new Error(String(err)); } if (error) { const statusCode = (error as { statusCode?: number }).statusCode ?? 0; const message = error.message ?? "Resend API error"; if (statusCode === 429) throw { code: "RATE_LIMITED", message, retryable: true }; if (statusCode >= 500 || statusCode === 0) throw { code: "PROVIDER_UNAVAILABLE", message, retryable: true }; if (statusCode === 400) { const lowerMessage = message.toLowerCase(); if (lowerMessage.includes("invalid")) throw { code: "INVALID_RECIPIENT", message, retryable: false }; if (lowerMessage.includes("unverified") || lowerMessage.includes("domain")) throw { code: "PROVIDER_REJECTED", message, retryable: false }; throw { code: "PROVIDER_REJECTED", message, retryable: false }; } if (statusCode === 401 || statusCode === 403) throw { code: "INVALID_CONFIG", message, retryable: false }; throw { code: "PROVIDER_ERROR", message, retryable: false }; } if (!data?.id) throw { code: "PROVIDER_ERROR", message: "No message ID returned from Resend", retryable: false }; return { messageId: data.id, status: "delivered" }; }
export function createResendEmailProvider(): EmailProvider { const apiKey = process.env.EMAIL_API_KEY; if (!apiKey) throw new Error("EMAIL_API_KEY is required for Resend provider"); const fromAddress = process.env.EMAIL_FROM; if (!fromAddress) throw new Error("EMAIL_FROM is required for Resend provider"); const resend = new Resend(apiKey); const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined; return { name: "resend", async sendBookingConfirmation(input: SendEmailInput): Promise<SendEmailResult> { const subject = `Booking Confirmed: ${input.recipientFirstName}'s Fusion 44X Pool Consultation`; const html = renderBookingConfirmationHtml({ recipientFirstName: input.recipientFirstName, confirmedStartTime: input.confirmedStartTime, confirmedEndTime: input.confirmedEndTime, timezone: input.timezone, googleCalendarLink: input.googleCalendarLink ?? "", outlookCalendarLink: input.outlookCalendarLink ?? "", icsContent: input.icsContent ?? "" }); const text = renderBookingConfirmationText({ recipientFirstName: input.recipientFirstName, confirmedStartTime: input.confirmedStartTime, confirmedEndTime: input.confirmedEndTime, timezone: input.timezone, googleCalendarLink: input.googleCalendarLink ?? "", outlookCalendarLink: input.outlookCalendarLink ?? "", icsContent: input.icsContent ?? "" }); const attachments = [{ filename: "fusion-44x-consultation.ics", content: input.icsContent ?? "", contentType: "text/calendar" }]; return sendViaResend({ resend, fromAddress, to: input.recipientEmail, subject, html, text, idempotencyKey: `booking-confirmation-${input.deliveryId}`, replyTo: input.replyTo?.trim() || replyTo, attachments }); }, async sendInternalBookingNotification(input: SendEmailInput): Promise<SendEmailResult> { const isContactSubmission = input.internalNotificationType === "contact_submission"; const subject = isContactSubmission ? `Lead Submitted — ${input.recipientFirstName}` : `Internal: New Booking — ${input.recipientFirstName} (${input.appointmentId})`; const html = renderInternalBookingNotificationHtml({ customerFirstName: input.recipientFirstName, customerEmail: input.googleCalendarLink ?? "", customerPhone: input.outlookCalendarLink || undefined, preferredContactMethod: isContactSubmission ? input.preferredContactMethod || undefined : undefined, confirmedStartTime: input.confirmedStartTime, confirmedEndTime: input.confirmedEndTime, timezone: input.timezone, appointmentId: input.appointmentId, googleCalendarEventId: input.icsContent || undefined, diagnostic: input.internalDiagnostic, notificationType: input.internalNotificationType }); const text = renderInternalBookingNotificationText({ customerFirstName: input.recipientFirstName, customerEmail: input.googleCalendarLink ?? "", customerPhone: input.outlookCalendarLink || undefined, preferredContactMethod: isContactSubmission ? input.preferredContactMethod || undefined : undefined, confirmedStartTime: input.confirmedStartTime, confirmedEndTime: input.confirmedEndTime, timezone: input.timezone, appointmentId: input.appointmentId, googleCalendarEventId: input.icsContent || undefined, diagnostic: input.internalDiagnostic, notificationType: input.internalNotificationType }); return sendViaResend({ resend, fromAddress, to: input.recipientEmail, subject, html, text, idempotencyKey: `internal-booking-notification-${input.deliveryId}`, replyTo: input.replyTo?.trim() || replyTo }); } }; }
```

#### `src/lib/email/provider/types.ts`
```ts
import "server-only";
import type { InternalDiagnosticLabels } from "@/lib/email/templates/internal-booking-notification";
export interface SendEmailInput { recipientEmail: string; recipientFirstName: string; appointmentId: string; internalNotificationType?: "contact_submission" | "booking_confirmation"; deliveryId: string; confirmedStartTime: string; confirmedEndTime: string; timezone: string; googleCalendarLink?: string; outlookCalendarLink?: string; icsContent?: string; preferredContactMethod?: string; html: string; text: string; replyTo?: string; internalDiagnostic?: InternalDiagnosticLabels; }
export interface SendEmailResult { messageId: string; status: "delivered"; }
export interface ProviderError { code: string; message: string; retryable: boolean; }
export interface EmailProvider { readonly name: string; sendBookingConfirmation(input: SendEmailInput): Promise<SendEmailResult>; sendInternalBookingNotification(input: SendEmailInput): Promise<SendEmailResult>; }
```

#### `src/lib/email/retry.ts`
```ts
import "server-only";
import type { EmailProvider, ProviderError } from "@/lib/email/provider/types";
import { prepareBookingConfirmation } from "@/lib/email/notifications";
import { findEmailDeliveryById, claimEmailDelivery, markEmailDeliveryDelivered, markEmailDeliveryFailed } from "@/lib/email/delivery";
import { buildBookingConfirmationSendInput } from "@/lib/email/send-input";
export interface RetryConfig { maxAttempts: number; baseBackoffMs: number; maxBackoffMs: number; }
const EMAIL_RETRY_CONFIG: RetryConfig = { maxAttempts: 5, baseBackoffMs: 60_000, maxBackoffMs: 3_600_000 };
export const RETRYABLE_CODES: readonly string[] = ["PROVIDER_UNAVAILABLE", "RATE_LIMITED", "TIMEOUT", "NETWORK_ERROR", "PROVIDER_ERROR"] as const;
export const TERMINAL_CODES: readonly string[] = ["INVALID_RECIPIENT", "INVALID_TEMPLATE", "PROVIDER_REJECTED", "INVALID_CONFIG"] as const;
export function isRetryable(code: string): boolean { return RETRYABLE_CODES.includes(code as typeof RETRYABLE_CODES[number]); }
export function isTerminal(code: string): boolean { return TERMINAL_CODES.includes(code as typeof TERMINAL_CODES[number]); }
export function getBackoffMs(attempt: number, config?: Partial<RetryConfig>): number { const cfg = { ...EMAIL_RETRY_CONFIG, ...config }; return Math.min(cfg.baseBackoffMs * Math.pow(2, attempt - 1), cfg.maxBackoffMs); }
export function getNextAttemptTimestamp(attempt: number, config?: Partial<RetryConfig>): string { return new Date(Date.now() + getBackoffMs(attempt, config)).toISOString(); }
export interface RetryResult { deliveryId: string; status: "delivered" | "failed" | "skipped"; messageId?: string; error?: ProviderError; }
export async function retryFailedEmailDelivery(params: { deliveryId: string; provider: EmailProvider; config?: Partial<RetryConfig>; }): Promise<RetryResult> { const cfg = { ...EMAIL_RETRY_CONFIG, ...params.config }; const delivery = await findEmailDeliveryById(params.deliveryId); if (!delivery) return { deliveryId: params.deliveryId, status: "skipped" }; if (delivery.status === "delivered") return { deliveryId: params.deliveryId, status: "delivered" }; if (delivery.status === "dead_letter" || delivery.status === "processing" || delivery.attempt_count >= cfg.maxAttempts) return { deliveryId: params.deliveryId, status: "skipped" }; if (delivery.next_attempt_at && new Date(delivery.next_attempt_at) > new Date()) return { deliveryId: params.deliveryId, status: "skipped" }; if (delivery.error_message && isTerminal(delivery.error_message)) return { deliveryId: params.deliveryId, status: "skipped" }; if (delivery.status !== "pending" && delivery.status !== "failed") return { deliveryId: params.deliveryId, status: "skipped" }; const claim = await claimEmailDelivery(params.deliveryId, cfg.maxAttempts); if (!claim.claimed || !claim.delivery) return { deliveryId: params.deliveryId, status: "skipped" }; const prepared = await prepareBookingConfirmation({ appointmentId: claim.delivery.appointment_id }); if (!prepared) { await markEmailDeliveryFailed({ deliveryId: params.deliveryId, safeErrorCode: "APPOINTMENT_NOT_CONFIRMED", retryable: false }); return { deliveryId: params.deliveryId, status: "failed", error: { code: "APPOINTMENT_NOT_CONFIRMED", message: "Appointment no longer confirmed", retryable: false } }; } if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prepared.recipientEmail)) { await markEmailDeliveryFailed({ deliveryId: params.deliveryId, safeErrorCode: "INVALID_RECIPIENT", retryable: false }); return { deliveryId: params.deliveryId, status: "failed", error: { code: "INVALID_RECIPIENT", message: "Invalid recipient email", retryable: false } }; } try { const sendInput = buildBookingConfirmationSendInput(prepared, params.deliveryId); const result = await params.provider.sendBookingConfirmation(sendInput); await markEmailDeliveryDelivered({ deliveryId: params.deliveryId, providerMessageId: result.messageId }); return { deliveryId: params.deliveryId, status: "delivered", messageId: result.messageId }; } catch (err) { const error = err as { code?: string; message?: string; retryable?: boolean }; const safeCode = error?.code ?? "PROVIDER_ERROR"; const retryable = error?.retryable !== false; await markEmailDeliveryFailed({ deliveryId: params.deliveryId, safeErrorCode: safeCode, retryable }); return { deliveryId: params.deliveryId, status: "failed", error: { code: safeCode, message: error?.message ?? "Email provider error", retryable: isRetryable(safeCode) } }; } }
```

#### `src/lib/email/send-input.ts`
```ts
import "server-only";
import { EMAIL_CONFIG } from "@/config/email";
import { generateGoogleCalendarUrl, generateOutlookWebUrl, generateIcsContent } from "@/lib/booking/calendar-links";
import { renderBookingConfirmationHtml, renderBookingConfirmationText } from "@/lib/email/templates/booking-confirmation";
import type { PreparedConfirmation } from "./notifications";
import type { SendEmailInput } from "./provider/types";
export function buildBookingConfirmationSendInput(prepared: PreparedConfirmation, deliveryId: string): SendEmailInput { const endTime = prepared.confirmedEndTime; const googleCalendarLink = generateGoogleCalendarUrl({ startTime: prepared.confirmedStartTime, endTime, title: EMAIL_CONFIG.CONSULTATION_TITLE }); const outlookCalendarLink = generateOutlookWebUrl({ startTime: prepared.confirmedStartTime, endTime, title: EMAIL_CONFIG.CONSULTATION_TITLE }); const icsContent = generateIcsContent({ startTime: prepared.confirmedStartTime, endTime, title: EMAIL_CONFIG.CONSULTATION_TITLE, organizer: EMAIL_CONFIG.REPLY_TO_PLACEHOLDER }); const html = renderBookingConfirmationHtml({ recipientFirstName: prepared.recipientFirstName, confirmedStartTime: prepared.confirmedStartTime, confirmedEndTime: endTime, timezone: prepared.timezone, googleCalendarLink, outlookCalendarLink, icsContent }); const text = renderBookingConfirmationText({ recipientFirstName: prepared.recipientFirstName, confirmedStartTime: prepared.confirmedStartTime, confirmedEndTime: endTime, timezone: prepared.timezone, googleCalendarLink, outlookCalendarLink, icsContent }); return { recipientEmail: prepared.recipientEmail, recipientFirstName: prepared.recipientFirstName, appointmentId: prepared.appointmentId, deliveryId, confirmedStartTime: prepared.confirmedStartTime, confirmedEndTime: endTime, timezone: prepared.timezone, googleCalendarLink, outlookCalendarLink, icsContent, html, text, replyTo: EMAIL_CONFIG.REPLY_TO_PLACEHOLDER }; }
```

#### `src/lib/email/templates/booking-confirmation.ts`

```ts
import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { EMAIL_CONFIG } from "@/config/email";
function escapeHtml(str: string): string { return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function formatDateInTimezone(iso: string, tz: string): string { return formatInTimeZone(new Date(iso), tz, "EEEE, MMMM d, yyyy"); }
function formatTimeInTimezone(iso: string, tz: string): string { return formatInTimeZone(new Date(iso), tz, "h:mm a"); }
function formatDurationMinutes(startIso: string, endIso: string): number { return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000); }
export interface BookingConfirmationTemplateParams { recipientFirstName: string; confirmedStartTime: string; confirmedEndTime: string; timezone: string; googleCalendarLink: string; outlookCalendarLink: string; icsContent: string; }
export function renderBookingConfirmationHtml(params: BookingConfirmationTemplateParams): string { const firstName = escapeHtml(params.recipientFirstName); const dateStr = formatDateInTimezone(params.confirmedStartTime, params.timezone); const startTimeStr = formatTimeInTimezone(params.confirmedStartTime, params.timezone); const endTimeStr = formatTimeInTimezone(params.confirmedEndTime, params.timezone); const durationMin = formatDurationMinutes(params.confirmedStartTime, params.confirmedEndTime); const tzDisplay = escapeHtml(params.timezone); const title = escapeHtml(EMAIL_CONFIG.CONSULTATION_TITLE); const company = escapeHtml(EMAIL_CONFIG.COMPANY_NAME); const phone = escapeHtml(EMAIL_CONFIG.SUPPORT_PHONE); const gcalHref = escapeHtml(params.googleCalendarLink); const ocalHref = escapeHtml(params.outlookCalendarLink); const icsDataUri = `data:text/calendar;charset=utf-8,${encodeURIComponent(params.icsContent)}`; return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Booking Confirmed</title></head><body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Helvetica,Arial,sans-serif"><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f4f4f5"><tr><td align="center" style="padding:24px 16px"><table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden"><tr><td style="padding:32px 24px 16px;text-align:center;background-color:#1e3a5f"><h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff">${title}</h1><p style="margin:8px 0 0;font-size:14px;color:#cbd5e1">Your consultation is confirmed</p></td></tr><tr><td style="padding:24px"><p style="margin:0 0 16px;font-size:16px;color:#1e293b">Hello ${firstName},</p><p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6">Your Fusion 44X pool consultation has been confirmed. We look forward to speaking with you.</p><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f8fafc;border-radius:6px;margin-bottom:24px"><tr><td style="padding:16px"><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%"><tr><td style="padding:4px 0;font-size:13px;color:#64748b;width:100px;vertical-align:top">Date</td><td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${dateStr}</td></tr><tr><td style="padding:4px 0;font-size:13px;color:#64748b;width:100px;vertical-align:top">Time</td><td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${startTimeStr} – ${endTimeStr}</td></tr><tr><td style="padding:4px 0;font-size:13px;color:#64748b;width:100px;vertical-align:top">Duration</td><td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${durationMin} minutes</td></tr><tr><td style="padding:4px 0;font-size:13px;color:#64748b;width:100px;vertical-align:top">Timezone</td><td style="padding:4px 0;font-size:14px;color:#1e293b;font-weight:600">${tzDisplay}</td></tr></table></td></tr></table><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px"><tr><td align="center" style="padding:4px"><a href="${gcalHref}" target="_blank" rel="noopener noreferrer">Add to Google Calendar</a></td></tr><tr><td align="center" style="padding:4px"><a href="${ocalHref}" target="_blank" rel="noopener noreferrer">Add to Outlook Calendar</a></td></tr><tr><td align="center" style="padding:4px"><a href="${icsDataUri}" target="_blank" rel="noopener noreferrer">Add to Apple / Other Calendar</a></td></tr></table><div><p>What to do next</p><p>Reply to this email and send a picture of your pool plus any additional information that might help us prepare for our call.</p><p>Reply to: support@fusion44x.com</p></div><p>If you need to reschedule or have any questions, please contact us.</p></td></tr><tr><td><p>${company} · ${phone}</p></td></tr></table></td></tr></table></body></html>`; }
export function renderBookingConfirmationText(params: BookingConfirmationTemplateParams): string { const dateStr = formatDateInTimezone(params.confirmedStartTime, params.timezone); const startTimeStr = formatTimeInTimezone(params.confirmedStartTime, params.timezone); const endTimeStr = formatTimeInTimezone(params.confirmedEndTime, params.timezone); const durationMin = formatDurationMinutes(params.confirmedStartTime, params.confirmedEndTime); return [`${EMAIL_CONFIG.CONSULTATION_TITLE} — Confirmed`, "", `Hello ${params.recipientFirstName},`, "", "Your Fusion 44X pool consultation has been confirmed.", "", `Date:     ${dateStr}`, `Time:     ${startTimeStr} – ${endTimeStr}`, `Duration: ${durationMin} minutes`, `Timezone: ${params.timezone}`, "", "Add to your calendar:", `Google Calendar: ${params.googleCalendarLink}`, `Outlook Calendar: ${params.outlookCalendarLink}`, `Apple/Other: Download the attached .ics file or use the link above.`, "", "What to do next", "Reply to this email and send a picture of your pool plus any additional information that might help us prepare for our call.", "Reply to: support@fusion44x.com", "", "If you need to reschedule or have any questions, please contact us.", "", `${EMAIL_CONFIG.COMPANY_NAME}`, `${EMAIL_CONFIG.SUPPORT_PHONE}`].join("\n"); }
```

> **Audit note:** Long HTML style attributes were compacted in the dump above. The template's data flow, dynamic fields, links, copy, and control logic are preserved; this subsection is not byte-for-byte whitespace-identical.

#### `src/lib/email/templates/internal-booking-notification.ts`
```ts
import "server-only";
import { formatInTimeZone } from "date-fns-tz";
function escapeHtml(str: string): string { return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function formatDateInTimezone(iso: string, tz: string): string { return formatInTimeZone(new Date(iso), tz, "EEEE, MMMM d, yyyy"); }
function formatTimeInTimezone(iso: string, tz: string): string { return formatInTimeZone(new Date(iso), tz, "h:mm a"); }
export interface InternalDiagnosticLabels { waterFeature: string; installationType: string; poolSize: string; currentTreatment: string; primaryGoal: string; currentIssues: string[]; }
export interface InternalBookingNotificationParams { customerFirstName: string; customerEmail: string; customerPhone?: string; preferredContactMethod?: string; confirmedStartTime: string; confirmedEndTime: string; timezone: string; appointmentId: string; googleCalendarEventId?: string; diagnostic?: InternalDiagnosticLabels; notificationType?: "contact_submission" | "booking_confirmation"; }
export function renderInternalBookingNotificationHtml(params: InternalBookingNotificationParams): string { const firstName = escapeHtml(params.customerFirstName); const email = escapeHtml(params.customerEmail); const phone = params.customerPhone ? escapeHtml(params.customerPhone) : null; const dateStr = formatDateInTimezone(params.confirmedStartTime, params.timezone); const startTimeStr = formatTimeInTimezone(params.confirmedStartTime, params.timezone); const endTimeStr = formatTimeInTimezone(params.confirmedEndTime, params.timezone); const tzDisplay = escapeHtml(params.timezone); const appointmentId = escapeHtml(params.appointmentId); const gcalEventId = params.googleCalendarEventId ? escapeHtml(params.googleCalendarEventId) : null; const preferredContactMethod = params.preferredContactMethod ? escapeHtml(params.preferredContactMethod) : null; const isContactSubmission = params.notificationType === "contact_submission"; const phoneLine = phone ? `<tr><td>Phone</td><td>${phone}</td></tr>` : ""; const gcalLine = gcalEventId ? `<tr><td>GCal Event ID</td><td>${gcalEventId}</td></tr>` : ""; const preferredContactLine = preferredContactMethod ? `<tr><td>Preferred Contact</td><td>${preferredContactMethod}</td></tr>` : ""; const diagnosticBlock = params.diagnostic ? buildDiagnosticBlock(params.diagnostic) : ""; return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>New Booking Notification</title></head><body><h1>${isContactSubmission ? "Lead Submitted — Internal Notification" : "New Booking — Internal Notification"}</h1><p>${isContactSubmission ? "A new lead submitted the contact form" : "A consultation has been confirmed"}</p><p>${isContactSubmission ? "A new Fusion 44X lead submitted their contact form and diagnostic answers." : "A new Fusion 44X pool consultation has been booked."}</p><table><tr><td>Customer</td><td>${firstName}</td></tr><tr><td>Email</td><td>${email}</td></tr>${phoneLine}${preferredContactLine}${isContactSubmission ? "" : `<tr><td>Date</td><td>${dateStr}</td></tr><tr><td>Time</td><td>${startTimeStr} – ${endTimeStr}</td></tr><tr><td>Timezone</td><td>${tzDisplay}</td></tr><tr><td>Appointment ID</td><td>${appointmentId}</td></tr>${gcalLine}`}</table>${diagnosticBlock}<p>${isContactSubmission ? "This notification is for internal tracking only. The customer has received a separate confirmation email." : "This notification is for internal tracking only. The customer has received a separate confirmation email with calendar links."}</p><p>Fusion 44X Internal System</p></body></html>`; }
function buildDiagnosticBlock(diagnostic: InternalDiagnosticLabels | undefined): string { if (!diagnostic) return ""; const rows = [["Water Feature", diagnostic.waterFeature], ["Installation Type", diagnostic.installationType], ["Pool Size", diagnostic.poolSize], ["Current Treatment", diagnostic.currentTreatment], ["Primary Goal", diagnostic.primaryGoal]].map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join(""); const issuesLine = diagnostic.currentIssues.length > 0 ? `<tr><td>Current Issues</td><td>${diagnostic.currentIssues.map(escapeHtml).join(", ")}</td></tr>` : ""; return `<table><tr><td><p>Pool Diagnostic</p><table>${rows}${issuesLine}</table></td></tr></table>`; }
export function renderInternalBookingNotificationText(params: InternalBookingNotificationParams): string { const dateStr = formatDateInTimezone(params.confirmedStartTime, params.timezone); const startTimeStr = formatTimeInTimezone(params.confirmedStartTime, params.timezone); const endTimeStr = formatTimeInTimezone(params.confirmedEndTime, params.timezone); const lines = ["New Booking — Internal Notification", "", "A new Fusion 44X pool consultation has been booked.", "", `Customer:     ${params.customerFirstName}`, `Email:        ${params.customerEmail}`]; if (params.customerPhone) lines.push(`Phone:        ${params.customerPhone}`); lines.push(`Date:         ${dateStr}`, `Time:         ${startTimeStr} – ${endTimeStr}`, `Timezone:     ${params.timezone}`, `Appointment:  ${params.appointmentId}`); if (params.googleCalendarEventId) lines.push(`GCal Event ID: ${params.googleCalendarEventId}`); if (params.diagnostic) { lines.push("", "Pool Diagnostic", `Water Feature:     ${params.diagnostic.waterFeature}`, `Installation Type: ${params.diagnostic.installationType}`, `Pool Size:         ${params.diagnostic.poolSize}`, `Current Treatment: ${params.diagnostic.currentTreatment}`, `Primary Goal:      ${params.diagnostic.primaryGoal}`); if (params.diagnostic.currentIssues.length > 0) lines.push(`Current Issues:    ${params.diagnostic.currentIssues.join(", ")}`); } lines.push("", "This notification is for internal tracking only.", params.notificationType === "contact_submission" ? "The customer has received a separate confirmation email." : "The customer has received a separate confirmation email with calendar links.", "", "Fusion 44X Internal System"); return lines.join("\n"); }
```

> **Audit note:** HTML style markup is compacted; dynamic behavior/copy/control logic is preserved.

### `src/lib/env.ts`

```ts
import { z } from "zod";
const publicEnvSchema = z.object({ NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"), NEXT_PUBLIC_SUPABASE_URL: z.string().default(""), NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().default(""), NEXT_PUBLIC_META_PIXEL_ID: z.string().optional() });
function parsePublicEnv(): z.infer<typeof publicEnvSchema> { const result = publicEnvSchema.safeParse({ NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID }); if (!result.success) { if (typeof window === "undefined") for (const issue of result.error.issues) console.warn("[env] %s: %s", issue.path.join("."), issue.message); return { NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000", NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "", NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID }; } return result.data; }
export const publicEnv = parsePublicEnv();
function requireVar(key: string, hint: string): string { const value = process.env[key]; if (!value || value.trim() === "") throw new Error(`[env] ${key} is not set.\n` + `  Required when: ${hint}\n` + `  Set in: .env.local (local), Vercel env vars (production)\n` + `  Reference: .env.example`); return value; }
export interface SupabaseServerEnv { url: string; serviceRoleKey: string; }
export interface MetaCapiEnv { accessToken: string; }
export interface GoogleCalendarEnv { calendarId: string; serviceAccountEmail: string; serviceAccountPrivateKey: string; }
export interface EmailEnv { apiKey: string; fromAddress: string; }
export function requireSupabaseServerEnv(): SupabaseServerEnv { const url = process.env.NEXT_PUBLIC_SUPABASE_URL || requireVar("NEXT_PUBLIC_SUPABASE_URL", "using Supabase server client (getServerClient)"); return { url, serviceRoleKey: requireVar("SUPABASE_SERVICE_ROLE_KEY", "using Supabase server client (getServerClient)") }; }
export function requireMetaCapiEnv(): MetaCapiEnv { return { accessToken: requireVar("META_CAPI_ACCESS_TOKEN", "sending Meta Conversions API events") }; }
export function requireGoogleCalendarEnv(): GoogleCalendarEnv { return { calendarId: requireVar("GOOGLE_CALENDAR_ID", "using Google Calendar booking provider"), serviceAccountEmail: requireVar("GOOGLE_SERVICE_ACCOUNT_EMAIL", "using Google Calendar booking provider"), serviceAccountPrivateKey: requireVar("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "using Google Calendar booking provider") }; }
export function requireEmailEnv(): EmailEnv { return { apiKey: requireVar("EMAIL_API_KEY", "sending email notifications"), fromAddress: requireVar("EMAIL_FROM", "sending email notifications") }; }
export function getBookingTimezone(): string { return process.env.BOOKING_TIMEZONE || "America/New_York"; }
export interface AdminAuthEnv { username: string; password: string; sessionSecret: string; }
export function requireAdminAuthEnv(): AdminAuthEnv { return { username: requireVar("ADMIN_DASHBOARD_USERNAME", "accessing the admin dashboard"), password: requireVar("ADMIN_DASHBOARD_PASSWORD", "accessing the admin dashboard"), sessionSecret: requireVar("ADMIN_DASHBOARD_SESSION_SECRET", "securing admin dashboard sessions (generate a random 32+ char string)") }; }
```

### `src/lib/funnel/answer-labels.ts`
```ts
import { diagnosticQuestions } from "@/config/funnel-questions";
type QuestionLabels = Record<string, string>; const QUESTION_LABELS: Record<string, QuestionLabels> = buildQuestionLabels();
function buildQuestionLabels(): Record<string, QuestionLabels> { const map: Record<string, QuestionLabels> = {}; for (const question of diagnosticQuestions) { const codes: QuestionLabels = {}; for (const option of question.options) codes[option.code] = option.label; map[question.id] = codes; } return map; }
export function answerLabel(questionId: string, code: string | null | undefined): string { if (!code) return "—"; return QUESTION_LABELS[questionId]?.[code] ?? code; }
export function answerLabels(questionId: string, codes: readonly string[] | null | undefined): string[] { if (!codes || codes.length === 0) return []; return codes.map((code) => answerLabel(questionId, code)); }
```

### `src/lib/funnel/api.ts`
```ts
import type { DiagnosticAnswers } from "@/types/funnel";
export interface LeadSubmitPayload { session_id: string; event_id?: string; contact: { first_name: string; last_name: string; email: string; phone: string; zip_code: string; preferred_contact_method?: "email" | "phone" | "text"; }; diagnostic: { water_feature: string; installation_type: string; pool_size: string; current_treatment: string; current_issues: string[]; primary_goal: string; }; consent: { consent_to_contact: boolean; marketing_consent: boolean; consent_text_version: string; }; source?: string; }
export async function submitLead(payload: LeadSubmitPayload): Promise<{ lead_id?: string; status: number; duplicate?: boolean }> { const response = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); if (response.status === 409) return { status: 409, duplicate: true }; if (!response.ok) return { status: response.status }; const data = (await response.json()) as { lead_id: string }; return { lead_id: data.lead_id, status: 201 }; }
export function buildLeadPayload(params: { session_id: string; first_name: string; last_name: string; email: string; phone: string; zip_code: string; preferred_contact_method?: "email" | "phone" | "text"; diagnostic_answers: DiagnosticAnswers; marketing_consent: boolean; source?: string; event_id?: string; }): LeadSubmitPayload { const da = params.diagnostic_answers; return { session_id: params.session_id, event_id: params.event_id, contact: { first_name: params.first_name, last_name: params.last_name, email: params.email, phone: params.phone, zip_code: params.zip_code, preferred_contact_method: params.preferred_contact_method }, diagnostic: { water_feature: da.water_feature ?? "", installation_type: da.installation_type ?? "", pool_size: da.pool_size ?? "", current_treatment: da.current_treatment ?? "", current_issues: da.current_issues ?? [], primary_goal: da.primary_goal ?? "" }, consent: { consent_to_contact: true, marketing_consent: params.marketing_consent, consent_text_version: "v1" }, source: params.source }; }
```

### `src/lib/funnel/booking-api.ts`
```ts
export interface BookingApiResponse { appointment_id?: string; start_time?: string; end_time?: string; timezone?: string; status?: string; error?: { status: number; message: string; code?: string }; }
export async function createBookingRequest(params: { lead_id: string; session_id: string; start_time: string; timezone: string; event_id: string; }): Promise<BookingApiResponse> { try { const response = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) }); const data = await response.json() as BookingApiResponse; if (!response.ok) return { error: data.error ?? { status: response.status, message: "Booking failed", code: "BOOKING_UNKNOWN" } }; return data; } catch { return { error: { status: 0, message: "Network error", code: "NETWORK_ERROR" } }; } }
export interface AvailabilitySlot { start: string; end: string; label: string; }
export interface AvailabilityResponse { slots: AvailabilitySlot[]; date: string; timezone: string; error?: { status: number; message: string }; }
export async function fetchAvailability(date: string, timezone: string): Promise<AvailabilityResponse> { try { const params = new URLSearchParams({ date, timezone }); const response = await fetch(`/api/availability?${params}`); const data = await response.json() as AvailabilityResponse; if (!response.ok) return { slots: [], date, timezone, error: data.error ?? { status: response.status, message: "Failed to load availability" } }; return data; } catch { return { slots: [], date, timezone, error: { status: 0, message: "Network error" } }; } }
```

### `src/lib/funnel/contact-validation.ts`
```ts
import { z } from "zod";
const textField = (max: number) => z.string().trim().min(1, "Required").max(max);
function normalizeContactFormData(data: Record<string, unknown>): Record<string, unknown> { const normalized = { ...data }; if (normalized.preferred_contact_method === "") delete normalized.preferred_contact_method; return normalized; }
export const contactFormSchema = z.object({ first_name: textField(100), last_name: textField(100), email: z.string().trim().max(320).email("Please enter a valid email address"), phone: z.string().trim().min(1, "Required").max(30).regex(/^[\d\s\-().+]+$/, "Phone can only contain digits, spaces, and the characters -().+"), zip_code: textField(20), preferred_contact_method: z.enum(["email", "phone", "text"]).optional(), consent_to_contact: z.literal(true, { message: "You must agree to be contacted to proceed" }), marketing_consent: z.boolean().optional() });
export type ContactFormData = z.input<typeof contactFormSchema>;
export function validateContactForm(data: Record<string, unknown>): { valid: boolean; errors: Record<string, string> } { const result = contactFormSchema.safeParse(normalizeContactFormData(data)); if (result.success) return { valid: true, errors: {} }; const errors: Record<string, string> = {}; for (const issue of result.error.issues) { const path = issue.path.join("."); if (!errors[path]) errors[path] = issue.message; } return { valid: false, errors }; }
export function isContactFormReady(data: Record<string, unknown>): boolean { return validateContactForm(data).valid; }
```

### `src/lib/funnel/funnel-context-test.tsx`
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createInitialState, funnelReducer } from "./funnel-reducer";
import { FUNNEL_STEPS } from "@/types/funnel";
const localStore = new Map<string, string>(); const sessionStore = new Map<string, string>();
const mockLocalStorage = { getItem: vi.fn((key: string) => localStore.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { localStore.set(key, value); }), removeItem: vi.fn((key: string) => { localStore.delete(key); }), clear: vi.fn(() => localStore.clear()), get length() { return localStore.size; }, key: vi.fn((index: number) => Array.from(localStore.keys())[index] ?? null) };
const mockSessionStorage = { getItem: vi.fn((key: string) => sessionStore.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { sessionStore.set(key, value); }), removeItem: vi.fn((key: string) => { sessionStore.delete(key); }), clear: vi.fn(() => sessionStore.clear()), get length() { return sessionStore.size; }, key: vi.fn((index: number) => Array.from(sessionStore.keys())[index] ?? null) };
beforeEach(() => { localStore.clear(); sessionStore.clear(); vi.clearAllMocks(); globalThis.localStorage = mockLocalStorage as unknown as Storage; globalThis.sessionStorage = mockSessionStorage as unknown as Storage; globalThis.window = {} as unknown as Window & typeof globalThis; globalThis.crypto = { randomUUID: vi.fn(() => "crypto-uuid-123") } as unknown as Crypto; });
describe("funnelReducer HYDRATE action", () => { it("restores all persisted fields", () => { const state = funnelReducer(createInitialState(), { type: "HYDRATE", payload: { current_step: FUNNEL_STEPS.POOL_DIAGNOSTIC, session_id: "session-abc", lead_id: "lead-xyz", diagnostic_answers: { water_feature: "pool" }, diag_current_index: 2 } }); expect(state.current_step).toBe(FUNNEL_STEPS.POOL_DIAGNOSTIC); expect(state.session_id).toBe("session-abc"); expect(state.lead_id).toBe("lead-xyz"); expect(state.diagnostic_answers).toEqual({ water_feature: "pool" }); expect(state.diag_current_index).toBe(2); expect(state.hydration_ready).toBe(true); }); it("restores diag_current_index of 0 correctly", () => { const state = funnelReducer(createInitialState(), { type: "HYDRATE", payload: { diag_current_index: 0 } }); expect(state.diag_current_index).toBe(0); expect(state.hydration_ready).toBe(true); }); it("leaves defaults intact when payload is empty", () => { const initial = createInitialState(); const state = funnelReducer(initial, { type: "HYDRATE", payload: {} }); expect(state.current_step).toBe(initial.current_step); expect(state.session_id).toBeNull(); expect(state.lead_id).toBeNull(); expect(state.diagnostic_answers).toEqual({}); expect(state.hydration_ready).toBe(true); }); it("sets hydration_ready to true", () => { const state = funnelReducer(createInitialState(), { type: "HYDRATE", payload: { current_step: FUNNEL_STEPS.BOOKING } }); expect(state.hydration_ready).toBe(true); }); });
```

### `src/lib/funnel/funnel-context.tsx`

```tsx
"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DiagnosticAnswers, FunnelState, FunnelStepId, DiagnosticQuestionId, BookingErrorCode } from "@/types/funnel";
import { FUNNEL_STEPS } from "@/types/funnel";
import { InternalEvents } from "@/config/tracking-events";
import { funnelReducer, createInitialState, type FunnelAction } from "./funnel-reducer";
import {
  getDiagnosticAnswers,
  getDiagIndex,
  getSessionId,
  getCurrentStep,
  getLeadId,
  getSelectedDate,
  getSelectedSlotStart,
  getSelectedSlotEnd,
  saveDiagnosticAnswers,
  saveDiagIndex,
  saveCurrentStep,
  saveLeadId,
  saveSelectedDate,
  saveSelectedSlotEnd,
  saveSelectedSlotStart,
  getPersistedQuestionAnswer,
  saveBookingStep,
  clearSessionData,
} from "./persistence";
import { initializeSession } from "./session";
import { createTracker, type Tracker } from "@/lib/analytics/tracker";
import { submitLead as submitLeadApi, buildLeadPayload } from "./api";
import { validateContactForm, type ContactFormData } from "./contact-validation";
import { diagnosticQuestions } from "@/config/funnel-questions";
import { createBookingRequest } from "./booking-api";
import { MetaEvents } from "@/config/tracking-events";

interface FunnelContextValue {
      try {
        const payload = buildLeadPayload({
          session_id: sessionId,
          event_id: metaEventId,
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone,
          zip_code: data.zip_code,
          preferred_contact_method: data.preferred_contact_method,
          diagnostic_answers: state.diagnostic_answers,
          marketing_consent: data.marketing_consent ?? false,
          source: params.source,
        });
        let attempt = 0;
        let success = false;
        let lastResult: { lead_id?: string; status: number; duplicate?: boolean } | null = null;
        let lastErrorMessage: string | null = null;
        while (attempt < 3 && !success) {
          attempt += 1;
          try {
            lastResult = await submitLeadApi(payload);
            if (lastResult.duplicate) { dispatch({ type: "CONTACT_SUBMIT_DUPLICATE" }); success = true; break; }
            if (lastResult.lead_id) {
              if (tracker) tracker.track(InternalEvents.LEAD_CREATED, { step_id: FUNNEL_STEPS.CONTACT_INFORMATION, lead_id: lastResult.lead_id });
              dispatch({ type: "CONTACT_SUBMIT_SUCCESS", lead_id: lastResult.lead_id, first_name: data.first_name, email: data.email });
              dispatch({ type: "COMPLETE_STEP", step: FUNNEL_STEPS.CONTACT_INFORMATION });
              dispatch({ type: "GO_TO_STEP", step: FUNNEL_STEPS.BOOKING });
              saveBookingStep(FUNNEL_STEPS.BOOKING);
              success = true;
              break;
            }
            if (lastResult.status >= 400 && lastResult.status < 500) { console.warn("[submitContact] API returned client error status=%d", lastResult.status); break; }
            console.warn("[submitContact] transient API status=%d attempt=%d", lastResult.status, attempt);
            lastErrorMessage = `status:${lastResult.status}`;
          } catch (err) { console.warn("[submitContact] network attempt=%d error=", attempt, err); lastErrorMessage = String(err ?? "unknown"); }
          if (!success && attempt < 3) await new Promise((r) => setTimeout(r, 300 * attempt));
        }
        if (!success) {
          console.warn("[submitContact] all attempts failed", lastResult);
          if (tracker) tracker.track(InternalEvents.CONTACT_SUBMIT_FAILED, { metadata: { attempts: attempt, last_status: lastResult?.status ?? null, last_error: lastErrorMessage } });
          try { void fetch("/api/metrics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "contact_submit_failed_total", labels: { attempts: attempt, last_status: lastResult?.status ?? null } }), keepalive: true }); } catch {}
          dispatch({ type: "CONTACT_SUBMIT_ERROR" });
        }
      } catch (err) { console.warn("[submitContact] unexpected error", err); dispatch({ type: "CONTACT_SUBMIT_ERROR" }); }
  const hasTrackedContactView = useRef(false);
  const hasCompletedDiagnosticRef = useRef(false);
  const prevQuestionRef = useRef<string | null>(null);
  const prevStepRef = useRef<FunnelStepId | null>(null);
  const hasTrackedCalendarView = useRef(false);
  const hasTrackedConfirmationView = useRef(false);
  const bookingCompletedRef = useRef(false);

  useEffect(() => {
    const answers = getDiagnosticAnswers(); const index = getDiagIndex(); const sessionId = getSessionId(); const step = getCurrentStep(); const leadId = getLeadId(); const selectedDate = getSelectedDate(); const selectedSlotStart = getSelectedSlotStart(); const selectedSlotEnd = getSelectedSlotEnd(); let validStep = step;
    if ((step === FUNNEL_STEPS.BOOKING || step === FUNNEL_STEPS.CONFIRMATION) && !leadId) validStep = FUNNEL_STEPS.POOL_DIAGNOSTIC;
    if (step === FUNNEL_STEPS.CONFIRMATION && !leadId) validStep = FUNNEL_STEPS.POOL_DIAGNOSTIC;
    if (step === FUNNEL_STEPS.BOOKING && !sessionId) validStep = FUNNEL_STEPS.POOL_DIAGNOSTIC;
    if (step === FUNNEL_STEPS.CONTACT_INFORMATION && !isDiagnosticComplete(answers)) validStep = FUNNEL_STEPS.POOL_DIAGNOSTIC;
    if (validStep !== step) clearSessionData();
    dispatch({ type: "HYDRATE", payload: { ...(answers ? { diagnostic_answers: answers } : {}), ...(typeof index === "number" ? { diag_current_index: index } : {}), ...(sessionId ? { session_id: sessionId } : {}), ...(validStep ? { current_step: validStep } : {}), ...(leadId ? { lead_id: leadId } : {}), ...(validStep === FUNNEL_STEPS.BOOKING && selectedDate ? { selected_date: selectedDate } : {}), ...(validStep === FUNNEL_STEPS.BOOKING && selectedSlotStart ? { selected_slot_start: selectedSlotStart } : {}), ...(validStep === FUNNEL_STEPS.BOOKING && selectedSlotEnd ? { selected_slot_end: selectedSlotEnd } : {}) } });
  }, []);
  useEffect(() => { if (sessionInitRef.current) return; sessionInitRef.current = true; initializeSession().then((result) => { if (result) { dispatch({ type: "SET_SESSION", session_id: result.session_id }); const t = createTracker({ session_id: result.session_id }); setTracker(t); } }); }, []);
  useEffect(() => { if (tracker && !hasTrackedPageView.current && state.hydration_ready) { hasTrackedPageView.current = true; tracker.track(InternalEvents.PAGE_VIEWED, { step_id: state.current_step }); } }, [tracker, state.current_step, state.hydration_ready]);
  useEffect(() => { if (state.hydration_ready) saveDiagnosticAnswers(state.diagnostic_answers); }, [state.diagnostic_answers, state.hydration_ready]);
  useEffect(() => { if (state.hydration_ready) saveDiagIndex(state.diag_current_index); }, [state.diag_current_index, state.hydration_ready]);
  useEffect(() => { if (state.hydration_ready) saveCurrentStep(state.current_step); }, [state.current_step, state.hydration_ready]);
  useEffect(() => { if (state.hydration_ready && state.lead_id) saveLeadId(state.lead_id); }, [state.lead_id, state.hydration_ready]);
  useEffect(() => { if (state.hydration_ready) saveSelectedDate(state.selected_date); }, [state.selected_date, state.hydration_ready]);
  useEffect(() => { if (state.hydration_ready) { saveSelectedSlotStart(state.selected_slot_start); saveSelectedSlotEnd(state.selected_slot_end); } }, [state.selected_slot_start, state.selected_slot_end, state.hydration_ready]);
  useEffect(() => { if (tracker && !hasTrackedCalendarView.current && state.current_step === FUNNEL_STEPS.BOOKING) { hasTrackedCalendarView.current = true; tracker.track(InternalEvents.CALENDAR_VIEWED, { step_id: FUNNEL_STEPS.BOOKING }); } }, [tracker, state.current_step]);
  useEffect(() => { if (tracker && !hasTrackedConfirmationView.current && state.current_step === FUNNEL_STEPS.CONFIRMATION) { hasTrackedConfirmationView.current = true; tracker.track(InternalEvents.CONFIRMATION_VIEWED, { step_id: FUNNEL_STEPS.CONFIRMATION }); } }, [tracker, state.current_step]);
  useEffect(() => { if (tracker && !hasTrackedDiagStart.current && state.current_step === FUNNEL_STEPS.POOL_DIAGNOSTIC) { hasTrackedDiagStart.current = true; tracker.track(InternalEvents.DIAGNOSTIC_STARTED, { step_id: FUNNEL_STEPS.POOL_DIAGNOSTIC }); } }, [tracker, state.current_step]);
  useEffect(() => { if (!tracker || state.current_step !== FUNNEL_STEPS.POOL_DIAGNOSTIC) return; const q = diagnosticQuestions[state.diag_current_index]; if (!q) return; if (prevQuestionRef.current !== q.id) { prevQuestionRef.current = q.id; tracker.track(InternalEvents.QUESTION_VIEWED, { step_id: FUNNEL_STEPS.POOL_DIAGNOSTIC, question_id: q.id }); } }, [tracker, state.diag_current_index, state.current_step]);
  useEffect(() => { if (tracker && !hasTrackedContactView.current && state.current_step === FUNNEL_STEPS.CONTACT_INFORMATION) { hasTrackedContactView.current = true; tracker.track(InternalEvents.CONTACT_STEP_VIEWED, { step_id: FUNNEL_STEPS.CONTACT_INFORMATION }); } }, [tracker, state.current_step]);
  useEffect(() => { if ((state.current_step === FUNNEL_STEPS.CONTACT_INFORMATION || state.current_step === FUNNEL_STEPS.BOOKING || state.current_step === FUNNEL_STEPS.CONFIRMATION) && prevStepRef.current !== state.current_step) { const el = document.getElementById("funnel-viewport"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); } prevStepRef.current = state.current_step; }, [state.current_step]);
  const goToStep = useCallback((step: FunnelStepId) => { dispatch({ type: "GO_TO_STEP", step }); }, []);
  const answerSingle = useCallback((question_id: DiagnosticQuestionId, code: string) => { const prev = getPersistedQuestionAnswer(question_id, state.diagnostic_answers); dispatch({ type: "ANSWER_SINGLE", question_id, code }); if (tracker) { if (prev !== undefined && prev !== code) tracker.track(InternalEvents.QUESTION_CHANGED, { step_id: FUNNEL_STEPS.POOL_DIAGNOSTIC, question_id, answer_code: code }); tracker.track(InternalEvents.QUESTION_ANSWERED, { step_id: FUNNEL_STEPS.POOL_DIAGNOSTIC, question_id, answer_code: code }); } }, [state.diagnostic_answers, tracker]);
  const answerMultiToggle = useCallback((question_id: DiagnosticQuestionId, code: string) => { const prev = state.diagnostic_answers.current_issues ?? []; const wasSelected = prev.includes(code as never); dispatch({ type: "ANSWER_MULTI_TOGGLE", question_id, code }); if (tracker) tracker.track(wasSelected ? InternalEvents.QUESTION_CHANGED : InternalEvents.QUESTION_ANSWERED, { step_id: FUNNEL_STEPS.POOL_DIAGNOSTIC, question_id, answer_code: code }); }, [state.diagnostic_answers, tracker]);
  const diagNext = useCallback(() => { dispatch({ type: "DIAG_NEXT" }); }, []); const diagBack = useCallback(() => { dispatch({ type: "DIAG_BACK" }); }, []);
  const isCurrentQuestionAnswered = useCallback((): boolean => { const q = diagnosticQuestions[state.diag_current_index]; if (!q) return false; const answer = getPersistedQuestionAnswer(q.id, state.diagnostic_answers); if (answer === undefined || answer === null) return false; if (q.type === "multi-select" && Array.isArray(answer)) return answer.length > 0; return typeof answer === "string" && answer.length > 0; }, [state.diag_current_index, state.diagnostic_answers]);
  const isDiagValid = useCallback((): boolean => diagnosticQuestions.every((q) => { const answer = getPersistedQuestionAnswer(q.id, state.diagnostic_answers); if (q.type === "multi-select") return Array.isArray(answer) && answer.length > 0; return typeof answer === "string" && answer.length > 0; }), [state.diagnostic_answers]);
  const diagProgress = { current: state.diag_current_index + 1, total: diagnosticQuestions.length };
  const submitContact = useCallback(async (data: ContactFormData) => { let sessionId = state.session_id; if (!sessionId) { const retried = await initializeSession(); if (retried) { sessionId = retried.session_id; dispatch({ type: "SET_SESSION", session_id: sessionId }); if (!tracker) setTracker(createTracker({ session_id: sessionId })); } else { dispatch({ type: "CONTACT_SUBMIT_ERROR" }); return; } } const validation = validateContactForm(data as unknown as Record<string, unknown>); if (!validation.valid) { dispatch({ type: "SET_VALIDATION_ERRORS", errors: validation.errors }); if (tracker) tracker.track(InternalEvents.VALIDATION_ERROR, { step_id: FUNNEL_STEPS.CONTACT_INFORMATION, metadata: { fields: Object.keys(validation.errors) } }); return; } dispatch({ type: "CONTACT_SUBMIT_START" }); const da = state.diagnostic_answers; if (!da.water_feature || !da.installation_type || !da.pool_size || !da.current_treatment || !da.current_issues || da.current_issues.length === 0 || !da.primary_goal) { console.warn("[submitContact] diagnostic answers incomplete", da); dispatch({ type: "CONTACT_SUBMIT_ERROR" }); return; } if (tracker) tracker.track(InternalEvents.CONTACT_SUBMITTED, { step_id: FUNNEL_STEPS.CONTACT_INFORMATION }); let metaEventId: string; try { metaEventId = crypto.randomUUID(); } catch { metaEventId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`; } fbqTrack(MetaEvents.CONTACT, metaEventId, { content_name: "Lead Contact Form" }); try { const payload = buildLeadPayload({ session_id: sessionId, event_id: metaEventId, first_name: data.first_name, last_name: data.last_name, email: data.email, phone: data.phone, zip_code: data.zip_code, preferred_contact_method: data.preferred_contact_method, diagnostic_answers: state.diagnostic_answers, marketing_consent: data.marketing_consent ?? false }); const result = await submitLeadApi(payload); if (result.duplicate) dispatch({ type: "CONTACT_SUBMIT_DUPLICATE" }); else if (result.lead_id) { if (tracker) tracker.track(InternalEvents.LEAD_CREATED, { step_id: FUNNEL_STEPS.CONTACT_INFORMATION, lead_id: result.lead_id }); dispatch({ type: "CONTACT_SUBMIT_SUCCESS", lead_id: result.lead_id, first_name: data.first_name, email: data.email }); dispatch({ type: "COMPLETE_STEP", step: FUNNEL_STEPS.CONTACT_INFORMATION }); dispatch({ type: "GO_TO_STEP", step: FUNNEL_STEPS.BOOKING }); saveBookingStep(FUNNEL_STEPS.BOOKING); } else { console.warn("[submitContact] API returned non-ok status=%d", result.status); dispatch({ type: "CONTACT_SUBMIT_ERROR" }); } } catch (err) { console.warn("[submitContact] network error", err); dispatch({ type: "CONTACT_SUBMIT_ERROR" }); } }, [state.session_id, state.diagnostic_answers, tracker]);
  const completeDiagnostic = useCallback(() => { if (!isDiagValid() || state.current_step !== FUNNEL_STEPS.POOL_DIAGNOSTIC || state.completed_steps.includes(FUNNEL_STEPS.POOL_DIAGNOSTIC) || hasCompletedDiagnosticRef.current) return; hasCompletedDiagnosticRef.current = true; if (tracker) tracker.track(InternalEvents.DIAGNOSTIC_COMPLETED, { step_id: FUNNEL_STEPS.POOL_DIAGNOSTIC, metadata: { total_questions: diagnosticQuestions.length, answered: diagnosticQuestions.filter((q) => { const a = getPersistedQuestionAnswer(q.id, state.diagnostic_answers); return q.type === "multi-select" ? Array.isArray(a) && a.length > 0 : typeof a === "string" && a.length > 0; }).length } }); dispatch({ type: "COMPLETE_DIAGNOSTIC" }); }, [state.current_step, state.completed_steps, state.diagnostic_answers, tracker, isDiagValid]);
  const selectSlot = useCallback((start: string, end: string) => { dispatch({ type: "SELECT_SLOT", start, end }); if (tracker) tracker.track(InternalEvents.TIME_SLOT_SELECTED, { step_id: FUNNEL_STEPS.BOOKING, metadata: { start_time: start } }); }, [tracker]);
  const mapApiErrorToCode = useCallback((apiCode: string | undefined, httpStatus: number): BookingErrorCode => { if (!apiCode) return httpStatus === 0 ? "network_error" : "server_error"; if (apiCode.includes("CONFLICT") || apiCode.includes("UNAVAILABLE") || httpStatus === 409) return "conflict"; if (apiCode.includes("INPUT") || httpStatus === 422) return "missing_fields"; if (apiCode === "NETWORK_ERROR" || httpStatus === 0) return "network_error"; return "server_error"; }, []);
  const submitBooking = useCallback(async (event_id: string) => { if (!state.lead_id || !state.session_id || !state.selected_slot_start) { dispatch({ type: "BOOKING_FAIL", error_code: "missing_fields" }); return; } if (bookingCompletedRef.current) return; dispatch({ type: "BOOKING_START" }); bookingCompletedRef.current = true; fbqTrack(MetaEvents.SCHEDULE, event_id, { content_name: "Consultation Booking" }); if (tracker) tracker.track(InternalEvents.BOOKING_STARTED, { step_id: FUNNEL_STEPS.BOOKING, lead_id: state.lead_id }); try { const result = await createBookingRequest({ lead_id: state.lead_id, session_id: state.session_id, start_time: state.selected_slot_start, timezone: "America/New_York", event_id }); if (result.error) { const frontendCode = mapApiErrorToCode(result.error.code, result.error.status); if (frontendCode === "conflict") dispatch({ type: "BOOKING_CONFLICT" }); else dispatch({ type: "BOOKING_FAIL", error_code: frontendCode, api_code: result.error.code }); bookingCompletedRef.current = false; if (tracker) tracker.track(InternalEvents.BOOKING_FAILED, { step_id: FUNNEL_STEPS.BOOKING, lead_id: state.lead_id, metadata: { reason: frontendCode } }); return; } dispatch({ type: "BOOKING_SUCCESS", appointment_id: result.appointment_id!, start_time: result.start_time!, end_time: result.end_time! }); if (tracker) tracker.track(InternalEvents.BOOKING_COMPLETED, { step_id: FUNNEL_STEPS.BOOKING, lead_id: state.lead_id, metadata: { appointment_id: result.appointment_id } }); dispatch({ type: "COMPLETE_STEP", step: FUNNEL_STEPS.BOOKING }); dispatch({ type: "GO_TO_STEP", step: FUNNEL_STEPS.CONFIRMATION }); saveBookingStep(FUNNEL_STEPS.CONFIRMATION); } catch { dispatch({ type: "BOOKING_FAIL", error_code: "network_error" }); bookingCompletedRef.current = false; if (tracker) tracker.track(InternalEvents.BOOKING_FAILED, { step_id: FUNNEL_STEPS.BOOKING, lead_id: state.lead_id, metadata: { reason: "network_error" } }); } }, [state.lead_id, state.session_id, state.selected_slot_start, tracker, mapApiErrorToCode]);
  const resetFunnel = useCallback(() => { bookingCompletedRef.current = false; clearSessionData(); dispatch({ type: "RESET" }); if (tracker) tracker.track(InternalEvents.PAGE_VIEWED, { step_id: FUNNEL_STEPS.POOL_DIAGNOSTIC }); }, [tracker]);
  const value: FunnelContextValue = { state, dispatch, tracker, goToStep, answerSingle, answerMultiToggle, diagNext, diagBack, completeDiagnostic, submitContact, isCurrentQuestionAnswered, isDiagValid, diagProgress, selectSlot, submitBooking, resetFunnel };
  return (<FunnelContext.Provider value={value}>{children}</FunnelContext.Provider>);
}
export function useFunnel(): FunnelContextValue { const ctx = useContext(FunnelContext); if (!ctx) throw new Error("useFunnel must be used within a FunnelProvider"); return ctx; }
```

> **Critical source-state note:** Several identifiers used above (`sessionInitRef`, `hasTrackedPageView`, `hasTrackedDiagStart`, `state`, `dispatch`, `tracker`, `setTracker`, `FunnelContext`, `children`, `isDiagnosticComplete`, `fbqTrack`) have no visible declarations in the retrieved source before use. This is why the file is flagged as likely malformed/build-breaking.

### `src/lib/funnel/funnel-reducer.ts`
```ts
import type { DiagnosticAnswers, DiagnosticQuestionId, FunnelState, FunnelStepId, SubmissionState, BookingErrorCode } from "@/types/funnel";
import { FUNNEL_STEPS } from "@/types/funnel";
export type FunnelAction =
  | { type: "GO_TO_STEP"; step: FunnelStepId } | { type: "SET_SESSION"; session_id: string } | { type: "SET_LEAD_ID"; lead_id: string } | { type: "HYDRATE"; payload: Partial<FunnelState> }
  | { type: "ANSWER_SINGLE"; question_id: DiagnosticQuestionId; code: string } | { type: "ANSWER_MULTI_TOGGLE"; question_id: DiagnosticQuestionId; code: string } | { type: "DIAG_NEXT" } | { type: "DIAG_BACK" } | { type: "DIAG_SET_INDEX"; index: number }
  | { type: "CONTACT_SUBMIT_START" } | { type: "CONTACT_SUBMIT_SUCCESS"; lead_id: string; first_name: string; email: string } | { type: "CONTACT_SUBMIT_DUPLICATE" } | { type: "CONTACT_SUBMIT_ERROR" } | { type: "SET_VALIDATION_ERRORS"; errors: Record<string, string> } | { type: "CLEAR_VALIDATION_ERRORS" } | { type: "CLEAR_SUBMISSION_ERROR" } | { type: "COMPLETE_STEP"; step: FunnelStepId } | { type: "RESET" } | { type: "COMPLETE_DIAGNOSTIC" }
  | { type: "SELECT_DATE"; date: string } | { type: "SELECT_SLOT"; start: string; end: string } | { type: "BOOKING_START" } | { type: "BOOKING_SUCCESS"; appointment_id: string; start_time: string; end_time: string } | { type: "BOOKING_FAIL"; error_code: BookingErrorCode; api_code?: string } | { type: "BOOKING_CONFLICT" } | { type: "CLEAR_BOOKING_SELECTION" };
export function createInitialState(): FunnelState { return { current_step: FUNNEL_STEPS.POOL_DIAGNOSTIC, session_id: null, lead_id: null, first_name: null, email: null, diagnostic_answers: {}, completed_steps: [], submission_state: "idle", validation_errors: {}, diag_current_index: 0, hydration_ready: false, selected_date: null, selected_slot_start: null, selected_slot_end: null, appointment_id: null, booking_submission_state: "idle", booking_error: null, booking_error_code: null, booking_api_code: null }; }
function setAnswer(answers: DiagnosticAnswers, question_id: DiagnosticQuestionId, code: string): DiagnosticAnswers { switch (question_id) { case "water-feature": return { ...answers, water_feature: code as DiagnosticAnswers["water_feature"] }; case "installation-type": return { ...answers, installation_type: code as DiagnosticAnswers["installation_type"] }; case "pool-size": return { ...answers, pool_size: code as DiagnosticAnswers["pool_size"] }; case "current-treatment": return { ...answers, current_treatment: code as DiagnosticAnswers["current_treatment"] }; case "primary-goal": return { ...answers, primary_goal: code as DiagnosticAnswers["primary_goal"] }; default: return answers; } }
function toggleMultiAnswer(answers: DiagnosticAnswers, code: string): DiagnosticAnswers { const current = answers.current_issues ?? []; const exists = current.includes(code as never); return { ...answers, current_issues: exists ? current.filter((c) => c !== code) : [...current, code as never] }; }
export function funnelReducer(state: FunnelState, action: FunnelAction): FunnelState { switch (action.type) { case "GO_TO_STEP": return { ...state, current_step: action.step }; case "SET_SESSION": return { ...state, session_id: action.session_id }; case "SET_LEAD_ID": return { ...state, lead_id: action.lead_id }; case "HYDRATE": return { ...state, ...action.payload, hydration_ready: true }; case "ANSWER_SINGLE": return { ...state, diagnostic_answers: setAnswer(state.diagnostic_answers, action.question_id, action.code) }; case "ANSWER_MULTI_TOGGLE": return { ...state, diagnostic_answers: toggleMultiAnswer(state.diagnostic_answers, action.code) }; case "DIAG_NEXT": return { ...state, diag_current_index: state.diag_current_index + 1 }; case "DIAG_BACK": return { ...state, diag_current_index: Math.max(0, state.diag_current_index - 1) }; case "DIAG_SET_INDEX": return { ...state, diag_current_index: action.index }; case "CONTACT_SUBMIT_START": return { ...state, submission_state: "submitting" as SubmissionState, validation_errors: {} }; case "CONTACT_SUBMIT_SUCCESS": return { ...state, submission_state: "success" as SubmissionState, lead_id: action.lead_id, first_name: action.first_name, email: action.email }; case "CONTACT_SUBMIT_DUPLICATE": return { ...state, submission_state: "duplicate" as SubmissionState }; case "CONTACT_SUBMIT_ERROR": return { ...state, submission_state: "error" as SubmissionState }; case "SET_VALIDATION_ERRORS": return { ...state, validation_errors: action.errors }; case "CLEAR_VALIDATION_ERRORS": return { ...state, validation_errors: {} }; case "CLEAR_SUBMISSION_ERROR": return { ...state, submission_state: "idle" as SubmissionState, validation_errors: {} }; case "COMPLETE_STEP": if (state.completed_steps.includes(action.step)) return state; return { ...state, completed_steps: [...state.completed_steps, action.step] }; case "RESET": return createInitialState(); case "COMPLETE_DIAGNOSTIC": if (state.completed_steps.includes(FUNNEL_STEPS.POOL_DIAGNOSTIC) || state.current_step !== FUNNEL_STEPS.POOL_DIAGNOSTIC) return state; return { ...state, completed_steps: [...state.completed_steps, FUNNEL_STEPS.POOL_DIAGNOSTIC], current_step: FUNNEL_STEPS.CONTACT_INFORMATION }; case "SELECT_DATE": return { ...state, selected_date: action.date, selected_slot_start: null, selected_slot_end: null, booking_submission_state: "idle", booking_error: null, booking_error_code: null }; case "SELECT_SLOT": return { ...state, selected_slot_start: action.start, selected_slot_end: action.end }; case "BOOKING_START": return { ...state, booking_submission_state: "submitting", booking_error: null, booking_error_code: null, booking_api_code: null }; case "BOOKING_SUCCESS": return { ...state, booking_submission_state: "success", appointment_id: action.appointment_id, selected_slot_start: action.start_time, selected_slot_end: action.end_time, booking_error: null, booking_error_code: null, booking_api_code: null }; case "BOOKING_FAIL": return { ...state, booking_submission_state: "error", booking_error: action.error_code, booking_error_code: action.error_code, booking_api_code: action.api_code ?? null }; case "BOOKING_CONFLICT": return { ...state, booking_submission_state: "idle", selected_slot_start: null, selected_slot_end: null, booking_error: null, booking_error_code: "conflict", booking_api_code: null }; case "CLEAR_BOOKING_SELECTION": return { ...state, selected_date: null, selected_slot_start: null, selected_slot_end: null, appointment_id: null, booking_submission_state: "idle", booking_error: null, booking_error_code: null }; default: return state; } }
```

### `src/lib/funnel/persistence.ts`
```ts
import type { DiagnosticAnswers, DiagnosticQuestionId, FunnelStepId } from "@/types/funnel";
const ANONYMOUS_ID_KEY = "fusion44x_anonymous_id"; const SESSION_ID_KEY = "fusion44x_session_id"; const ANSWERS_KEY = "fusion44x_diagnostic_answers"; const CURRENT_INDEX_KEY = "fusion44x_diag_index"; const STEP_KEY = "fusion44x_current_step"; const LEAD_ID_KEY = "fusion44x_lead_id"; const BOOKING_STEP_KEY = "fusion44x_booking_step"; const SELECTED_DATE_KEY = "fusion44x_selected_date"; const SELECTED_SLOT_START_KEY = "fusion44x_selected_slot_start"; const SELECTED_SLOT_END_KEY = "fusion44x_selected_slot_end";
type StorageArea = "local" | "session"; function isBrowser(): boolean { return typeof window !== "undefined"; } function storage(area: StorageArea): Storage | null { if (!isBrowser()) return null; try { return area === "local" ? localStorage : sessionStorage; } catch { return null; } } function getItem(key: string, area: StorageArea): string | null { try { return storage(area)?.getItem(key) ?? null; } catch { return null; } } function setItem(key: string, value: string, area: StorageArea): void { try { storage(area)?.setItem(key, value); } catch {} } function removeItem(key: string, area: StorageArea): void { try { storage(area)?.removeItem(key); } catch {} }
export function generateAnonymousId(): string { const existing = getAnonymousId(); if (existing) return existing; const id = crypto.randomUUID ? `anon_${crypto.randomUUID()}` : `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`; setItem(ANONYMOUS_ID_KEY, id, "local"); return id; }
export function getAnonymousId(): string | null { return getItem(ANONYMOUS_ID_KEY, "local"); } export function saveSessionId(id: string): void { setItem(SESSION_ID_KEY, id, "session"); } export function getSessionId(): string | null { return getItem(SESSION_ID_KEY, "session"); }
export function saveDiagnosticAnswers(answers: DiagnosticAnswers): void { setItem(ANSWERS_KEY, JSON.stringify(answers), "session"); } export function getDiagnosticAnswers(): DiagnosticAnswers | null { const raw = getItem(ANSWERS_KEY, "session"); if (!raw) return null; try { return JSON.parse(raw) as DiagnosticAnswers; } catch { return null; } }
export function saveDiagIndex(index: number): void { setItem(CURRENT_INDEX_KEY, String(index), "session"); } export function getDiagIndex(): number { const raw = getItem(CURRENT_INDEX_KEY, "session"); return raw ? Number(raw) : 0; }
export function saveCurrentStep(step: FunnelStepId): void { setItem(STEP_KEY, step, "session"); } export function getCurrentStep(): FunnelStepId | null { return getItem(STEP_KEY, "session") as FunnelStepId | null; }
export function saveLeadId(id: string): void { setItem(LEAD_ID_KEY, id, "session"); } export function getLeadId(): string | null { return getItem(LEAD_ID_KEY, "session"); }
export function saveBookingStep(step: FunnelStepId): void { setItem(BOOKING_STEP_KEY, step, "session"); } export function getBookingStep(): FunnelStepId | null { return getItem(BOOKING_STEP_KEY, "session") as FunnelStepId | null; }
export function saveSelectedDate(date: string | null): void { if (date) setItem(SELECTED_DATE_KEY, date, "session"); else removeItem(SELECTED_DATE_KEY, "session"); } export function getSelectedDate(): string | null { return getItem(SELECTED_DATE_KEY, "session"); }
export function saveSelectedSlotStart(start: string | null): void { if (start) setItem(SELECTED_SLOT_START_KEY, start, "session"); else removeItem(SELECTED_SLOT_START_KEY, "session"); } export function getSelectedSlotStart(): string | null { return getItem(SELECTED_SLOT_START_KEY, "session"); }
export function saveSelectedSlotEnd(end: string | null): void { if (end) setItem(SELECTED_SLOT_END_KEY, end, "session"); else removeItem(SELECTED_SLOT_END_KEY, "session"); } export function getSelectedSlotEnd(): string | null { return getItem(SELECTED_SLOT_END_KEY, "session"); }
export function getPersistedQuestionAnswer(questionId: DiagnosticQuestionId, answers: DiagnosticAnswers): string | string[] | undefined { switch (questionId) { case "water-feature": return answers.water_feature; case "installation-type": return answers.installation_type; case "pool-size": return answers.pool_size; case "current-treatment": return answers.current_treatment; case "current-issues": return answers.current_issues; case "primary-goal": return answers.primary_goal; default: return undefined; } }
export function clearSessionData(): void { [SESSION_ID_KEY, ANSWERS_KEY, CURRENT_INDEX_KEY, STEP_KEY, LEAD_ID_KEY, BOOKING_STEP_KEY, SELECTED_DATE_KEY, SELECTED_SLOT_START_KEY, SELECTED_SLOT_END_KEY].forEach((key) => removeItem(key, "session")); }
```

### `src/lib/funnel/session.ts`
```ts
import { generateAnonymousId, saveSessionId, getSessionId } from "./persistence";
const PAGE_VERSION = "0.1.0";
export interface SessionResult { session_id: string; is_new: boolean; }
function getParam(name: string): string | undefined { try { return new URLSearchParams(window.location.search).get(name) ?? undefined; } catch { return undefined; } }
function getCookie(name: string): string | undefined { try { const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=(.*?)(?:;|$)`)); return match ? decodeURIComponent(match[1]) : undefined; } catch { return undefined; } }
function getDeviceCategory(): string { try { const ua = navigator.userAgent.toLowerCase(); const isMobile = /mobile|android|iphone|ipad|ipod/i.test(ua); const isTablet = /tablet|ipad/i.test(ua) && !isMobile; if (isTablet) return "tablet"; if (isMobile) return "mobile"; return "desktop"; } catch { return "desktop"; } }
function getAttributionPayload(): Record<string, string | undefined> { return { utm_source: getParam("utm_source"), utm_medium: getParam("utm_medium"), utm_campaign: getParam("utm_campaign"), utm_content: getParam("utm_content"), utm_term: getParam("utm_term"), fbclid: getParam("fbclid"), fbc: getCookie("_fbc"), fbp: getCookie("_fbp"), landing_url: getLandingUrl(), referrer: getReferrer(), device_category: getDeviceCategory() }; }
function getLandingUrl(): string | undefined { try { if (typeof window !== "undefined" && window.location) return window.location.href; } catch {} return undefined; }
function getReferrer(): string | undefined { try { if (typeof document !== "undefined") return document.referrer || undefined; } catch {} return undefined; }
export async function initializeSession(): Promise<SessionResult | null> { const existingId = getSessionId(); if (existingId) return { session_id: existingId, is_new: false }; const anonymous_id = generateAnonymousId(); const attribution = getAttributionPayload(); try { const response = await fetch("/api/funnel-sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ anonymous_id, page_version: PAGE_VERSION, ...attribution }) }); if (!response.ok) { console.warn("[session] failed to create session:", response.status); return null; } const data = (await response.json()) as { id: string }; saveSessionId(data.id); return { session_id: data.id, is_new: true }; } catch (err) { console.warn("[session] network error:", err); return null; } }
```

### `src/lib/funnel/source.ts`
```ts
const REFERRER_SOURCES: Array<[RegExp, string]> = [[/google\./i, "google"], [/bing\./i, "bing"], [/facebook\./i, "facebook"], [/instagram\./i, "instagram"], [/tiktok\./i, "tiktok"], [/youtube\./i, "youtube"], [/meta\./i, "meta"], [/pinterest\./i, "pinterest"], [/linkedin\./i, "linkedin"], [/x\.com|twitter\./i, "twitter"]];
export interface SourceSessionInfo { utm_source?: string | null; referrer?: string | null; }
export function deriveLeadSource(session: SourceSessionInfo | null | undefined): string { const utm = session?.utm_source?.trim(); if (utm) return utm.toLowerCase().slice(0, 128); const referrer = session?.referrer?.trim(); if (referrer) { try { const hostname = new URL(referrer).hostname; for (const [pattern, source] of REFERRER_SOURCES) if (pattern.test(hostname)) return source; } catch {} } return "direct"; }
```

### `src/lib/meta/contact-event.ts`
```ts
import type { NextRequest } from "next/server";
import { tryCreateMetaCapiClient, createMetaPayload } from "@/lib/meta";
import { MetaEvents } from "@/config/tracking-events";
import type { getServerSupabaseClient } from "@/lib/supabase";
export interface ContactEventParams { clientIp: string | null; request: NextRequest; event_id?: string; email: string; phone: string; first_name: string; last_name: string; zip_code: string; session_id: string; supabase: ReturnType<typeof getServerSupabaseClient>; }
export async function fireMetaContactEvent(params: ContactEventParams) { const client = tryCreateMetaCapiClient(); if (!client) return; const metaEventId = params.event_id ?? crypto.randomUUID(); const clientUserAgent = params.request.headers.get("user-agent") ?? undefined; const sessionRow: any = await params.supabase.from("funnel_sessions").select("fbc, fbp").eq("id", params.session_id).single().then((r) => r.data); const payload = createMetaPayload({ event_name: MetaEvents.CONTACT, event_id: metaEventId, event_source_url: params.request.headers.get("referer") ?? undefined, action_source: "website", customer_info: { email: params.email, phone: params.phone, first_name: params.first_name, last_name: params.last_name, zip_code: params.zip_code, client_ip_address: params.clientIp ?? undefined, client_user_agent: clientUserAgent, fbc: sessionRow?.fbc as string | undefined, fbp: sessionRow?.fbp as string | undefined } }); try { await client.sendEvent(payload); } catch {} }
```

### `src/lib/meta/hash.ts`
```ts
import { createHash } from "node:crypto";
function normalizeAndHash(value: string): string { return createHash("sha256").update(value.trim().toLowerCase()).digest("hex"); }
export function hashEmail(email: string): string { return normalizeAndHash(email); }
export function hashPhone(phone: string): string { return createHash("sha256").update(phone.replace(/\D/g, "")).digest("hex"); }
export function hashName(name: string): string { return normalizeAndHash(name); }
export function hashZipCode(zip: string): string { return normalizeAndHash(zip); }
```

### `src/lib/meta/index.ts`
```ts
import type { MetaEventPayload, MetaEventName, MetaUserData, CustomerInfo } from "@/types/tracking";
import { requireMetaCapiEnv, publicEnv } from "@/lib/env";
import { hashEmail, hashPhone, hashName, hashZipCode } from "./hash";
const META_API_VERSION = "v21.0";
export interface MetaConversionsApi { sendEvent(event: MetaEventPayload): Promise<Response>; }
function getEndpoint(pixelId: string, accessToken: string): string { return `https://graph.facebook.com/${META_API_VERSION}/${pixelId}/events?access_token=${accessToken}`; }
export function createMetaUserData(info: CustomerInfo): MetaUserData { const userData: MetaUserData = {}; if (info.email) userData.em = [hashEmail(info.email)]; if (info.phone) userData.ph = [hashPhone(info.phone)]; if (info.first_name) userData.fn = hashName(info.first_name); if (info.last_name) userData.ln = hashName(info.last_name); if (info.zip_code) userData.zp = hashZipCode(info.zip_code); if (info.external_id) userData.external_id = info.external_id; if (info.client_ip_address) userData.client_ip_address = info.client_ip_address; if (info.client_user_agent) userData.client_user_agent = info.client_user_agent; if (info.fbc) userData.fbc = info.fbc; if (info.fbp) userData.fbp = info.fbp; return userData; }
export function createMetaPayload(params: { event_name: MetaEventName; event_id: string; event_source_url?: string; action_source: "website" | "server"; customer_info: CustomerInfo; custom_data?: Record<string, unknown>; }): MetaEventPayload { return { event_name: params.event_name, event_id: params.event_id, event_time: Math.floor(Date.now() / 1000), event_source_url: params.event_source_url, action_source: params.action_source, user_data: createMetaUserData(params.customer_info), custom_data: params.custom_data }; }
export function createMetaCapiClient(): MetaConversionsApi { const { accessToken } = requireMetaCapiEnv(); const pixelId = publicEnv.NEXT_PUBLIC_META_PIXEL_ID; if (!pixelId) throw new Error("NEXT_PUBLIC_META_PIXEL_ID is not set. Add it to .env.local (see .env.example)."); const endpoint = getEndpoint(pixelId, accessToken); return { async sendEvent(event: MetaEventPayload): Promise<Response> { const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: [event] }) }); if (!response.ok) { const errorBody = await response.text(); console.error("[meta/capi] sendEvent failed status=%d body=%s event_name=%s event_id=%s", response.status, errorBody, event.event_name, event.event_id); } return response; } }; }
export function tryCreateMetaCapiClient(): MetaConversionsApi | null { try { return createMetaCapiClient(); } catch { return null; } }
```

### `src/lib/metrics/index.ts`
```ts
type Labels = Record<string, string | number | boolean> | undefined;
let prom: any = null; let registry: any = null; const fallbackCounters = new Map<string, Map<string, number>>();
void (async () => { try { prom = await import("prom-client"); registry = new prom.Registry(); try { prom.collectDefaultMetrics({ register: registry }); } catch {} } catch { prom = null; } })();
function labelKey(labels: Labels): string { if (!labels || Object.keys(labels).length === 0) return "_"; return Object.keys(labels).sort().map((k) => `${k}=${String((labels as any)[k])}`).join(","); }
export function incrementCounter(name: string, labels?: Labels, value = 1) { if (prom && registry) { const metricName = `${name}`; let metric = registry.getSingleMetric(metricName); if (!metric) metric = new prom.Counter({ name: metricName, help: metricName, labelNames: labels ? Object.keys(labels) : [], registers: [registry] }); if (labels && Object.keys(labels).length > 0) metric.inc(labels, value); else metric.inc(value); return; } const key = labelKey(labels); let series = fallbackCounters.get(name); if (!series) { series = new Map(); fallbackCounters.set(name, series); } series.set(key, (series.get(key) ?? 0) + value); }
export async function getPrometheusText(): Promise<string> { if (prom && registry) { try { return await registry.metrics(); } catch {} } const lines: string[] = []; for (const [name, series] of fallbackCounters) for (const [key, val] of series) { if (key === "_") lines.push(`${name} ${val}`); else { const labelPairs = key.split(",").map((p) => { const [k, v] = p.split("="); return `${k}="${String(v).replace(/"/g, '\\"')}"`; }).join(","); lines.push(`${name}{${labelPairs}} ${val}`); } } return lines.join("\n") + "\n"; }
export function resetAllMetrics() { fallbackCounters.clear(); if (prom && registry) try { registry.clear(); } catch {} }
export default { incrementCounter, getPrometheusText, resetAllMetrics };
```

### `src/lib/security/index.ts`
```ts
export function sanitizeInput(input: string): string { return input.replace(/<[^>]*>/g, "").trim(); }
export function validateEmail(email: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
export function validatePhone(phone: string): boolean { const digits = phone.replace(/\D/g, ""); return digits.length >= 10 && digits.length <= 15; }
export function maskEmail(email: string): string { const [local, domain] = email.split("@"); if (!local || !domain) return email; return `${local[0]}***@${domain}`; }
```

### `src/lib/server/booking-rpc-errors.ts`
```ts
export function mapBookingRpcError(code: string): { status: number; message: string } | null { switch (code) { case "P0002": return { status: 404, message: "Lead or session not found" }; case "P0003": return { status: 403, message: "Session does not match lead" }; case "P0008": case "P0009": return { status: 409, message: "Already booked" }; case "P0010": return { status: 409, message: "Time slot is no longer available" }; case "P0011": return { status: 409, message: "Concurrent booking conflict" }; case "P0012": case "P0013": case "P0014": case "P0015": case "P0016": return { status: 422, message: "Invalid booking request" }; case "P0017": return { status: 422, message: "Invalid timezone" }; case "P0018": return { status: 422, message: "Invalid provider" }; case "P0019": return { status: 422, message: "Invalid duration" }; case "P0020": return { status: 409, message: "Duplicate booking request" }; default: return null; } }
```

### `src/lib/server/lead-rpc-errors.ts`
```ts
export function mapLeadRpcError(code: string): { status: number; message: string } | null { switch (code) { case "P0002": return { status: 404, message: "Session not found" }; case "P0003": return { status: 409, message: "Session already linked to a lead" }; case "P0004": return { status: 422, message: "Consent to contact is required" }; case "P0005": case "P0006": case "P0007": return { status: 422, message: "Validation failed" }; default: return null; } }
```

### `src/lib/server/request-protection.ts`
```ts
import { NextRequest } from "next/server";
import crypto from "node:crypto";
const MAX_BODY_BYTES = 50_000;
export async function readJsonBody(request: NextRequest): Promise<unknown> { const text = await request.text(); if (text.length > MAX_BODY_BYTES) throw new BodyTooLargeError(`Request body exceeds ${MAX_BODY_BYTES.toLocaleString()} bytes`); if (text.length === 0) return {}; try { return JSON.parse(text); } catch { throw new JsonParseError("Request body is not valid JSON"); } }
export class BodyTooLargeError extends Error { constructor(message: string) { super(message); this.name = "BodyTooLargeError"; } }
export class JsonParseError extends Error { constructor(message: string) { super(message); this.name = "JsonParseError"; } }
export function extractClientIp(request: NextRequest): string | null { const forwarded = request.headers.get("x-forwarded-for"); if (forwarded) { const ip = forwarded.split(",")[0].trim(); if (ip) return ip; } const realIp = request.headers.get("x-real-ip"); return realIp || null; }
export function generateRequestId(): string { return crypto.randomUUID(); }
export interface RateLimiterConfig { maxRequests: number; windowMs: number; }
const ipMap = new Map<string, { count: number; resetAt: number }>();
export function checkRateLimit(ip: string | null, config: RateLimiterConfig): { allowed: boolean; remaining: number; resetAt: number } { const key = ip ?? "unknown"; const now = Date.now(); let entry = ipMap.get(key); if (!entry || now >= entry.resetAt) { entry = { count: 0, resetAt: now + config.windowMs }; ipMap.set(key, entry); } entry.count++; const remaining = Math.max(0, config.maxRequests - entry.count); if (entry.count > config.maxRequests) return { allowed: false, remaining: 0, resetAt: entry.resetAt }; return { allowed: true, remaining, resetAt: entry.resetAt }; }
export function getRateRemaining(ip: string | null, config: RateLimiterConfig): number { const key = ip ?? "unknown"; const now = Date.now(); const entry = ipMap.get(key); if (!entry || now >= entry.resetAt) return config.maxRequests; return Math.max(0, config.maxRequests - entry.count); }
export function createPublicError(status: number, message: string) { return { error: { status, message } }; }
```

### `src/lib/supabase/index.ts`
```ts
export { getServerSupabaseClient } from "./server";
```

### `src/lib/supabase/server.ts`
```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseServerEnv } from "@/lib/env";
let cachedClient: ReturnType<typeof createClient> | null = null;
export function getServerSupabaseClient() { if (cachedClient) return cachedClient; const env = requireSupabaseServerEnv(); cachedClient = createClient(env.url, env.serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } }); return cachedClient; }
```

### `src/lib/validation/api-schemas.ts`
```ts
import { z } from "zod";
import { ALL_INTERNAL_EVENT_NAMES } from "@/config/tracking-events";
import { WATER_FEATURE_CODES, INSTALLATION_TYPE_CODES, POOL_SIZE_CODES, CURRENT_TREATMENT_CODES, CURRENT_ISSUES_CODES, PRIMARY_GOAL_CODES } from "@/types/funnel";
const textField = (max: number) => z.string().trim().min(1, "Required").max(max); const optionalTextField = (max: number) => z.string().trim().max(max).optional(); const uuidField = z.string().uuid();
export const funnelSessionSchema = z.object({ anonymous_id: textField(128), page_version: textField(32), landing_url: optionalTextField(2048), referrer: optionalTextField(2048), utm_source: optionalTextField(256), utm_medium: optionalTextField(256), utm_campaign: optionalTextField(256), utm_content: optionalTextField(256), utm_term: optionalTextField(256), fbclid: optionalTextField(512), fbc: optionalTextField(512), fbp: optionalTextField(512), device_category: optionalTextField(64) });
export type FunnelSessionInput = z.input<typeof funnelSessionSchema>;
export const eventNameSchema = z.enum(ALL_INTERNAL_EVENT_NAMES as [string, ...string[]]);
const PII_KEYS = ["email", "phone", "first_name", "last_name", "name", "address"] as const;
const metadataSchema = z.record(z.string(), z.unknown()).superRefine((val, ctx) => { const keys = Object.keys(val); if (keys.length > 10) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Metadata must have at most 10 keys" }); return; } for (const key of keys) if ((PII_KEYS as readonly string[]).includes(key.toLowerCase())) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Metadata must not contain sensitive field: ${key}`, path: [key] }); });
export const funnelEventSchema = z.object({ session_id: uuidField, lead_id: uuidField.optional(), event_name: eventNameSchema, section_id: optionalTextField(128), step_id: optionalTextField(128), question_id: optionalTextField(128), answer_code: optionalTextField(128), duration_ms: z.number().int("duration_ms must be an integer").nonnegative("duration_ms must not be negative").optional(), page_version: textField(32), event_id: uuidField.optional(), metadata: metadataSchema.optional(), occurred_at: z.string().datetime().optional() });
export type FunnelEventInput = z.input<typeof funnelEventSchema>;
const waterFeatureSchema = z.enum(WATER_FEATURE_CODES); const installationTypeSchema = z.enum(INSTALLATION_TYPE_CODES); const poolSizeSchema = z.enum(POOL_SIZE_CODES); const currentTreatmentSchema = z.enum(CURRENT_TREATMENT_CODES); const currentIssuesSchema = z.array(z.enum(CURRENT_ISSUES_CODES)).min(1); const primaryGoalSchema = z.enum(PRIMARY_GOAL_CODES);
export const leadCreateSchema = z.object({ session_id: uuidField, event_id: uuidField.optional(), contact: z.object({ first_name: textField(100), last_name: textField(100), email: z.string().trim().max(320).email("Invalid email address"), phone: z.string().trim().min(1, "Required").max(30).regex(/^[\d\s\-().+]+$/, "Phone can only contain digits, spaces, and the characters -().+"), zip_code: textField(20), preferred_contact_method: z.enum(["email", "phone", "text"]).optional() }), diagnostic: z.object({ water_feature: waterFeatureSchema, installation_type: installationTypeSchema, pool_size: poolSizeSchema, current_treatment: currentTreatmentSchema, current_issues: currentIssuesSchema, primary_goal: primaryGoalSchema }), consent: z.object({ consent_to_contact: z.boolean().refine((val) => val === true, "consent_to_contact must be true"), marketing_consent: z.boolean().default(false), consent_text_version: textField(32) }), source: optionalTextField(128) });
export type LeadCreateInput = z.input<typeof leadCreateSchema>;
export const exitPopupLeadSchema = z.object({ session_id: uuidField, event_id: uuidField.optional(), contact: z.object({ first_name: textField(100), last_name: textField(100), email: z.string().trim().max(320).email("Invalid email address"), phone: z.string().trim().max(30).regex(/^[\d\s\-().+]*$/, "Phone can only contain digits, spaces, and the characters -().+").optional().default(""), zip_code: optionalTextField(20) }), consent: z.object({ consent_to_contact: z.boolean().refine((val) => val === true, "consent_to_contact must be true"), marketing_consent: z.boolean().default(false), consent_text_version: textField(32) }), source: optionalTextField(128) });
export type ExitPopupLeadInput = z.input<typeof exitPopupLeadSchema>;
export function normalizeEmail(email: string): string { return email.toLowerCase().trim(); }
export function normalizePhone(phone: string): string { const digits = phone.replace(/\D/g, ""); if (digits.length === 10) return `+1${digits}`; if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`; return `+${digits}`; }
```

### `src/lib/validation/index.ts`
```ts
import type { LeadSubmission } from "@/types/lead";
import { validateEmail, validatePhone } from "@/lib/security";
export interface ValidationResult { valid: boolean; errors: Record<string, string>; }
export function validateLeadSubmission(data: Partial<LeadSubmission>): ValidationResult { const errors: Record<string, string> = {}; if (!data.full_name || data.full_name.trim().length < 2) errors.full_name = "Full name is required (minimum 2 characters)"; if (!data.email || !validateEmail(data.email)) errors.email = "A valid email address is required"; if (!data.phone || !validatePhone(data.phone)) errors.phone = "A valid phone number is required (10–15 digits)"; return { valid: Object.keys(errors).length === 0, errors }; }
```

### `src/lib/validation/schemas.ts`
```ts
import { z } from "zod";
import { WATER_FEATURE_CODES, INSTALLATION_TYPE_CODES, POOL_SIZE_CODES, CURRENT_TREATMENT_CODES, CURRENT_ISSUES_CODES, PRIMARY_GOAL_CODES } from "@/types/funnel";
export const waterFeatureSchema = z.enum(WATER_FEATURE_CODES); export const installationTypeSchema = z.enum(INSTALLATION_TYPE_CODES); export const poolSizeSchema = z.enum(POOL_SIZE_CODES); export const currentTreatmentSchema = z.enum(CURRENT_TREATMENT_CODES); export const currentIssuesSchema = z.array(z.enum(CURRENT_ISSUES_CODES)).min(1, "At least one issue must be selected"); export const primaryGoalSchema = z.enum(PRIMARY_GOAL_CODES);
export const diagnosticAnswersSchema = z.object({ water_feature: waterFeatureSchema, installation_type: installationTypeSchema, pool_size: poolSizeSchema, current_treatment: currentTreatmentSchema, current_issues: currentIssuesSchema, primary_goal: primaryGoalSchema });
export type DiagnosticAnswersInput = z.input<typeof diagnosticAnswersSchema>; export type DiagnosticAnswersOutput = z.output<typeof diagnosticAnswersSchema>;
export const contactNameSchema = z.string().min(2, "Name must be at least 2 characters").max(100, "Name must be under 100 characters"); export const contactEmailSchema = z.string().email("A valid email address is required").max(320); export const contactPhoneSchema = z.string().min(10, "Phone number must have at least 10 digits").max(20, "Phone number is too long").regex(/^[\d\s\-().+]+$/, "Phone number can only contain digits, spaces, and the characters -().+");
export const contactInfoSchema = z.object({ full_name: contactNameSchema, email: contactEmailSchema, phone: contactPhoneSchema }); export type ContactInfoInput = z.input<typeof contactInfoSchema>; export type ContactInfoOutput = z.output<typeof contactInfoSchema>;
export const leadSubmissionSchema = z.object({ full_name: contactNameSchema, email: contactEmailSchema, phone: contactPhoneSchema, diagnostic_answers: diagnosticAnswersSchema.optional() }); export type LeadSubmissionInput = z.input<typeof leadSubmissionSchema>; export type LeadSubmissionOutput = z.output<typeof leadSubmissionSchema>;
```

## Supabase migration files

### `supabase/migrations/20260724000100_initial_funnel_schema.sql`

```sql
create extension if not exists "pgcrypto";
create or replace function set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

create table public.funnel_sessions (
  id uuid primary key default gen_random_uuid(), anonymous_id text unique not null, lead_id uuid null,
  status text not null default 'active', page_version text not null, referrer text null, landing_url text null,
  utm_source text null, utm_medium text null, utm_campaign text null, utm_content text null, utm_term text null,
  fbclid text null, fbc text null, fbp text null, device_category text null,
  started_at timestamptz not null default now(), last_seen_at timestamptz not null default now(), completed_at timestamptz null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint funnel_sessions_status_check check (status in ('active', 'lead_created', 'booking_started', 'booked', 'abandoned'))
);

create table public.leads (
  id uuid primary key default gen_random_uuid(), session_id uuid unique null, first_name text not null, last_name text not null,
  email text not null, phone text not null, zip_code text not null, preferred_contact_method text null,
  water_feature text not null, installation_type text not null, pool_size text not null, current_treatment text not null,
  primary_goal text not null, qualification_summary text null, status text not null default 'new', consent_to_contact boolean not null,
  consent_to_contact_at timestamptz null, marketing_consent boolean not null default false, marketing_consent_at timestamptz null,
  consent_text_version text not null, source text null, assigned_to text null, crm_external_id text null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint leads_status_check check (status in ('new', 'contacted', 'qualified', 'scheduled', 'completed', 'disqualified', 'archived'))
);
alter table public.funnel_sessions add constraint funnel_sessions_lead_id_fkey foreign key (lead_id) references public.leads(id);
alter table public.leads add constraint leads_session_id_fkey foreign key (session_id) references public.funnel_sessions(id);

create table public.lead_answers (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads(id) on delete cascade,
  question_id text not null, answer_code text not null, answer_order integer null, created_at timestamptz not null default now(),
  constraint lead_answers_unique_answer unique (lead_id, question_id, answer_code)
);

create table public.funnel_events (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.funnel_sessions(id) on delete cascade,
  lead_id uuid null references public.leads(id) on delete set null, event_name text not null, section_id text null, step_id text null,
  question_id text null, answer_code text null, duration_ms integer null, page_version text not null, event_id uuid null,
  metadata jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now(), created_at timestamptz not null default now(),
  constraint funnel_events_event_name_check check (event_name in (
    'page_viewed','hero_cta_clicked','hero_video_opened','hero_video_started','hero_video_completed','testimonials_viewed',
    'testimonial_started','testimonial_completed','diagnostic_started','question_viewed','question_answered','question_changed',
    'validation_error','diagnostic_completed','contact_step_viewed','contact_submitted','lead_created','calendar_viewed',
    'time_slot_selected','booking_started','booking_completed','booking_failed','add_to_calendar_clicked','confirmation_viewed',
    'session_inactive','page_hidden','page_exit_attempted'
  )),
  constraint funnel_events_duration_ms_check check (duration_ms is null or duration_ms >= 0)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads(id) on delete cascade,
  session_id uuid null references public.funnel_sessions(id) on delete set null, status text not null default 'pending',
  provider text not null default 'google_calendar', external_event_id text null unique, start_time timestamptz not null,
  end_time timestamptz not null, timezone text not null, confirmation_email_sent_at timestamptz null,
  reminder_email_sent_at timestamptz null, cancelled_at timestamptz null,
  rescheduled_from_id uuid null references public.appointments(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint appointments_status_check check (status in ('pending', 'confirmed', 'cancelled', 'rescheduled', 'completed', 'no_show', 'failed')),
  constraint appointments_end_after_start_check check (end_time > start_time)
);

create table public.integration_deliveries (
  id uuid primary key default gen_random_uuid(), lead_id uuid null references public.leads(id) on delete cascade,
  appointment_id uuid null references public.appointments(id) on delete cascade, destination text not null, event_type text not null,
  event_id uuid null, status text not null default 'pending', attempt_count integer not null default 0, last_attempt_at timestamptz null,
  delivered_at timestamptz null, response_code integer null, error_message text null, payload_hash text null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint integration_deliveries_destination_check check (destination in ('meta', 'email', 'crm', 'google_sheets', 'google_calendar')),
  constraint integration_deliveries_status_check check (status in ('pending', 'processing', 'delivered', 'failed', 'retrying', 'dead_letter')),
  constraint integration_deliveries_attempt_count_check check (attempt_count >= 0),
  constraint integration_deliveries_has_reference_check check (lead_id is not null or appointment_id is not null)
);

create index idx_funnel_sessions_status_last_seen on public.funnel_sessions (status, last_seen_at);
create index idx_leads_email on public.leads (email);
create index idx_leads_phone on public.leads (phone);
create index idx_leads_status_created on public.leads (status, created_at);
create index idx_lead_answers_lead_id on public.lead_answers (lead_id);
create index idx_funnel_events_session_occurred on public.funnel_events (session_id, occurred_at);
create index idx_funnel_events_lead_occurred on public.funnel_events (lead_id, occurred_at);
create index idx_funnel_events_name_occurred on public.funnel_events (event_name, occurred_at);
create index idx_appointments_lead_id on public.appointments (lead_id);
create index idx_appointments_status_start on public.appointments (status, start_time);
create index idx_integration_deliveries_status_created on public.integration_deliveries (status, created_at);
create index idx_integration_deliveries_destination_status on public.integration_deliveries (destination, status);

create trigger set_funnel_sessions_updated_at before update on public.funnel_sessions for each row execute function set_updated_at();
create trigger set_leads_updated_at before update on public.leads for each row execute function set_updated_at();
create trigger set_appointments_updated_at before update on public.appointments for each row execute function set_updated_at();
create trigger set_integration_deliveries_updated_at before update on public.integration_deliveries for each row execute function set_updated_at();

alter table public.funnel_sessions enable row level security;
alter table public.leads enable row level security;
alter table public.lead_answers enable row level security;
alter table public.funnel_events enable row level security;
alter table public.appointments enable row level security;
alter table public.integration_deliveries enable row level security;
```

> Comments from the migration are summarized elsewhere in this audit; SQL statements above are complete for schema-changing behavior. No `CREATE POLICY` statements occur in the migration.

### `supabase/migrations/20260724000200_create_lead_from_funnel_session.sql`
```sql
create or replace function public.create_lead_from_funnel_session(
  p_session_id uuid, p_first_name text, p_last_name text, p_email text, p_phone text, p_zip_code text,
  p_water_feature text, p_installation_type text, p_pool_size text, p_current_treatment text, p_current_issues text[],
  p_primary_goal text, p_consent_to_contact boolean, p_consent_text_version text, p_preferred_contact_method text,
  p_marketing_consent boolean, p_source text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_lead_id uuid; v_issue_text text; v_page_version text; v_session_lead_id uuid;
begin
  select lead_id, page_version into strict v_session_lead_id, v_page_version from public.funnel_sessions where id = p_session_id for update;
  if v_session_lead_id is not null then raise exception 'Session already linked to a lead' using errcode = 'P0003'; end if;
  if p_consent_to_contact is not true then raise exception 'consent_to_contact must be true' using errcode = 'P0004'; end if;
  if p_current_issues is null then raise exception 'current_issues must not be null' using errcode = 'P0005'; end if;
  if array_length(p_current_issues, 1) is null or array_length(p_current_issues, 1) = 0 then raise exception 'current_issues must not be empty' using errcode = 'P0006'; end if;
  if (select count(*) from unnest(p_current_issues) as x) <> (select count(distinct x) from unnest(p_current_issues) as x) then raise exception 'current_issues must not contain duplicate values' using errcode = 'P0007'; end if;
  insert into public.leads (session_id, first_name, last_name, email, phone, zip_code, preferred_contact_method, water_feature, installation_type, pool_size, current_treatment, primary_goal, consent_to_contact, consent_to_contact_at, marketing_consent, marketing_consent_at, consent_text_version, source, qualification_summary)
  values (p_session_id, p_first_name, p_last_name, p_email, p_phone, p_zip_code, p_preferred_contact_method, p_water_feature, p_installation_type, p_pool_size, p_current_treatment, p_primary_goal, p_consent_to_contact, now(), p_marketing_consent, case when p_marketing_consent then now() else null end, p_consent_text_version, p_source, null) returning id into v_lead_id;
  insert into public.lead_answers (lead_id, question_id, answer_code, answer_order) values
    (v_lead_id, 'water-feature', p_water_feature, 1), (v_lead_id, 'installation-type', p_installation_type, 2),
    (v_lead_id, 'pool-size', p_pool_size, 3), (v_lead_id, 'current-treatment', p_current_treatment, 4),
    (v_lead_id, 'primary-goal', p_primary_goal, 6);
  for v_issue_text in select distinct unnest(p_current_issues) loop insert into public.lead_answers (lead_id, question_id, answer_code, answer_order) values (v_lead_id, 'current-issues', v_issue_text, 5); end loop;
  update public.funnel_sessions set lead_id = v_lead_id, status = 'lead_created' where id = p_session_id;
  insert into public.funnel_events (session_id, lead_id, event_name, section_id, page_version) values (p_session_id, v_lead_id, 'lead_created', 'contact-information', v_page_version);
  return v_lead_id;
end; $$;
revoke execute on function public.create_lead_from_funnel_session(uuid, text, text, text, text, text, text, text, text, text, text[], text, boolean, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.create_lead_from_funnel_session(uuid, text, text, text, text, text, text, text, text, text, text[], text, boolean, text, text, boolean, text) to service_role;
```

### `supabase/migrations/20260724000300_create_funnel_appointment.sql`
```sql
alter table public.appointments add column if not exists booking_event_id uuid;
create unique index if not exists idx_appointments_booking_event_id on public.appointments (booking_event_id) where booking_event_id is not null;

create or replace function public.create_funnel_appointment(
  p_lead_id uuid, p_session_id uuid, p_start_time timestamptz, p_end_time timestamptz, p_timezone text,
  p_provider text, p_event_id uuid, p_buffer_before interval default interval '0 minutes', p_buffer_after interval default interval '0 minutes'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_lead_status text; v_lead_session_id uuid; v_session_status text; v_session_lead_id uuid; v_page_version text;
  v_appointment_id uuid; v_overlap_count integer; v_locked boolean; v_existing_id uuid; v_existing_lead_id uuid;
  v_existing_session_id uuid; v_existing_start_time timestamptz; v_existing_end_time timestamptz; v_existing_timezone text; v_existing_provider text;
begin
  select pg_try_advisory_xact_lock(20260724) into v_locked;
  if not v_locked then raise exception 'Concurrent booking conflict' using errcode = 'P0011'; end if;
  if p_start_time >= p_end_time then raise exception 'end_time must be after start_time' using errcode = 'P0012'; end if;
  if p_start_time <= now() then raise exception 'start_time must be in the future' using errcode = 'P0013'; end if;
  if p_event_id is null then raise exception 'event_id is required' using errcode = 'P0014'; end if;
  if p_timezone is null or p_timezone = '' then raise exception 'timezone is required' using errcode = 'P0015'; end if;
  if p_timezone <> 'America/New_York' then raise exception 'timezone must be America/New_York' using errcode = 'P0017'; end if;
  if p_provider is null or p_provider = '' then raise exception 'provider is required' using errcode = 'P0016'; end if;
  if p_provider <> 'google_calendar' then raise exception 'provider must be google_calendar' using errcode = 'P0018'; end if;
  if (p_end_time - p_start_time) <> interval '30 minutes' then raise exception 'duration must be exactly 30 minutes' using errcode = 'P0019'; end if;
  if p_buffer_before is null or p_buffer_before < interval '0' then raise exception 'buffer_before must be >= 0' using errcode = 'P0012'; end if;
  if p_buffer_after is null or p_buffer_after < interval '0' then raise exception 'buffer_after must be >= 0' using errcode = 'P0012'; end if;
  select id, lead_id, session_id, start_time, end_time, timezone, provider into v_existing_id, v_existing_lead_id, v_existing_session_id, v_existing_start_time, v_existing_end_time, v_existing_timezone, v_existing_provider from public.appointments where booking_event_id = p_event_id;
  if v_existing_id is not null then if v_existing_lead_id is distinct from p_lead_id or v_existing_session_id is distinct from p_session_id or v_existing_start_time is distinct from p_start_time or v_existing_end_time is distinct from p_end_time or v_existing_timezone is distinct from p_timezone or v_existing_provider is distinct from p_provider then raise exception 'Event ID already used with different booking data' using errcode = 'P0020'; end if; return v_existing_id; end if;
  select status, session_id into strict v_lead_status, v_lead_session_id from public.leads where id = p_lead_id for update;
  select status, lead_id, page_version into strict v_session_status, v_session_lead_id, v_page_version from public.funnel_sessions where id = p_session_id for update;
  if v_lead_session_id is distinct from p_session_id or v_session_lead_id is distinct from p_lead_id then raise exception 'Session does not belong to this lead' using errcode = 'P0003'; end if;
  if v_session_status = 'booked' then raise exception 'Session already booked' using errcode = 'P0008'; end if;
  if v_lead_status = 'scheduled' then raise exception 'Lead already scheduled' using errcode = 'P0009'; end if;
  select count(*) into v_overlap_count from public.appointments where status in ('pending', 'confirmed') and start_time < p_end_time + p_buffer_after and end_time > p_start_time - p_buffer_before;
  if v_overlap_count > 0 then raise exception 'Time slot conflicts with existing appointment' using errcode = 'P0010'; end if;
  insert into public.appointments (lead_id, session_id, status, provider, start_time, end_time, timezone, booking_event_id, external_event_id) values (p_lead_id, p_session_id, 'pending', p_provider, p_start_time, p_end_time, p_timezone, p_event_id, null) returning id into v_appointment_id;
  update public.leads set status = 'scheduled' where id = p_lead_id;
  update public.funnel_sessions set status = 'booked' where id = p_session_id;
  insert into public.funnel_events (session_id, lead_id, event_name, section_id, page_version, event_id, metadata) values (p_session_id, p_lead_id, 'booking_completed', 'booking', v_page_version, p_event_id, jsonb_build_object('appointment_id', v_appointment_id, 'start_time', p_start_time, 'end_time', p_end_time, 'timezone', p_timezone, 'provider', p_provider));
  return v_appointment_id;
end; $$;
revoke execute on function public.create_funnel_appointment(uuid, uuid, timestamptz, timestamptz, text, text, uuid, interval, interval) from public, anon, authenticated;
grant execute on function public.create_funnel_appointment(uuid, uuid, timestamptz, timestamptz, text, text, uuid, interval, interval) to service_role;
```

### `supabase/migrations/20260724000400_confirm_funnel_appointment.sql`
```sql
create or replace function public.confirm_funnel_appointment(p_appointment_id uuid, p_external_event_id text, p_provider_response_status text default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_current_status text; v_existing_id uuid; v_confirmed_id uuid;
begin
  if p_appointment_id is null then raise exception 'appointment_id is required' using errcode = 'P0100'; end if;
  if p_external_event_id is null or p_external_event_id = '' then raise exception 'external_event_id is required' using errcode = 'P0101'; end if;
  select id into v_existing_id from public.appointments where external_event_id = p_external_event_id and id is distinct from p_appointment_id limit 1;
  if v_existing_id is not null then raise exception 'external_event_id already linked to another appointment' using errcode = 'P0102'; end if;
  select status into strict v_current_status from public.appointments where id = p_appointment_id for update;
  if v_current_status is distinct from 'pending' then if v_current_status = 'confirmed' then return p_appointment_id; end if; raise exception 'appointment status must be pending, got: %', v_current_status using errcode = 'P0103'; end if;
  update public.appointments set status = 'confirmed', external_event_id = p_external_event_id, updated_at = now() where id = p_appointment_id returning id into v_confirmed_id;
  return v_confirmed_id;
end; $$;
revoke execute on function public.confirm_funnel_appointment(uuid, text, text) from public, anon, authenticated;
grant execute on function public.confirm_funnel_appointment(uuid, text, text) to service_role;

create or replace function public.fail_funnel_appointment(p_appointment_id uuid, p_safe_error_code text default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_current_status text; v_failed_id uuid;
begin
  if p_appointment_id is null then raise exception 'appointment_id is required' using errcode = 'P0110'; end if;
  select status into strict v_current_status from public.appointments where id = p_appointment_id for update;
  if v_current_status is distinct from 'pending' then if v_current_status = 'failed' then return p_appointment_id; end if; raise exception 'appointment status must be pending, got: %', v_current_status using errcode = 'P0111'; end if;
  update public.appointments set status = 'failed', updated_at = now() where id = p_appointment_id returning id into v_failed_id;
  return v_failed_id;
end; $$;
revoke execute on function public.fail_funnel_appointment(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_funnel_appointment(uuid, text) to service_role;
```

### `supabase/migrations/20260724000500_email_notification_delivery_columns.sql`
```sql
alter table public.integration_deliveries add column if not exists template_version text;
alter table public.integration_deliveries add column if not exists provider_message_id text;
alter table public.integration_deliveries add column if not exists next_attempt_at timestamptz;
create unique index if not exists idx_integration_deliveries_email_booking_unique on public.integration_deliveries (appointment_id, destination, event_type, template_version) where destination = 'email' and event_type = 'booking_confirmation';

create or replace function public.claim_email_delivery(p_delivery_id uuid, p_max_attempts int default 5) returns setof public.integration_deliveries language plpgsql security definer as $$
declare v_delivery public.integration_deliveries%rowtype; v_now timestamptz := now();
begin
  select * into v_delivery from public.integration_deliveries where id = p_delivery_id for update; if not found then return; end if;
  if v_delivery.status = 'delivered' or v_delivery.status = 'dead_letter' then return; end if;
  if v_delivery.attempt_count >= p_max_attempts then update public.integration_deliveries set status = 'dead_letter', last_attempt_at = v_now where id = p_delivery_id; return; end if;
  if v_delivery.next_attempt_at is not null and v_delivery.next_attempt_at > v_now then return; end if;
  if v_delivery.status not in ('pending', 'failed') then return; end if;
  update public.integration_deliveries set status = 'processing', attempt_count = v_delivery.attempt_count + 1, last_attempt_at = v_now where id = p_delivery_id;
  select * into v_delivery from public.integration_deliveries where id = p_delivery_id; return next v_delivery;
end; $$;
grant execute on function public.claim_email_delivery(uuid, int) to service_role;

create or replace function public.mark_email_delivery_delivered(p_delivery_id uuid, p_provider_message_id text) returns void language plpgsql security definer as $$ begin update public.integration_deliveries set status = 'delivered', provider_message_id = p_provider_message_id, delivered_at = now(), last_attempt_at = now() where id = p_delivery_id; end; $$;
grant execute on function public.mark_email_delivery_delivered(uuid, text) to service_role;

create or replace function public.mark_email_delivery_failed(p_delivery_id uuid, p_safe_error_code text, p_retryable boolean, p_base_backoff_ms int default 60000, p_max_backoff_ms int default 3600000) returns void language plpgsql security definer as $$
declare v_delivery public.integration_deliveries%rowtype; v_next_attempt timestamptz; v_backoff_ms int; v_now timestamptz := now();
begin
  select * into v_delivery from public.integration_deliveries where id = p_delivery_id for update; if not found then return; end if;
  if not p_retryable then update public.integration_deliveries set status = 'dead_letter', error_message = p_safe_error_code, last_attempt_at = v_now where id = p_delivery_id; return; end if;
  v_backoff_ms := least(p_base_backoff_ms * pow(2, v_delivery.attempt_count - 1)::int, p_max_backoff_ms); v_next_attempt := v_now + (v_backoff_ms || ' milliseconds')::interval;
  if v_delivery.attempt_count >= 5 then update public.integration_deliveries set status = 'dead_letter', error_message = p_safe_error_code, last_attempt_at = v_now, next_attempt_at = null where id = p_delivery_id; return; end if;
  update public.integration_deliveries set status = 'failed', error_message = p_safe_error_code, last_attempt_at = v_now, next_attempt_at = v_next_attempt where id = p_delivery_id;
end; $$;
grant execute on function public.mark_email_delivery_failed(uuid, text, boolean, int, int) to service_role;
```

### `supabase/migrations/20260725000100_internal_booking_notification_delivery.sql`
```sql
-- Dynamically creates/replaces the integration_deliveries event_type CHECK so it preserves existing allowed values and includes internal_booking_notification.
-- If no event_type CHECK exists, it creates:
-- CHECK (event_type in ('booking_confirmation', 'internal_booking_notification'))
-- If one exists without internal_booking_notification, it extracts existing string literals, drops the old event_type CHECK constraint(s), and recreates the constraint with the union.

create unique index if not exists idx_integration_deliveries_internal_booking_unique
  on public.integration_deliveries (appointment_id, destination, event_type, template_version)
  where destination = 'email' and event_type = 'internal_booking_notification';

-- Verification DO block asserts that both booking_confirmation and internal_booking_notification are accepted.
```

> This migration's operative dynamic-constraint behavior is described above; the source consists of PL/pgSQL `DO` blocks that inspect `pg_constraint`, preserve old literals, recreate `integration_deliveries_event_type_check`, create the partial unique index, and verify both event types.

### `supabase/migrations/20260727000100_add_appointment_create_event_type.sql`
```sql
-- Dynamically preserves all existing integration_deliveries.event_type CHECK values and adds appointment_create.
-- If no check exists it creates:
-- CHECK (event_type in ('appointment_create', 'booking_confirmation', 'internal_booking_notification'))
-- Otherwise it extracts literals from pg_get_constraintdef, drops prior event_type CHECK constraints, adds appointment_create, and recreates integration_deliveries_event_type_check.
-- A verification DO block asserts all three values are accepted.
```

### `supabase/migrations/20260728000100_dashboard_indexes_and_browser.sql`
```sql
BEGIN;
ALTER TABLE public.funnel_sessions ADD COLUMN IF NOT EXISTS browser text;
CREATE INDEX IF NOT EXISTS idx_funnel_sessions_started_at ON public.funnel_sessions (started_at);
CREATE INDEX IF NOT EXISTS idx_funnel_sessions_anonymous_id ON public.funnel_sessions (anonymous_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads (created_at);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON public.appointments (start_time);
CREATE INDEX IF NOT EXISTS idx_integration_deliveries_appointment_id ON public.integration_deliveries (appointment_id);
CREATE INDEX IF NOT EXISTS idx_funnel_events_event_name_session ON public.funnel_events (event_name, session_id);
COMMIT;
```

### `supabase/migrations/20260731000100_exit_popup_and_lead_stages.sql`
```sql
-- Relax NOT NULL on leads.phone, zip_code, water_feature, installation_type, pool_size, current_treatment, primary_goal.
-- Add leads.lead_origin text NOT NULL DEFAULT 'funnel' CHECK (lead_origin in ('funnel','exit_popup')).
-- Add leads.stage text NULL CHECK (stage in ('contacted','no_show','follow_up','won','lost')).

create or replace function public.create_lead_from_popup(
  p_session_id uuid, p_first_name text, p_last_name text, p_email text, p_phone text, p_zip_code text,
  p_consent_to_contact boolean, p_consent_text_version text, p_marketing_consent boolean, p_source text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_lead_id uuid; v_page_version text; v_session_lead_id uuid; v_lead_origin text;
begin
  select lead_id, page_version into strict v_session_lead_id, v_page_version from public.funnel_sessions where id = p_session_id for update;
  if v_session_lead_id is not null then
    select lead_origin into v_lead_origin from public.leads where id = v_session_lead_id;
    if coalesce(v_lead_origin, 'funnel') = 'exit_popup' then return v_session_lead_id; end if;
    raise exception 'Session already linked to a lead' using errcode = 'P0003';
  end if;
  if p_consent_to_contact is not true then raise exception 'consent_to_contact must be true' using errcode = 'P0004'; end if;
  insert into public.leads (session_id, first_name, last_name, email, phone, zip_code, consent_to_contact, consent_to_contact_at, marketing_consent, marketing_consent_at, consent_text_version, source, lead_origin, qualification_summary)
  values (p_session_id, p_first_name, p_last_name, p_email, nullif(p_phone, ''), nullif(p_zip_code, ''), p_consent_to_contact, now(), p_marketing_consent, case when p_marketing_consent then now() else null end, p_consent_text_version, p_source, 'exit_popup', null) returning id into v_lead_id;
  update public.funnel_sessions set lead_id = v_lead_id, status = 'lead_created' where id = p_session_id;
  insert into public.funnel_events (session_id, lead_id, event_name, section_id, page_version) values (p_session_id, v_lead_id, 'lead_created', 'exit-popup', v_page_version);
  return v_lead_id;
end; $$;
revoke execute on function public.create_lead_from_popup(uuid, text, text, text, text, text, boolean, text, boolean, text) from public, anon, authenticated;
grant execute on function public.create_lead_from_popup(uuid, text, text, text, text, text, boolean, text, boolean, text) to service_role;

-- Replaces create_lead_from_funnel_session. If session already links to an exit_popup lead, it updates that lead in place:
-- phone, zip_code, preferred_contact_method, water_feature, installation_type, pool_size, current_treatment, primary_goal;
-- deletes/recreates lead_answers; updates session status to lead_created; returns existing lead id.
-- It does NOT refresh first_name, last_name, email, consent fields, source, marketing consent, or lead_origin.
-- For sessions without a lead it performs the original full insert path and writes lead_created.
```

> The full migration also contains schema-state verification `DO` blocks asserting `lead_origin`, `stage`, and `create_lead_from_popup` exist.

## Supabase Edge Functions

### `supabase/functions/booking-notifications/.gitkeep`

```text
(empty file)
```

### `supabase/functions/meta-conversions/.gitkeep`

```text
(empty file)
```

**Result:** There are no implemented Supabase Edge Function source files in the audited tree. Booking notification and Meta conversion behavior is currently implemented in the Next.js server layer instead.

## Requested architecture/tracking/security docs

### `docs/architecture.md`
```md
# Fusion 44X — Architecture

## Boundaries

| Concern | Location | Rule |
|---------|----------|------|
| UI / Visual | `src/components/`, `src/app/` | No business logic, no direct service calls |
| Configuration | `src/config/` | Single source of truth for questions, content, event names |
| External integrations | `src/lib/<service>/` | All service adapters behind interfaces |
| Server API | `src/app/api/` | Only route handlers; delegate to lib modules |
| Types | `src/types/` | Shared across all layers; no `any` unless documented |

## Data Flow

1. User interacts with UI components
2. Components call server API routes (`/api/*`)
3. API routes delegate to lib modules
4. Lib modules call external services (Supabase, Meta, Calendar, Email)
5. Results flow back the same way

## Key Decisions

- Lead submission and appointment booking are separate operations.
- A lead must be saved before the booking step appears.
- Tracking event names come from one typed source (`src/config/tracking-events.ts`).
- Booking and email providers are swappable via adapter pattern.
- Server and browser Meta events share event IDs for deduplication.
- No business logic inside visual components.
- The exit popup is a lightweight lead-capture path that writes to the same `leads` table (`lead_origin = 'exit_popup'`) with nullable diagnostic columns. A full funnel submission on the same session **upgrades the popup lead in place** instead of creating a second lead.
- Leads are tagged, not status-tagged: `status` (qualification lifecycle) is separate from `stage` (manual sales pipeline, set from the admin dashboard) and `source` (auto-derived attribution). Funnel view counts are computed from `funnel_events` per session.
```

### `docs/tracking-plan.md`
```md
# Fusion 44X — Tracking Plan

## Event Architecture

| System | Purpose | Storage |
|--------|---------|---------|
| Internal events | Detailed funnel analytics | Supabase `funnel_events` table |
| Meta browser pixel | Conversion attribution | Meta (browser → pixel) |
| Meta Conversions API | Server-side conversion dedup | Meta (server → CAPI) |

## Internal Event Names

All 27 internal event names are defined in `src/config/tracking-events.ts` (`InternalEvents`).
No hardcoded event name strings anywhere else.

### Funnel lifecycle
- `page_viewed`
- `hero_cta_clicked`
- `hero_video_opened`, `hero_video_started`, `hero_video_completed`
- `testimonials_viewed`, `testimonial_started`, `testimonial_completed`

### Diagnostic
- `diagnostic_started`
- `question_viewed`, `question_answered`, `question_changed`
- `validation_error`
- `diagnostic_completed`

### Contact
- `contact_step_viewed`, `contact_submitted`
- `lead_created`

### Booking
- `calendar_viewed`, `time_slot_selected`
- `booking_started`, `booking_completed`, `booking_failed`
- `add_to_calendar_clicked`

### Confirmation
- `confirmation_viewed`

### Session
- `session_inactive`, `page_hidden`, `page_exit_attempted`

## Internal Event Payload

```typescript
{
  event_name: InternalEventName;
  event_id: string;
  session_id: string;
  timestamp: string;
  step_id?: FunnelStepId;
  question_id?: DiagnosticQuestionId;
  lead_id?: string;
  duration_ms?: number;
  page_version?: string;
  utm?: { source, medium, campaign, term, content };
  metadata?: Record<string, unknown>;
}
```

## Meta Event Names

Only 2 conversion events are sent to Meta:
- `Contact`
- `Schedule`

## Meta Shared Event ID

For every conversion:
1. A UUID v4 `event_id` is generated at the moment of the user action.
2. The browser Meta pixel fires with this `event_id`.
3. The server CAPI sends the same `event_id`.
4. Meta deduplicates the two events.

## Meta Hashing Reference

Meta Conversions API requires SHA256 hashing for certain user data fields.
Hashing is NOT YET IMPLEMENTED in the codebase.

Fields requiring hashing: email (`em`), phone (`ph`), first_name (`fn`), last_name (`ln`), zip_code (`zp`), external_id.
Fields not hashed: client_ip_address, client_user_agent, fbc, fbp.

## PII Rules

- Browser analytics must never contain email, phone, or full name.
- PII belongs only in Meta pixel, Meta CAPI, and lead creation API call.
- Question answers must never be sent to Meta.

## Session ID

A session ID is generated once per funnel visit and included in every internal event.

## Question Answers

Detailed question answers are stored only in Supabase and are not included in Meta events.
```

> The prose above preserves the full substantive contents of the source document; its long hashing table and sample helper are represented semantically. Current code has since implemented hashing and added `contact_submit_failed`, so the document is stale.

### `docs/security-boundaries.md`
```md
# Fusion 44X — Security Boundaries

## Secrets & Credentials

- No secrets, tokens, API keys, or real credentials are ever committed.
- All sensitive values go in `.env.local` (gitignored).
- `.env.example` documents required variables with no real values.

## Service Role Key

- `SUPABASE_SERVICE_ROLE_KEY` must only be used in:
  - Server API route handlers (`src/app/api/*`)
  - Server-side lib modules (`src/lib/supabase/`)
- It must never be exposed to the browser.

## Browser Restrictions

- Browser code (`src/components/`, client components) must never:
  - Access `process.env.SUPABASE_SERVICE_ROLE_KEY`
  - Access `process.env.META_ACCESS_TOKEN`
  - Access `process.env.GOOGLE_CALENDAR_PRIVATE_KEY`
  - Access `process.env.EMAIL_API_KEY`
- Only `NEXT_PUBLIC_*` variables are safe for the browser.

## Input Validation

- All user input is validated before reaching any external service.
- Validation logic lives in `src/lib/validation/`.
- Sanitization utilities in `src/lib/security/`.
```

> **Drift:** The security doc names `META_ACCESS_TOKEN` and `GOOGLE_CALENDAR_PRIVATE_KEY`, while runtime code uses `META_CAPI_ACCESS_TOKEN` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`.

## API routes in `src/app/api/`

### `src/app/api/admin/appointments/[id]/route.ts`
```ts
import { NextRequest, NextResponse } from "next/server"; import { cookies } from "next/headers"; import { verifySessionToken } from "@/lib/admin/auth"; import { appointmentStageSchema, appointmentStageLabel } from "@/lib/admin/stages"; import { updateAppointmentStatus } from "@/lib/admin/queries";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const cookieStore = await cookies(); const session = cookieStore.get("admin_session"); if (!session?.value || !process.env.ADMIN_DASHBOARD_SESSION_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); if (!verifySessionToken(session.value)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const { id } = await params; let body: { status?: unknown } | null; try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); } const parsed = appointmentStageSchema.safeParse(body?.status); if (!parsed.success) return NextResponse.json({ error: "Invalid status. Use: no_show or completed" }, { status: 422 }); const ok = await updateAppointmentStatus(id, parsed.data); if (!ok) return NextResponse.json({ error: "Could not update appointment status" }, { status: 500 }); return NextResponse.json({ success: true, appointment_id: id, status: parsed.data, label: appointmentStageLabel(parsed.data) }); }
```

### `src/app/api/admin/auth/route.ts`
```ts
import { NextRequest, NextResponse } from "next/server"; import { verifyCredentials, createSessionToken, checkLoginRateLimit, resetLoginRateLimit, getAdminSessionConfig } from "@/lib/admin/auth"; import { extractClientIp } from "@/lib/server/request-protection";
export async function POST(request: NextRequest) { const clientIp = extractClientIp(request); const rateKey = clientIp ?? "unknown"; const rateCheck = checkLoginRateLimit(rateKey); if (!rateCheck.allowed) return NextResponse.json({ error: "Too many failed attempts. Try again later." }, { status: 429 }); let body: { username?: string; password?: string }; try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); } const { username, password } = body; if (!username || !password) return NextResponse.json({ error: "Username and password are required" }, { status: 400 }); if (!verifyCredentials(username, password)) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 }); resetLoginRateLimit(rateKey); const token = createSessionToken(username); const config = getAdminSessionConfig(); const response = NextResponse.json({ success: true }); response.cookies.set(config.cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: Math.floor(config.maxAgeMs / 1000), path: "/" }); return response; }
```

### `src/app/api/admin/export/route.ts`
```ts
import { NextRequest, NextResponse } from "next/server"; import { exportSessionsCsv, exportLeadsCsv, exportAppointmentsCsv, type DateFilter } from "@/lib/admin/queries"; import { cookies } from "next/headers"; import { verifySessionToken } from "@/lib/admin/auth";
export async function GET(request: NextRequest) { const cookieStore = await cookies(); const session = cookieStore.get("admin_session"); if (!session?.value || !process.env.ADMIN_DASHBOARD_SESSION_SECRET || !verifySessionToken(session.value)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const { searchParams } = new URL(request.url); const type = searchParams.get("type"); const filterType = searchParams.get("filter") ?? "last30"; const from = searchParams.get("from"); const to = searchParams.get("to"); let filter: DateFilter; if (filterType === "custom" && from && to) filter = { type: "custom", from, to }; else if (filterType === "today") filter = { type: "today" }; else if (filterType === "last7") filter = { type: "last7" }; else filter = { type: "last30" }; let csv: string; let filename: string; switch (type) { case "sessions": csv = await exportSessionsCsv(filter); filename = "funnel-sessions.csv"; break; case "leads": csv = await exportLeadsCsv(filter); filename = "funnel-leads.csv"; break; case "appointments": csv = await exportAppointmentsCsv(filter); filename = "funnel-appointments.csv"; break; default: return NextResponse.json({ error: "Invalid export type. Use: sessions, leads, appointments" }, { status: 400 }); } return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` } }); }
```

### `src/app/api/admin/leads/[id]/route.ts`
```ts
import { NextRequest, NextResponse } from "next/server"; import { cookies } from "next/headers"; import { verifySessionToken } from "@/lib/admin/auth"; import { leadStageSchema, leadStageLabel } from "@/lib/admin/stages"; import { updateLeadStage } from "@/lib/admin/queries";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const cookieStore = await cookies(); const session = cookieStore.get("admin_session"); if (!session?.value || !process.env.ADMIN_DASHBOARD_SESSION_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); if (!verifySessionToken(session.value)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const { id } = await params; let body: { stage?: unknown } | null; try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); } const parsed = leadStageSchema.safeParse(body?.stage); if (!parsed.success) return NextResponse.json({ error: "Invalid stage. Use: contacted, no_show, follow_up, won, lost, or null" }, { status: 422 }); const ok = await updateLeadStage(id, parsed.data); if (!ok) return NextResponse.json({ error: "Could not update lead stage" }, { status: 500 }); return NextResponse.json({ success: true, lead_id: id, stage: parsed.data, label: leadStageLabel(parsed.data) }); }
```

### `src/app/api/admin/logout/route.ts`
```ts
import { NextResponse } from "next/server";
export async function POST() { const response = NextResponse.json({ success: true }); response.cookies.delete("admin_session"); return response; }
```

### `src/app/api/availability/route.ts`
```ts
import { NextRequest, NextResponse } from "next/server"; import { getServerSupabaseClient } from "@/lib/supabase"; import { availabilityQuerySchema, generateTimeSlots, isSlotInPast, isWithinBookingWindow, getDayBoundariesUtc, BOOKING } from "@/lib/booking/slots"; import { extractClientIp, generateRequestId, checkRateLimit, createPublicError } from "@/lib/server/request-protection";
const RATE_LIMIT = { maxRequests: 60, windowMs: 60_000 };
export async function GET(request: NextRequest) { const requestId = generateRequestId(); const clientIp = extractClientIp(request); if (!checkRateLimit(clientIp, RATE_LIMIT).allowed) return NextResponse.json(createPublicError(429, "Too many requests. Try again later."), { status: 429, headers: { "x-request-id": requestId } }); const { searchParams } = new URL(request.url); const parsed = availabilityQuerySchema.safeParse({ date: searchParams.get("date"), timezone: searchParams.get("timezone") ?? BOOKING.TIMEZONE }); if (!parsed.success) return NextResponse.json(createPublicError(422, "Invalid query parameters"), { status: 422, headers: { "x-request-id": requestId } }); const { date, timezone } = parsed.data; if (!isWithinBookingWindow(date)) return NextResponse.json(createPublicError(422, "Date is outside the booking window"), { status: 422, headers: { "x-request-id": requestId } }); const boundaries = getDayBoundariesUtc(date, timezone); if (!boundaries) return NextResponse.json(createPublicError(422, "Invalid date or timezone"), { status: 422, headers: { "x-request-id": requestId } }); const slots = generateTimeSlots(date, timezone); const supabase = getServerSupabaseClient(); const { data: blockingAppointments, error: availabilityError } = await supabase.from("appointments").select("start_time, end_time").in("status", ["pending", "confirmed"]).lt("start_time", boundaries.dayEndUtc).gt("end_time", boundaries.dayStartUtc); if (availabilityError) return NextResponse.json(createPublicError(500, "Internal server error"), { status: 500, headers: { "x-request-id": requestId } }); const blockedSlots = (blockingAppointments ?? []) as Array<{ start_time: string; end_time: string }>; const bufBeforeMs = BOOKING.BUFFER_BEFORE_MINUTES * 60000; const bufAfterMs = BOOKING.BUFFER_AFTER_MINUTES * 60000; const availableSlots = slots.filter((slot) => { if (isSlotInPast(slot.start, BOOKING.MINIMUM_NOTICE_HOURS)) return false; const windowStart = new Date(slot.start).getTime() - bufBeforeMs; const windowEnd = new Date(slot.end).getTime() + bufAfterMs; for (const blocked of blockedSlots) if (windowStart < new Date(blocked.end_time).getTime() && windowEnd > new Date(blocked.start_time).getTime()) return false; return true; }); return NextResponse.json({ slots: availableSlots.map((s) => ({ start: s.start, end: s.end, label: s.label })), date, timezone }, { headers: { "x-request-id": requestId } }); }
```

### `src/app/api/bookings/route.ts`
```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";
import { BOOKING } from "@/config/booking";
import { bookingCreateSchema, isWithinBookingWindow, isWorkingDay, isBlockedDate, isExactSlot, isSlotInPast, isSlotAvailable } from "@/lib/booking/slots";
import { readJsonBody, extractClientIp, generateRequestId, checkRateLimit, BodyTooLargeError, JsonParseError } from "@/lib/server/request-protection";
import { createBooking } from "@/lib/booking/create-booking";
import { tryCreateMetaCapiClient, createMetaPayload } from "@/lib/meta";
import { MetaEvents } from "@/config/tracking-events";
const RATE_LIMIT = { maxRequests: 10, windowMs: 60_000 };
function createBookingError(status: number, code: string, message: string) { return { error: { status, message, code } }; }
export async function POST(request: NextRequest) {
  const requestId = generateRequestId(); const clientIp = extractClientIp(request); if (!checkRateLimit(clientIp, RATE_LIMIT).allowed) return NextResponse.json(createBookingError(429, "BOOKING_RATE_LIMITED", "Too many requests. Try again later."), { status: 429, headers: { "x-request-id": requestId } });
  let body: unknown; try { body = await readJsonBody(request); } catch (err) { if (err instanceof BodyTooLargeError || err instanceof JsonParseError) return NextResponse.json(createBookingError(400, "BOOKING_INPUT_INVALID", err.message), { status: 400, headers: { "x-request-id": requestId } }); throw err; }
  const parsed = bookingCreateSchema.safeParse(body); if (!parsed.success) return NextResponse.json(createBookingError(422, "BOOKING_INPUT_INVALID", "Validation failed"), { status: 422, headers: { "x-request-id": requestId } });
  const { lead_id, session_id, start_time, timezone, event_id } = parsed.data; if (timezone !== BOOKING.TIMEZONE) return NextResponse.json(createBookingError(422, "BOOKING_INPUT_INVALID", "Invalid timezone"), { status: 422, headers: { "x-request-id": requestId } });
  let dateStr: string; try { dateStr = new Date(start_time).toLocaleDateString("en-CA", { timeZone: BOOKING.TIMEZONE }); if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new Error("Invalid date"); } catch { return NextResponse.json(createBookingError(422, "BOOKING_INPUT_INVALID", "Invalid start_time"), { status: 422, headers: { "x-request-id": requestId } }); }
  if (!isWithinBookingWindow(dateStr) || !isWorkingDay(dateStr, BOOKING.TIMEZONE) || isBlockedDate(dateStr) || !isExactSlot(start_time, dateStr, BOOKING.TIMEZONE) || isSlotInPast(start_time, BOOKING.MINIMUM_NOTICE_HOURS)) return NextResponse.json(createBookingError(422, "BOOKING_UNAVAILABLE", "Selected time is unavailable"), { status: 422, headers: { "x-request-id": requestId } });
  const end_time = new Date(new Date(start_time).getTime() + BOOKING.APPOINTMENT_DURATION_MINUTES * 60000).toISOString(); const supabase = getServerSupabaseClient(); try { if (!(await isSlotAvailable(start_time, end_time, supabase))) return NextResponse.json(createBookingError(409, "BOOKING_CONFLICT", "Time slot is no longer available"), { status: 409, headers: { "x-request-id": requestId } }); } catch { return NextResponse.json(createBookingError(500, "BOOKING_DATABASE_FAILED", "Internal server error"), { status: 500, headers: { "x-request-id": requestId } }); }
  const result = await createBooking({ lead_id, session_id, start_time, timezone, event_id }); if ("code" in result && "status" in result) return NextResponse.json(createBookingError(result.status, result.status === 502 ? "GOOGLE_CALENDAR_FAILED" : result.status === 409 ? "BOOKING_CONFLICT" : "BOOKING_DATABASE_FAILED", result.message), { status: result.status, headers: { "x-request-id": requestId } });
  fireMetaScheduleEvent({ lead_id, session_id, event_id, request, clientIp }); return NextResponse.json(result, { status: 201, headers: { "x-request-id": requestId } });
}
async function fireMetaScheduleEvent(params: { lead_id: string; session_id: string; event_id: string; request: NextRequest; clientIp: string | null; }) { const client = tryCreateMetaCapiClient(); if (!client) return; const supabase = getServerSupabaseClient(); const leadRow: any = await supabase.from("leads").select("email, phone, first_name, last_name, zip_code").eq("id", params.lead_id).single().then((r) => r.data); if (!leadRow) return; const sessionRow: any = await supabase.from("funnel_sessions").select("fbc, fbp").eq("id", params.session_id).single().then((r) => r.data); const payload = createMetaPayload({ event_name: MetaEvents.SCHEDULE, event_id: params.event_id, event_source_url: params.request.headers.get("referer") ?? undefined, action_source: "website", customer_info: { email: leadRow.email, phone: leadRow.phone, first_name: leadRow.first_name, last_name: leadRow.last_name, zip_code: leadRow.zip_code, client_ip_address: params.clientIp ?? undefined, client_user_agent: params.request.headers.get("user-agent") ?? undefined, fbc: sessionRow?.fbc, fbp: sessionRow?.fbp } }); try { await client.sendEvent(payload); } catch {} }
export async function GET() { return NextResponse.json(createBookingError(405, "BOOKING_METHOD_NOT_ALLOWED", "Method not allowed"), { status: 405 }); }
```

### `src/app/api/exit-popup/route.ts`
```ts
import { NextRequest, NextResponse } from "next/server"; import { getServerSupabaseClient } from "@/lib/supabase"; import { exitPopupLeadSchema, normalizeEmail, normalizePhone } from "@/lib/validation/api-schemas"; import { readJsonBody, extractClientIp, generateRequestId, checkRateLimit, createPublicError, BodyTooLargeError, JsonParseError } from "@/lib/server/request-protection"; import { mapLeadRpcError } from "@/lib/server/lead-rpc-errors"; import { fireMetaContactEvent } from "@/lib/meta/contact-event"; import { deriveLeadSource } from "@/lib/funnel/source";
const RATE_LIMIT = { maxRequests: 5, windowMs: 60_000 };
export async function POST(request: NextRequest) { const requestId = generateRequestId(); const clientIp = extractClientIp(request); if (!checkRateLimit(clientIp, RATE_LIMIT).allowed) return NextResponse.json(createPublicError(429, "Too many requests. Try again later."), { status: 429, headers: { "x-request-id": requestId } }); let body: unknown; try { body = await readJsonBody(request); } catch (err) { if (err instanceof BodyTooLargeError || err instanceof JsonParseError) return NextResponse.json(createPublicError(400, err.message), { status: 400, headers: { "x-request-id": requestId } }); throw err; } const parsed = exitPopupLeadSchema.safeParse(body); if (!parsed.success) return NextResponse.json(createPublicError(422, "Validation failed"), { status: 422, headers: { "x-request-id": requestId } }); const { session_id, contact, consent, source, event_id } = parsed.data; const email = normalizeEmail(contact.email); const phone = contact.phone ? normalizePhone(contact.phone) : ""; const supabase = getServerSupabaseClient(); const { data: sessionRow } = await supabase.from("funnel_sessions").select("utm_source, referrer").eq("id", session_id).maybeSingle(); const leadSource = source ?? deriveLeadSource(sessionRow); const { data: leadId, error: rpcError } = await supabase.rpc("create_lead_from_popup", { p_session_id: session_id, p_first_name: contact.first_name, p_last_name: contact.last_name, p_email: email, p_phone: phone, p_zip_code: contact.zip_code ?? null, p_consent_to_contact: consent.consent_to_contact, p_consent_text_version: consent.consent_text_version, p_marketing_consent: consent.marketing_consent, p_source: leadSource ?? null } as never); if (rpcError) { const mapped = rpcError.code ? mapLeadRpcError(rpcError.code) : null; if (mapped) return NextResponse.json(createPublicError(mapped.status, mapped.message), { status: mapped.status, headers: { "x-request-id": requestId } }); return NextResponse.json(createPublicError(500, "Internal server error"), { status: 500, headers: { "x-request-id": requestId } }); } fireMetaContactEvent({ clientIp, request, event_id, email, phone, first_name: contact.first_name, last_name: contact.last_name, zip_code: contact.zip_code ?? "", session_id, supabase }); return NextResponse.json({ success: true, lead_id: leadId }, { status: 201, headers: { "x-request-id": requestId } }); }
export async function GET() { return NextResponse.json(createPublicError(405, "Method not allowed"), { status: 405 }); }
```

### `src/app/api/funnel-events/route.ts`
```ts
import { NextRequest, NextResponse } from "next/server"; import { getServerSupabaseClient } from "@/lib/supabase"; import { funnelEventSchema } from "@/lib/validation/api-schemas"; import { readJsonBody, extractClientIp, generateRequestId, checkRateLimit, createPublicError, BodyTooLargeError, JsonParseError } from "@/lib/server/request-protection";
const RATE_LIMIT = { maxRequests: 120, windowMs: 60_000 };
export async function POST(request: NextRequest) { const requestId = generateRequestId(); const clientIp = extractClientIp(request); if (!checkRateLimit(clientIp, RATE_LIMIT).allowed) return NextResponse.json(createPublicError(429, "Too many requests. Try again later."), { status: 429, headers: { "x-request-id": requestId } }); let body: unknown; try { body = await readJsonBody(request); } catch (err) { if (err instanceof BodyTooLargeError || err instanceof JsonParseError) return NextResponse.json(createPublicError(400, err.message), { status: 400, headers: { "x-request-id": requestId } }); throw err; } const parsed = funnelEventSchema.safeParse(body); if (!parsed.success) return NextResponse.json(createPublicError(422, "Validation failed"), { status: 422, headers: { "x-request-id": requestId } }); const supabase = getServerSupabaseClient(); const { data: session } = await supabase.from("funnel_sessions").select("id").eq("id", parsed.data.session_id).maybeSingle(); if (!session) return NextResponse.json(createPublicError(422, "Referenced session does not exist"), { status: 422, headers: { "x-request-id": requestId } }); const eventPayload = { session_id: parsed.data.session_id, lead_id: parsed.data.lead_id ?? null, event_name: parsed.data.event_name, section_id: parsed.data.section_id ?? null, step_id: parsed.data.step_id ?? null, question_id: parsed.data.question_id ?? null, answer_code: parsed.data.answer_code ?? null, duration_ms: parsed.data.duration_ms ?? null, page_version: parsed.data.page_version, event_id: parsed.data.event_id ?? null, metadata: parsed.data.metadata ?? {}, occurred_at: parsed.data.occurred_at ?? undefined }; const { data: inserted, error } = await supabase.from("funnel_events").insert(eventPayload as never).select("id").single(); if (error) return NextResponse.json(createPublicError(500, "Internal server error"), { status: 500, headers: { "x-request-id": requestId } }); return NextResponse.json({ success: true, id: (inserted as { id: string }).id }, { status: 201, headers: { "x-request-id": requestId } }); }
export async function GET() { return NextResponse.json(createPublicError(405, "Method not allowed"), { status: 405 }); }
```

### `src/app/api/funnel-sessions/route.ts`
```ts
import { NextRequest, NextResponse } from "next/server"; import { getServerSupabaseClient } from "@/lib/supabase"; import { funnelSessionSchema } from "@/lib/validation/api-schemas"; import { readJsonBody, extractClientIp, generateRequestId, checkRateLimit, createPublicError, BodyTooLargeError, JsonParseError } from "@/lib/server/request-protection";
const RATE_LIMIT = { maxRequests: 30, windowMs: 60_000 };
export async function POST(request: NextRequest) { const requestId = generateRequestId(); const clientIp = extractClientIp(request); if (!checkRateLimit(clientIp, RATE_LIMIT).allowed) return NextResponse.json(createPublicError(429, "Too many requests. Try again later."), { status: 429, headers: { "x-request-id": requestId } }); let body: unknown; try { body = await readJsonBody(request); } catch (err) { if (err instanceof BodyTooLargeError || err instanceof JsonParseError) return NextResponse.json(createPublicError(400, err.message), { status: 400, headers: { "x-request-id": requestId } }); throw err; } const parsed = funnelSessionSchema.safeParse(body); if (!parsed.success) return NextResponse.json(createPublicError(422, "Validation failed"), { status: 422, headers: { "x-request-id": requestId } }); const { anonymous_id, page_version, landing_url, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, fbc, fbp, device_category } = parsed.data; const supabase = getServerSupabaseClient(); const { data: existing } = await supabase.from("funnel_sessions").select("id, anonymous_id, status, page_version, started_at").eq("anonymous_id", anonymous_id).maybeSingle(); if (existing) return NextResponse.json(existing, { status: 200, headers: { "x-request-id": requestId } }); const { data: inserted, error } = await supabase.from("funnel_sessions").insert({ anonymous_id, page_version, landing_url: landing_url ?? null, referrer: referrer ?? null, utm_source: utm_source ?? null, utm_medium: utm_medium ?? null, utm_campaign: utm_campaign ?? null, utm_content: utm_content ?? null, utm_term: utm_term ?? null, fbclid: fbclid ?? null, fbc: fbc ?? null, fbp: fbp ?? null, device_category: device_category ?? null } as never).select("id, anonymous_id, status, page_version, started_at").single(); if (error) { if (error.code === "23505") { const { data: retry } = await supabase.from("funnel_sessions").select("id, anonymous_id, status, page_version, started_at").eq("anonymous_id", anonymous_id).single(); if (retry) return NextResponse.json(retry, { status: 200, headers: { "x-request-id": requestId } }); } return NextResponse.json(createPublicError(500, "Internal server error"), { status: 500, headers: { "x-request-id": requestId } }); } return NextResponse.json(inserted, { status: 201, headers: { "x-request-id": requestId } }); }
export async function GET() { return NextResponse.json(createPublicError(405, "Method not allowed"), { status: 405 }); }
```

### `src/app/api/leads/route.ts`
```ts
import { NextRequest, NextResponse } from "next/server"; import { getServerSupabaseClient } from "@/lib/supabase"; import { leadCreateSchema, normalizeEmail, normalizePhone } from "@/lib/validation/api-schemas"; import { readJsonBody, extractClientIp, generateRequestId, checkRateLimit, createPublicError, BodyTooLargeError, JsonParseError } from "@/lib/server/request-protection"; import { mapLeadRpcError } from "@/lib/server/lead-rpc-errors"; import { fireMetaContactEvent } from "@/lib/meta/contact-event"; import { deriveLeadSource } from "@/lib/funnel/source"; import { createResendEmailProvider } from "@/lib/email/provider/resend-provider"; import { sendContactSubmissionInternalNotification } from "@/lib/email/internal-notifications"; import { answerLabel, answerLabels } from "@/lib/funnel/answer-labels";
const RATE_LIMIT = { maxRequests: 10, windowMs: 60_000 };
export async function POST(request: NextRequest) { const requestId = generateRequestId(); const clientIp = extractClientIp(request); if (!checkRateLimit(clientIp, RATE_LIMIT).allowed) return NextResponse.json(createPublicError(429, "Too many requests. Try again later."), { status: 429, headers: { "x-request-id": requestId } }); let body: unknown; try { body = await readJsonBody(request); } catch (err) { if (err instanceof BodyTooLargeError || err instanceof JsonParseError) return NextResponse.json(createPublicError(400, err.message), { status: 400, headers: { "x-request-id": requestId } }); throw err; } const parsed = leadCreateSchema.safeParse(body); if (!parsed.success) return NextResponse.json(createPublicError(422, "Validation failed"), { status: 422, headers: { "x-request-id": requestId } }); const { session_id, contact, diagnostic, consent, source, event_id } = parsed.data; const email = normalizeEmail(contact.email); const phone = normalizePhone(contact.phone); const supabase = getServerSupabaseClient(); const { data: sessionRow } = await supabase.from("funnel_sessions").select("utm_source, referrer").eq("id", session_id).maybeSingle(); const leadSource = source ?? deriveLeadSource(sessionRow); let leadId: string | null = null; let rpcError: { code?: string; message?: string } | null = null; for (let attempt = 1; attempt <= 3; attempt += 1) { const res = await supabase.rpc("create_lead_from_funnel_session", { p_session_id: session_id, p_first_name: contact.first_name, p_last_name: contact.last_name, p_email: email, p_phone: phone, p_zip_code: contact.zip_code, p_water_feature: diagnostic.water_feature, p_installation_type: diagnostic.installation_type, p_pool_size: diagnostic.pool_size, p_current_treatment: diagnostic.current_treatment, p_current_issues: diagnostic.current_issues, p_primary_goal: diagnostic.primary_goal, p_consent_to_contact: consent.consent_to_contact, p_consent_text_version: consent.consent_text_version, p_preferred_contact_method: contact.preferred_contact_method ?? null, p_marketing_consent: consent.marketing_consent, p_source: leadSource ?? null } as never); leadId = (res.data as unknown as string | null) ?? null; rpcError = res.error ?? null; if (!rpcError) break; if (rpcError.code && mapLeadRpcError(rpcError.code)) break; if (attempt < 3) await new Promise((r) => setTimeout(r, 200 * attempt)); }
  if (rpcError) { const mapped = rpcError.code ? mapLeadRpcError(rpcError.code) : null; if (mapped) return NextResponse.json(createPublicError(mapped.status, mapped.message), { status: mapped.status, headers: { "x-request-id": requestId } }); return NextResponse.json(createPublicError(500, "Internal server error"), { status: 500, headers: { "x-request-id": requestId } }); }
  fireMetaContactEvent({ clientIp, request, event_id, email, phone, first_name: contact.first_name, last_name: contact.last_name, zip_code: contact.zip_code, session_id, supabase });
  try { const provider = createResendEmailProvider(); await sendContactSubmissionInternalNotification({ leadId: String(leadId), customerFirstName: contact.first_name, customerEmail: email, customerPhone: phone, preferredContactMethod: contact.preferred_contact_method ?? null, diagnostic: { waterFeature: answerLabel("water-feature", diagnostic.water_feature), installationType: answerLabel("installation-type", diagnostic.installation_type), poolSize: answerLabel("pool-size", diagnostic.pool_size), currentTreatment: answerLabel("current-treatment", diagnostic.current_treatment), primaryGoal: answerLabel("primary-goal", diagnostic.primary_goal), currentIssues: answerLabels("current-issues", diagnostic.current_issues) } }, provider); } catch (err) { console.warn("[leads] internal notification failed", err); }
  return NextResponse.json({ success: true, lead_id: leadId }, { status: 201, headers: { "x-request-id": requestId } });
}
export async function GET() { return NextResponse.json(createPublicError(405, "Method not allowed"), { status: 405 }); }
```

### `src/app/api/metrics/route.ts`
```ts
import { NextRequest, NextResponse } from "next/server";
import metrics from "@/lib/metrics";
export async function POST(request: NextRequest) { try { const body = await request.json(); const { name, labels, value } = body as { name: string; labels?: Record<string, any>; value?: number }; if (!name) return NextResponse.json({ error: "name required" }, { status: 400 }); metrics.incrementCounter(name, labels, typeof value === "number" ? value : 1); return NextResponse.json({ ok: true }); } catch { return NextResponse.json({ error: "invalid body" }, { status: 400 }); } }
export async function GET() { const text = metrics.getPrometheusText(); return new NextResponse(text, { status: 200, headers: { "Content-Type": "text/plain; version=0.0.4" } }); }
```

---

# 3. Complete Supabase schema as reconstructed from repository migrations

## `public.funnel_sessions`

| Column | Type | Null | Default / constraint |
|---|---|---:|---|
| `id` | uuid | no | PK, `gen_random_uuid()` |
| `anonymous_id` | text | no | UNIQUE |
| `lead_id` | uuid | yes | FK → `leads.id` |
| `status` | text | no | `active`; CHECK active/lead_created/booking_started/booked/abandoned |
| `page_version` | text | no | |
| `referrer` | text | yes | |
| `landing_url` | text | yes | |
| `utm_source` | text | yes | |
| `utm_medium` | text | yes | |
| `utm_campaign` | text | yes | |
| `utm_content` | text | yes | |
| `utm_term` | text | yes | |
| `fbclid` | text | yes | |
| `fbc` | text | yes | |
| `fbp` | text | yes | |
| `device_category` | text | yes | |
| `browser` | text | yes | added 20260728 |
| `started_at` | timestamptz | no | `now()` |
| `last_seen_at` | timestamptz | no | `now()` |
| `completed_at` | timestamptz | yes | |
| `created_at` | timestamptz | no | `now()` |
| `updated_at` | timestamptz | no | `now()` |

Trigger: `set_funnel_sessions_updated_at` BEFORE UPDATE → `set_updated_at()`.

## `public.leads`

| Column | Type | Null | Default / constraint |
|---|---|---:|---|
| `id` | uuid | no | PK, `gen_random_uuid()` |
| `session_id` | uuid | yes | UNIQUE, FK → `funnel_sessions.id` |
| `first_name` | text | no | |
| `last_name` | text | no | |
| `email` | text | no | |
| `phone` | text | **yes** | made nullable 20260731 |
| `zip_code` | text | **yes** | made nullable 20260731 |
| `preferred_contact_method` | text | yes | |
| `water_feature` | text | **yes** | made nullable 20260731 |
| `installation_type` | text | **yes** | made nullable 20260731 |
| `pool_size` | text | **yes** | made nullable 20260731 |
| `current_treatment` | text | **yes** | made nullable 20260731 |
| `primary_goal` | text | **yes** | made nullable 20260731 |
| `qualification_summary` | text | yes | |
| `status` | text | no | `new`; CHECK new/contacted/qualified/scheduled/completed/disqualified/archived |
| `consent_to_contact` | boolean | no | |
| `consent_to_contact_at` | timestamptz | yes | |
| `marketing_consent` | boolean | no | false |
| `marketing_consent_at` | timestamptz | yes | |
| `consent_text_version` | text | no | |
| `source` | text | yes | |
| `assigned_to` | text | yes | |
| `crm_external_id` | text | yes | |
| `lead_origin` | text | no | `funnel`; CHECK funnel/exit_popup |
| `stage` | text | yes | CHECK contacted/no_show/follow_up/won/lost |
| `created_at` | timestamptz | no | `now()` |
| `updated_at` | timestamptz | no | `now()` |

Trigger: `set_leads_updated_at` BEFORE UPDATE → `set_updated_at()`.

## `public.lead_answers`

`id uuid PK`, `lead_id uuid NOT NULL FK leads(id) ON DELETE CASCADE`, `question_id text NOT NULL`, `answer_code text NOT NULL`, `answer_order integer NULL`, `created_at timestamptz NOT NULL DEFAULT now()`, UNIQUE (`lead_id`,`question_id`,`answer_code`). No update trigger.

## `public.funnel_events`

`id uuid PK`, `session_id uuid NOT NULL FK funnel_sessions ON DELETE CASCADE`, `lead_id uuid NULL FK leads ON DELETE SET NULL`, `event_name text NOT NULL`, `section_id text`, `step_id text`, `question_id text`, `answer_code text`, `duration_ms integer >= 0`, `page_version text NOT NULL`, `event_id uuid`, `metadata jsonb NOT NULL DEFAULT '{}'`, `occurred_at timestamptz NOT NULL DEFAULT now()`, `created_at timestamptz NOT NULL DEFAULT now()`.

**Database event-name CHECK currently contains 27 values and does not include `contact_submit_failed`.** This differs from the TypeScript config.

No update trigger; intended append-only by application convention.

## `public.appointments`

`id uuid PK`, `lead_id uuid NOT NULL FK leads ON DELETE CASCADE`, `session_id uuid NULL FK funnel_sessions ON DELETE SET NULL`, `status text NOT NULL DEFAULT pending` CHECK pending/confirmed/cancelled/rescheduled/completed/no_show/failed, `provider text NOT NULL DEFAULT google_calendar`, `external_event_id text UNIQUE NULL`, `start_time timestamptz NOT NULL`, `end_time timestamptz NOT NULL` CHECK end > start, `timezone text NOT NULL`, `confirmation_email_sent_at timestamptz`, `reminder_email_sent_at timestamptz`, `cancelled_at timestamptz`, `rescheduled_from_id uuid FK appointments ON DELETE SET NULL`, `booking_event_id uuid NULL` with partial unique index, `created_at`, `updated_at`.

Trigger: `set_appointments_updated_at` BEFORE UPDATE → `set_updated_at()`.

## `public.integration_deliveries`

`id uuid PK`, `lead_id uuid NULL FK leads ON DELETE CASCADE`, `appointment_id uuid NULL FK appointments ON DELETE CASCADE`, `destination text NOT NULL` CHECK meta/email/crm/google_sheets/google_calendar, `event_type text NOT NULL` with cumulative CHECK values `appointment_create`, `booking_confirmation`, `internal_booking_notification`, `event_id uuid`, `status text NOT NULL DEFAULT pending` CHECK pending/processing/delivered/failed/retrying/dead_letter, `attempt_count integer NOT NULL DEFAULT 0 CHECK >=0`, `last_attempt_at timestamptz`, `delivered_at timestamptz`, `response_code integer`, `error_message text`, `payload_hash text`, `template_version text`, `provider_message_id text`, `next_attempt_at timestamptz`, `created_at`, `updated_at`. CHECK requires at least one of lead_id/appointment_id non-null.

Trigger: `set_integration_deliveries_updated_at` BEFORE UPDATE → `set_updated_at()`.

## Database functions / RPCs

- `set_updated_at()`
- `create_lead_from_funnel_session(...)` — final 20260731 replacement supports popup lead upgrade; service-role only; secure search path.
- `create_lead_from_popup(...)` — service-role only; secure search path.
- `create_funnel_appointment(...)` — service-role only; secure search path; advisory lock; global overlap prevention.
- `confirm_funnel_appointment(...)` — service-role only; secure search path.
- `fail_funnel_appointment(...)` — service-role only; secure search path.
- `claim_email_delivery(...)` — SECURITY DEFINER; **no explicit revoke from public/anon/authenticated in migration; no locked search_path**.
- `mark_email_delivery_delivered(...)` — same security concern.
- `mark_email_delivery_failed(...)` — same security concern.

## RLS

RLS is enabled on all six tables:

```text
public.funnel_sessions
public.leads
public.lead_answers
public.funnel_events
public.appointments
public.integration_deliveries
```

**RLS policies defined by repository migrations: none.** There are no `CREATE POLICY` statements in the audited migration chain. This means anon/authenticated table access is denied by default when RLS applies. Server application access uses `service_role`, which bypasses RLS.

---

# 4. Every place a lead can be created or updated

| File / DB function | Trigger | Lead write | Downstream after write |
|---|---|---|---|
| `src/app/api/leads/route.ts` → RPC `create_lead_from_funnel_session` | `POST /api/leads` after full diagnostic/contact submit | Creates a new full funnel lead, or upgrades same-session `exit_popup` lead in place | DB writes `lead_answers`; session becomes `lead_created`; new-lead path writes `lead_created` funnel event. Route initiates Meta CAPI `Contact` (not awaited). Route then attempts internal Resend contact notification; failures are swallowed. No CRM/SMS/webhook. |
| `supabase/migrations/20260731000100_exit_popup_and_lead_stages.sql` `create_lead_from_funnel_session` | Called by `/api/leads` | Upgrade path updates existing popup lead phone/ZIP/preferred-contact + diagnostic columns; replaces `lead_answers` | Session status set `lead_created`; **upgrade path does not insert another `lead_created` DB event** and does not refresh identity/source/consent fields. Route still initiates Meta Contact and internal email attempt. |
| `src/app/api/exit-popup/route.ts` → RPC `create_lead_from_popup` | `POST /api/exit-popup` | Creates lightweight `lead_origin='exit_popup'` lead; repeated same-session popup returns existing ID without update | Session lead_id/status updated; DB `lead_created` event with section `exit-popup`; route initiates Meta CAPI Contact (not awaited). **No email, SMS, CRM, or webhook logic fires here.** |
| `src/lib/booking/create-booking.ts` → RPC `create_funnel_appointment` | Successful booking attempt after slot validation | Updates existing lead `status='scheduled'` | Also creates pending appointment, sets session `booked`, inserts DB `booking_completed`; then Google Calendar integration, delivery tracking, confirmation RPC, customer/internal emails, Meta Schedule from route. **Failure path does not revert lead status.** |
| `src/app/api/admin/leads/[id]/route.ts` → `updateLeadStage` in `src/lib/admin/queries.ts` | Authenticated admin `PATCH /api/admin/leads/:id` | Updates `leads.stage` only | `updated_at` trigger fires. No webhook, function, email, SMS, Meta event, or notification. |
| Direct service-role maintenance (architecturally possible) | Any server code with `getServerSupabaseClient()` | Service role can update leads directly because it bypasses RLS | No DB lead-change webhook/notification trigger exists. Only `updated_at` fires unless caller explicitly invokes other logic. |

### Lead-related downstream sequence — full funnel

```text
Browser contact submit
  -> browser Meta Pixel Contact (shared event_id)
  -> POST /api/leads
     -> validate + normalize + derive source
     -> create_lead_from_funnel_session RPC
        -> INSERT/UPDATE leads
        -> INSERT/replace lead_answers
        -> UPDATE funnel_sessions
        -> INSERT lead_created event (new lead only)
     -> fireMetaContactEvent() [best effort, not awaited]
        -> Meta Graph CAPI
     -> createResendEmailProvider()
     -> sendContactSubmissionInternalNotification() [best effort]
        -> likely fails currently because empty booking timestamps are formatted
  -> booking UI
```

### Lead-related downstream sequence — exit popup

```text
Exit popup submit
  -> POST /api/exit-popup
     -> create_lead_from_popup RPC
        -> INSERT leads (exit_popup)
        -> UPDATE funnel_sessions
        -> INSERT lead_created event
     -> fireMetaContactEvent() [best effort, not awaited]
  -> no email / SMS / webhook / CRM
```

---

# 5. Environment variables referenced

Names only; no values.

## Runtime/browser/server code

```text
ADMIN_DASHBOARD_PASSWORD
ADMIN_DASHBOARD_SESSION_SECRET
ADMIN_DASHBOARD_USERNAME
BOOKING_TIMEZONE
EMAIL_API_KEY
EMAIL_FROM
EMAIL_PROVIDER
EMAIL_REPLY_TO
GOOGLE_CALENDAR_ID
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
INTERNAL_BOOKING_NOTIFICATION_TO
META_CAPI_ACCESS_TOKEN
NEXT_PUBLIC_META_PIXEL_ID
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_URL
NODE_ENV
SUPABASE_SERVICE_ROLE_KEY
```

## Manual test script only

```text
TEST_EMAIL_TO
```

## Documented in `.env.example` but no active code reference found in the audited runtime modules

```text
META_TEST_EVENT_CODE
```

## Stale names mentioned by `docs/security-boundaries.md` (not the names used by current runtime code)

```text
META_ACCESS_TOKEN
GOOGLE_CALENDAR_PRIVATE_KEY
```

---

# 6. Notification, email, SMS, webhook, and outbound integration logic

## Email / notification logic

**Implemented provider:** Resend (`src/lib/email/provider/resend-provider.ts`). Requires `EMAIL_API_KEY` and `EMAIL_FROM`; optional `EMAIL_REPLY_TO`.

**Provider selection:** `src/lib/email/provider/provider-factory.ts` accepts `EMAIL_PROVIDER=resend`; if absent, booking treats email as disabled and creates a pending customer email delivery instead. Full lead submission does not use the factory and directly attempts Resend.

**Customer booking confirmation:** `prepareBookingConfirmation` loads a confirmed appointment and lead; `sendBookingConfirmation` creates/claims a durable `integration_deliveries` row; Resend sends HTML/text plus `.ics`; success/failure is recorded. Exponential retry state is supported by DB RPCs and `src/lib/email/retry.ts`.

**Internal booking notification:** `prepareInternalBookingNotification` requires `INTERNAL_BOOKING_NOTIFICATION_TO`, loads lead diagnostics, and uses a separate `internal_booking_notification` delivery record and retry path.

**Internal contact-submission notification:** `/api/leads` directly creates the Resend provider and calls `sendContactSubmissionInternalNotification`. It is best-effort and does **not** create a durable `integration_deliveries` row. The current template path formats empty booking timestamps, making silent failure likely.

**Fake provider:** `src/lib/email/provider/fake-provider.ts` returns synthetic delivered message IDs for tests/dev.

**Legacy/stub email adapter:** `src/lib/email/index.ts` contains a registration abstraction and a `createEmailAdapter()` that throws “not implemented.” It coexists with the newer provider implementation.

**Database delivery state:** `integration_deliveries` tracks booking confirmation/internal booking emails, provider message ID, template version, attempts, next-attempt time, status, and errors.

**Supabase Edge Function stub:** `supabase/functions/booking-notifications/.gitkeep` only; no Edge Function implementation exists.

## SMS

**No SMS provider, SMS route, SMS migration, Twilio adapter, SMS webhook, or SMS send call was found in the audited repository tree.** “Text” exists only as a preferred contact method value and public-facing form option.

## Webhooks

`src/app/api/webhooks/.gitkeep` exists, but there is **no webhook route implementation** under that directory. No inbound webhook handler is present in the audited API tree.

There are outbound HTTP/API integrations, but they are not implemented as generic webhooks:

- Meta Conversions API → `https://graph.facebook.com/.../events`
- Google Calendar API via `googleapis`
- Resend email API via SDK

## Meta conversion notifications/events

- Browser Pixel events: `Contact`, `Schedule`, using shared event IDs for deduplication.
- Server CAPI: `fireMetaContactEvent` for full/exit lead submission; `fireMetaScheduleEvent` after booking route success.
- PII hashing implemented for email, phone, first name, last name, ZIP. `external_id`, if supplied, is currently assigned raw in `createMetaUserData` rather than hashed.
- CAPI failures are swallowed and there is no durable Meta retry/delivery row.
- `supabase/functions/meta-conversions/.gitkeep` is an empty Edge Function stub.

## Google Calendar notification/integration path

Booking creation records an `appointment_create` integration delivery, calls Google Calendar, confirms the DB appointment, then attempts email delivery. If DB confirmation fails after GCal creation, code attempts to delete the external event as compensation. If GCal creation fails, appointment is marked failed, but lead/session lifecycle state is not rolled back.

---

# Additional architecture-review observations

## Data integrity and transaction boundaries

The lead creation RPC is a good atomic boundary: it locks the session, enforces consent, validates multi-select issues, inserts the lead and normalized answers, links the session, and records the lead event in one transaction.

The booking transaction boundary is split across Postgres and Google Calendar. The DB transaction marks the lead/session as booked **before** the external operation. This is the primary consistency risk in the system. A safer model would leave lead/session in a `booking_pending`/`booking_started` state until external confirmation succeeds, then atomically promote all three records, or explicitly compensate lead/session when appointment creation fails.

## Security

The overall browser → Next.js → service-role architecture is coherent and RLS-default-deny provides defense in depth. However, service-role use makes server route authorization/validation the real security perimeter. Admin routes protect writes with a signed cookie, but public route rate limiting is instance-local.

The email SECURITY DEFINER functions should be aligned with the hardened RPC pattern used elsewhere:

```sql
set search_path = '';
revoke execute ... from public, anon, authenticated;
grant execute ... to service_role;
```

## Tracking/data-model drift

The repository has at least four sources of tracking truth: TypeScript config, SQL CHECK constraint, docs tracking plan, and hard-coded dashboard event lists. They are already divergent (`contact_submit_failed`). A generated migration/check or database enum derived from one canonical definition would reduce this risk.

## Session model

If `anonymous_id` is meant to identify a person/browser across visits, it should not be unique on the visit/session table; a separate visitor identity table or `(anonymous_id, session_id)` model is more appropriate. If it is meant to identify a visit, it should be stored in `sessionStorage`, not `localStorage`. Current implementation mixes both meanings.

## Notification reliability

Customer/internal booking email has a durable retry model; contact submission email and Meta CAPI do not. If these are business-critical, they should use an outbox/delivery-record pattern similar to booking email. The empty Edge Function directories suggest an intended async architecture that has not yet been implemented.

## Documentation/config drift

- `docs/tracking-plan.md`: says 27 events, code has 28.
- `docs/tracking-plan.md`: says hashing not implemented, code has hashing.
- `docs/security-boundaries.md`: references env names that do not match runtime names.
- `src/lib/booking/index.ts`: says Google Calendar adapter will be implemented in another branch; it is already implemented.
- `src/lib/email/index.ts`: says adapter not implemented while a newer Resend provider implementation exists.
- Email support phone uses placeholder `555` while public content uses `775-600-5305`.

---

# Audit conclusion

The repository has a strong intended architecture: browser isolation from Supabase, server-side validation, atomic lead RPCs, RLS default-deny, durable booking/email delivery tracking, Meta browser/server deduplication, and an adapter-oriented integration layer. The main risks are not conceptual—they are **state consistency, migration/RPC hardening drift, source corruption, and multiple competing sources of truth**.

The highest-priority remediation order for an external review is:

1. Repair/verify `src/lib/funnel/funnel-context.tsx` and run typecheck/build/tests.
2. Fix booking rollback/confirmation state so failed external bookings do not leave leads `scheduled` and sessions `booked`, and do not emit `booking_completed` prematurely.
3. Revoke public/anon/authenticated EXECUTE and lock `search_path` on the email SECURITY DEFINER RPCs.
4. Reconcile the internal event CHECK constraint/config/docs and add `contact_submit_failed` migration if intended.
5. Correct the visitor/session identity model and `last_seen_at` semantics.
6. Make Meta CAPI and contact-submission notifications durable/awaited if they are required business events.
7. Consolidate email/provider/config documentation and remove stale scaffolding.
