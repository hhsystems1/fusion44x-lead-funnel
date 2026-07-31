# Email Notifications — Provider-Neutral Foundation

## Architecture

Email notifications use a **provider-neutral adapter pattern** to keep the
codebase independent of any specific email vendor. The architecture mirrors
the existing `CalendarProvider` design at `src/lib/booking/providers/`.

```
src/lib/email/
├── provider/
│   ├── types.ts               # EmailProvider interface + send input/output types
│   ├── fake-provider.ts       # Test-only fake (never sends real email)
│   ├── resend-provider.ts     # Resend provider implementation
│   ├── provider-factory.ts    # Factory: reads EMAIL_PROVIDER, returns provider
│   └── index.ts               # Re-exports
├── templates/
│   ├── booking-confirmation.ts        # Pure-function HTML + plain-text renderers (customer)
│   ├── internal-booking-notification.ts  # Pure-function HTML + plain-text renderers (internal)
│   └── booking-followup.ts            # Pure-function HTML + plain-text renderers (customer follow-up)
├── delivery.ts                # Integration_deliveries CRUD for customer email
├── notifications.ts           # prepareBookingConfirmation / sendBookingConfirmation (customer)
├── internal-delivery.ts       # Integration_deliveries CRUD for internal notification
├── internal-notifications.ts  # prepareInternalBookingNotification / sendInternalBookingNotification
├── internal-send-input.ts     # Build SendEmailInput for internal notification
├── internal-retry.ts          # Retry-safe service for internal notification
├── follow-up-delivery.ts      # Integration_deliveries CRUD for booking follow-up email
├── follow-up.ts               # scheduleBookingFollowUp / sendDueBookingFollowUps
├── follow-up-send-input.ts    # Build SendEmailInput for booking follow-up
├── retry.ts                   # Retry-safe service with backoff + code classification (customer)
└── index.ts                   # Existing file (unchanged scaffolding)
```

## Provider-Neutral Design

### EmailProvider interface

Defined in `src/lib/email/provider/types.ts`:

- `sendBookingConfirmation(input: SendEmailInput): Promise<SendEmailResult>`
- `sendInternalBookingNotification(input: SendEmailInput): Promise<SendEmailResult>`
- `readonly name: string` — provider identifier

### SendEmailInput

| Field                | Type     | Description                          |
|----------------------|----------|--------------------------------------|
| recipientEmail       | string   | Lead email address                   |
| recipientFirstName   | string   | Lead first name                      |
| appointmentId        | string   | UUID of the appointment              |
| deliveryId           | string   | UUID of the delivery record          |
| confirmedStartTime   | string   | ISO 8601 appointment start           |
| confirmedEndTime     | string   | ISO 8601 appointment end             |
| timezone             | string   | IANA timezone string                 |
| googleCalendarLink   | string   | Pre-generated Google Calendar URL    |
| outlookCalendarLink  | string   | Pre-generated Outlook web URL        |
| icsContent           | string   | Raw ICS file content                 |
| html                 | string   | Rendered HTML email body             |
| text                 | string   | Rendered plain-text email body       |
| replyTo              | string?  | Optional reply-to address            |

The interface never exposes raw vendor objects, API keys, or internal
response payloads.

### SendEmailResult

```
{ messageId: string; status: "delivered" }
```

### ProviderError

```
{ code: string; message: string; retryable: boolean }
```

### Test-only Fake Provider

`createFakeEmailProvider()` in `fake-provider.ts` returns a provider named
`"fake"` that returns a synthetic `messageId` without calling any external
service. Used exclusively in unit tests.

## Confirmation Template

### Contents

- Personalized greeting with recipient first name
- Confirmed date (formatted using `date-fns-tz` `formatInTimeZone`)
- Confirmed time range (formatted in the appointment timezone)
- Timezone clearly shown
- Consultation duration in minutes
- Fusion 44X consultation title (from `EMAIL_CONFIG`)
- Google Calendar button
- Outlook Calendar button
- Apple/other Calendar ICS data URI option
- Support contact details (company name, phone)

### Design

- **HTML version**: Responsive inline-styled table layout, mobile-friendly
- **Plain-text version**: Clean monospaced fallback
- **No JavaScript, no tracking pixels, no diagnostic answers**
- All user-controlled values are HTML-escaped (`escapeHtml` helper)
- Pure functions: `renderBookingConfirmationHtml(params)` and
  `renderBookingConfirmationText(params)` — independently testable

## Delivery Lifecycle

### Table: `integration_deliveries`

Existing destination check constraint includes `'email'`.

New columns added by migration
`20260724000500_email_notification_delivery_columns.sql` (not yet applied):

| Column             | Type        | Purpose                          |
|--------------------|-------------|----------------------------------|
| template_version   | text        | Links delivery to template version |
| provider_message_id| text        | Safe provider-side message ID     |
| next_attempt_at    | timestamptz | Backoff scheduling for retries    |

### States

```
pending  →  processing  →  delivered
                         →  failed  →  (retry → processing)
```

- `pending`: Created but not yet sent
- `processing`: Currently being sent
- `delivered`: Successfully sent
- `failed`: Send failed (retryable or terminal)

### Event type

`booking_confirmation` — used for all booking confirmation emails.

### Status checks

- **email** for destination
- **booking_confirmation** for event_type

## Idempotency

The system guarantees one logical booking-confirmation delivery per
appointment/template-version pair:

1. `findEmailDelivery(appointmentId, templateVersion)` checks for existing
   records before creating new ones
2. If an existing `delivered` record is found, `sendBookingConfirmation`
   returns the stored `deliveryId` without re-sending
3. The unique partial index (in the migration) enforces this at the
   database level

**Rules**:
- Duplicate calls to `sendBookingConfirmation` for the same appointment do
  not send duplicate emails
- `delivered` records return idempotent success
- `failed` records remain retryable

## Retry Design

### Retryable codes

| Code                  | Description            |
|-----------------------|------------------------|
| PROVIDER_UNAVAILABLE  | Provider service down  |
| RATE_LIMITED          | Rate limit exceeded    |
| TIMEOUT               | Request timed out      |
| NETWORK_ERROR         | Network connectivity   |
| PROVIDER_ERROR        | Generic provider error |

### Terminal codes

| Code                | Description              |
|---------------------|--------------------------|
| INVALID_RECIPIENT   | Bad email address        |
| INVALID_TEMPLATE    | Template rendering error |
| PROVIDER_REJECTED   | Provider rejected send   |
| INVALID_CONFIG      | Missing or bad config    |

### Configuration

```typescript
{
  maxAttempts: 5,
  baseBackoffMs: 60_000,     // 1 minute
  maxBackoffMs: 3_600_000,   // 1 hour
}
```

Backoff formula: `baseBackoffMs * 2^(attempt-1)`, capped at `maxBackoffMs`.

### Retry function

`retryFailedEmailDelivery({ deliveryId, provider, config? })`:

- Loads existing delivery record
- Returns immediately if already `delivered`
- Skips terminal errors
- Skips if max attempts reached
- Sends via provider, updates status
- Can be called from:
  - A protected server route (no public endpoint)
  - A scheduled job
  - A Supabase Edge Function
  - A Vercel Cron job

## Internal Booking Notification

Alongside the customer booking confirmation, an **internal notification** is sent
to the team (configured via `INTERNAL_BOOKING_NOTIFICATION_TO`). This is a
completely separate email — never CC/BCC on the customer confirmation.

### Template

File: `src/lib/email/templates/internal-booking-notification.ts`

**Contents**:
- Customer name, email address, and phone (if available)
- Confirmed date, time range, and timezone
- Appointment ID and Google Calendar event ID (if available)
- Distinct subject line and design (orange header banner vs blue for customer)
- No calendar links, no ICS attachment, no diagnostic answers

**Design**:
- HTML and plain-text renderers: `renderInternalBookingNotificationHtml(params)`
  and `renderInternalBookingNotificationText(params)`
- All user-controlled values HTML-escaped via `escapeHtml`
- Customer phone and GCal event ID conditionally rendered

### Delivery Lifecycle

**Event type**: `internal_booking_notification`

Uses `internal-delivery.ts` CRUD functions (parallel to `delivery.ts` for customer):
- `findInternalEmailDelivery(appointmentId, templateVersion)`
- `findInternalEmailDeliveryById(deliveryId)`
- `createPendingInternalEmailDelivery(...)`
- `claimInternalEmailDelivery(deliveryId)`
- `markInternalEmailDeliveryDelivered(...)`
- `markInternalEmailDeliveryFailed(...)`

Same state machine: `pending → processing → delivered` or `→ failed → retry`.

### Idempotency

Independent from customer confirmation. Uses the delivery ID with prefix:
```
Idempotency-Key: internal-booking-notification-<deliveryId>
```
Same rules: duplicate calls return existing result, `delivered` is idempotent,
`failed` records remain retryable.

### Retry

File: `src/lib/email/internal-retry.ts`

`retryFailedInternalEmailDelivery({ deliveryId, provider, config? })`:
- Same exponential backoff formula and code classification as customer retry
- Terminal/retryable codes identical (see Retry Design above)
- Independent max attempts tracking

### Wiring in Booking Flow

In `src/lib/booking/create-booking.ts` step 9, both sends are best-effort and
independent:

```
// 1. Customer confirmation (existing)
await sendBookingConfirmation(...)

// 2. Internal notification (new, independent)
const internalPrepared = await prepareInternalBookingNotification({ ... })
if (internalPrepared) {
  await sendInternalBookingNotification(internalPrepared, provider)
}
```

**Key behaviors**:
- `prepareInternalBookingNotification` returns `null` when
  `INTERNAL_BOOKING_NOTIFICATION_TO` is unset, empty, or invalid — the internal
  send is skipped entirely
- If the internal notification fails, the customer email and booking API
  result are unaffected
- If the customer email fails, the internal notification still fires
- Both failures are tracked independently in `integration_deliveries`
- Neither failure affects the confirmed appointment or API 200 response

### Environment Variable

```bash
INTERNAL_BOOKING_NOTIFICATION_TO=support@fusion44x.com
```

When unset or empty, no internal notification is sent (skipped gracefully).

1. After booking confirmation, the system may create a **pending** email
   delivery record via `schedulePendingEmailDelivery()`
2. It must **not** attempt a real send
3. Booking API success must **not** depend on email
4. The API response does **not** return an email-sent claim
5. Pending deliveries will be processed once a provider is configured

The `schedulePendingEmailDelivery()` function is called best-effort from
`create-booking.ts` step 9, wrapped in a try/catch that never affects the
booking result.

## Booking Follow-Up Email (automated, ~5 min after confirmation)

A personalized "Get Ready" email is sent to the customer automatically
**about 5 minutes after** the booking confirmation email. It recaps the
confirmed date/time and personalizes content from the customer's diagnostic
answers ("Your Details"). This is a customer-facing email — separate from the
internal notification.

### Template

File: `src/lib/email/templates/booking-followup.ts`

- Pure functions `renderBookingFollowUpHtml(params)` /
  `renderBookingFollowUpText(params)`
- Content: confirmed date/time/duration/timezone, a "Your Details" recap built
  from readable diagnostic labels, a "What to Expect" section, support contact
- All user-controlled values HTML-escaped
- Subject (set in the provider): `Get Ready for Your Fusion 44X Pool Consultation, {firstName}`

### Scheduling

File: `src/lib/email/follow-up.ts`

- `scheduleBookingFollowUp({ appointmentId })` — creates a **pending**
  `integration_deliveries` record with `event_type = 'booking_followup'` and
  `next_attempt_at = now + 5 minutes` (idempotent: reuses an existing record)
- Called best-effort from `create-booking.ts` step 9, right after the
  confirmation and internal notifications; never affects the booking result
- New `event_type` requires migration
  `20260729000100_add_booking_followup_event_type.sql` (extends the
  `event_type` CHECK constraint and adds a unique partial index
  `idx_integration_deliveries_booking_followup_unique`)

### Delivery (cron-driven)

- `sendDueBookingFollowUps({ provider })` — lists due pending/failed
  `booking_followup` deliveries, and for each:
  1. **Gating**: only sends once the original `booking_confirmation` delivery
     for the same appointment is `delivered`. If it is still pending/failed it
     marks the follow-up retryable (retried on a later tick); if it is missing
     or terminal, the follow-up is marked dead-letter.
  2. Re-prepares the follow-up (re-fetches appointment + lead + diagnostics,
     ensures the appointment is still `confirmed`)
  3. Claims via the existing `claim_email_delivery` RPC (respects
     `next_attempt_at`), sends via `provider.sendBookingFollowUp`, and marks
     delivered/failed with the existing RPCs
- The claim/send/fail path reuses the same state machine and backoff logic as
  the confirmation and internal emails

### Cron Route

- Route: `GET /api/cron/booking-followups` (`src/app/api/cron/booking-followups/route.ts`)
- Scheduled by `vercel.json` every minute (`* * * * *`), so the actual send
  lands ~5–6 minutes after booking
- Protected by a `Bearer` header matching `CRON_SECRET`; returns `401` otherwise
- No-op `200` when no email provider is configured
- Vercel Cron requires a paid plan for production

### Idempotency

```
Idempotency-Key: booking-followup-<deliveryId>
```

Same rules as the other emails: duplicate calls are idempotent, `delivered` is
terminal-success, `failed` records remain retryable via backoff.

## Resend Provider Setup

### Installation

```bash
npm install resend
```

### Required DNS Verification

Before sending emails with Resend, you must verify your sending domain:

1. In Resend dashboard, add your domain (e.g., `fusion44x.com`)
2. Add the DNS records Resend provides (SPF, DKIM, DMARC)
3. Wait for verification to complete (can take up to 48 hours)
4. The `EMAIL_FROM` address must use a verified domain

### Environment Variables

```bash
# Required
EMAIL_PROVIDER=resend
EMAIL_FROM=consultations@fusion44x.com      # Must be from verified domain
EMAIL_API_KEY=re_xxxxxxxxxxxx               # Resend API key from dashboard

# Optional
EMAIL_REPLY_TO=consultations@fusion44x.com  # Reply-to address (can differ from EMAIL_FROM)
```

### Sender and Reply-To Behavior

- `EMAIL_FROM`: The "From" address in the email. Must be a verified domain in Resend.
- `EMAIL_REPLY_TO`: Optional. If set, used as the "Reply-To" header. If not set, the `replyTo` from `SendEmailInput` is used (defaults to `EMAIL_CONFIG.REPLY_TO_PLACEHOLDER`).
- The provider validates both `EMAIL_API_KEY` and `EMAIL_FROM` on initialization.

### Idempotency

The Resend provider uses the **delivery ID** as the Resend `Idempotency-Key` header:
```
Idempotency-Key: booking-confirmation-<deliveryId>          # customer
Idempotency-Key: internal-booking-notification-<deliveryId>  # internal
Idempotency-Key: booking-followup-<deliveryId>               # customer follow-up
```

This ensures the same logical delivery never produces duplicate sends during

### Email Payload Sent to Resend

| Resend Field | Value |
|--------------|-------|
| `from` | `EMAIL_FROM` |
| `to` | Recipient email from `SendEmailInput` |
| `replyTo` | `EMAIL_REPLY_TO` (env) or `input.replyTo` |
| `subject` | `Booking Confirmed: {firstName}'s Fusion 44X Pool Consultation` |
| `html` | `renderBookingConfirmationHtml(...)` |
| `text` | `renderBookingConfirmationText(...)` |
| `attachments` | ICS file: `fusion-44x-consultation.ics` (text/calendar) |
| `headers.Idempotency-Key` | `booking-confirmation-{deliveryId}` |

**Tracking**: No tracking pixels added. Click/open tracking is controlled at the Resend account/domain level — disable in Resend dashboard if not desired.

### Error Code Mapping

| Resend Status | Mapped Code | Retryable |
|---------------|-------------|-----------|
| 429 | RATE_LIMITED | Yes |
| 5xx, network error | PROVIDER_UNAVAILABLE | Yes |
| 400 (invalid email) | INVALID_RECIPIENT | No |
| 400 (unverified domain) | PROVIDER_REJECTED | No |
| 401, 403 | INVALID_CONFIG | No |
| Other 400 | PROVIDER_REJECTED | No |
| Other | PROVIDER_ERROR | No |

### Manual Test Commands

```bash
# Test customer confirmation email
TEST_EMAIL_TO=test@example.com \
node --env-file=.env.local scripts/test-resend-email.mjs

# Test internal booking notification email
node --env-file=.env.local scripts/test-resend-email.mjs --internal
# Requires INTERNAL_BOOKING_NOTIFICATION_TO in .env.local
```

Customer output:
```
=== Resend Test Email (Customer) ===
Provider: resend
From: consultations@fusion44x.com
Reply-To: consultations@fusion44x.com
To: test@example.com

Sending test email...

=== SUCCESS ===
Message ID: re_abc123...
Status: delivered
```

Internal output:
```
=== Resend Test Email (Internal) ===
Provider: resend
From: consultations@fusion44x.com
To: support@fusion44x.com

Sending test internal notification...

=== SUCCESS ===
Message ID: re_abc123...
Status: delivered
```

The test script:
- Does NOT read from or modify production appointment records
- Uses a generated test appointment time (2 hours from now)
- `--internal` flag sends internal booking notification to INTERNAL_BOOKING_NOTIFICATION_TO
- Prints only safe status and message ID
- Never prints API keys or full email content

### Deployment Variables

Set in Vercel/Production:

| Variable | Required | Description |
|----------|----------|-------------|
| `EMAIL_PROVIDER` | Yes | Must be `resend` |
| `EMAIL_API_KEY` | Yes | Resend API key (`re_...`) |
| `EMAIL_FROM` | Yes | Verified sender address |
| `EMAIL_REPLY_TO` | No | Optional reply-to address |
| `INTERNAL_BOOKING_NOTIFICATION_TO` | No | Internal notification recipient (e.g. support@...) |
| `CRON_SECRET` | No | Authorizes the `/api/cron/booking-followups` route (required for the follow-up cron) |

### How to Disable Sending Safely

To disable email sending without code changes:

1. **Unset `EMAIL_PROVIDER`** — factory returns `null`, no emails sent
2. **Remove `EMAIL_API_KEY`** — provider init throws, caught in booking flow
3. **Unset `INTERNAL_BOOKING_NOTIFICATION_TO`** — internal notification skipped
4. **Set `EMAIL_PROVIDER=fake`** — not supported (throws "Unknown EMAIL_PROVIDER")

The booking API remains fully functional regardless of email configuration.

### Environment Variables

```bash
EMAIL_PROVIDER=resend
EMAIL_FROM=consultations@fusion44x.com
EMAIL_REPLY_TO=consultations@fusion44x.com
EMAIL_API_KEY=re_xxxxxxxxxxxx  # provider-specific
INTERNAL_BOOKING_NOTIFICATION_TO=support@fusion44x.com
CRON_SECRET=<long random string>  # required for the follow-up cron route
```

### Implementing a Provider

1. Create `src/lib/email/provider/<name>.ts`
2. Implement the `EmailProvider` interface
3. Factory function: `create<Name>EmailProvider(): EmailProvider`
4. Wire into `notifications.ts` via dependency injection

### Production Deployment Requirements

- A configured email provider with valid API key
- Verified sender domain / from address
- Applied database migration (see below)
- `EMAIL_PROVIDER`, `EMAIL_FROM`, `EMAIL_API_KEY` set in environment
- SPF/DKIM records for the sending domain
- Reply-to address configured and monitored
- Rate limits understood for bulk sending

### Manual Test Plan

Once a provider is added:

1. Confirm a booking via the funnel
2. Verify a pending `integration_deliveries` record is created
3. Process pending deliveries (call `sendBookingConfirmation`)
4. Verify email is received with correct template content
5. Verify Google Calendar link works
6. Verify Outlook Calendar link works
7. Verify ICS download works
8. Verify plain-text fallback renders correctly
9. Test on mobile email client
10. Test resending for a failed delivery
11. Verify idempotency (re-sending same delivery returns existing result)

## Migration

File: `supabase/migrations/20260724000500_email_notification_delivery_columns.sql`

Adds to `integration_deliveries`:
- `template_version text`
- `provider_message_id text`
- `next_attempt_at timestamptz`
- Unique partial index on `(appointment_id, destination, event_type, template_version)`
  where `destination = 'email'` and `event_type = 'booking_confirmation'`

**This migration is not applied automatically.** Apply it via the Supabase
dashboard or CLI before enabling email sending.

## Security

- All email modules use `import "server-only"` — never accessible from
  client code
- No provider secrets in client code or returned from server
- No PII in generic logs: log only `requestId`, `appointmentId`,
  `deliveryId`, and safe error code
- HTML-escape all user-controlled template values
- Reject invalid recipient email addresses
- No `any` types in the email module
- No public email-send endpoint
- No raw provider response bodies stored in delivery tracking