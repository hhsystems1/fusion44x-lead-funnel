# Email Notifications — Provider-Neutral Foundation

## Architecture

Email notifications use a **provider-neutral adapter pattern** to keep the
codebase independent of any specific email vendor. The architecture mirrors
the existing `CalendarProvider` design at `src/lib/booking/providers/`.

```
src/lib/email/
├── provider/
│   ├── types.ts          # EmailProvider interface + send input/output types
│   ├── fake-provider.ts  # Test-only fake (never sends real email)
│   └── index.ts          # Re-exports
├── templates/
│   └── booking-confirmation.ts  # Pure-function HTML + plain-text renderers
├── delivery.ts           # Integration_deliveries CRUD for email
├── notifications.ts      # prepareBookingConfirmation / sendBookingConfirmation
├── retry.ts              # Retry-safe service with backoff + code classification
└── index.ts              # Existing file (unchanged scaffolding)
```

## Provider-Neutral Design

### EmailProvider interface

Defined in `src/lib/email/provider/types.ts`:

- `sendBookingConfirmation(input: SendEmailInput): Promise<SendEmailResult>`
- `readonly name: string` — provider identifier

### SendEmailInput

| Field                | Type     | Description                          |
|----------------------|----------|--------------------------------------|
| recipientEmail       | string   | Lead email address                   |
| recipientFirstName   | string   | Lead first name                      |
| appointmentId        | string   | UUID of the appointment              |
| confirmedStartTime   | string   | ISO 8601 appointment start           |
| confirmedEndTime     | string   | ISO 8601 appointment end             |
| timezone             | string   | IANA timezone string                 |
| googleCalendarLink   | string   | Pre-generated Google Calendar URL    |
| outlookCalendarLink  | string   | Pre-generated Outlook web URL        |
| icsContent           | string   | Raw ICS file content                 |
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

## Behavior While No Provider Is Configured

1. After booking confirmation, the system may create a **pending** email
   delivery record via `schedulePendingEmailDelivery()`
2. It must **not** attempt a real send
3. Booking API success must **not** depend on email
4. The API response does **not** return an email-sent claim
5. Pending deliveries will be processed once a provider is configured

The `schedulePendingEmailDelivery()` function is called best-effort from
`create-booking.ts` step 9, wrapped in a try/catch that never affects the
booking result.

## Future Provider Setup

### Environment Variables

```bash
EMAIL_PROVIDER=resend          # or: postmark, sendgrid, ses, etc.
EMAIL_FROM=consultations@fusion44x.com
EMAIL_REPLY_TO=consultations@fusion44x.com
EMAIL_API_KEY=re_xxxxxxxxxxxx  # provider-specific
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