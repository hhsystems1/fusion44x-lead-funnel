# Google Calendar Integration

## Authentication Model

The integration uses a Google service account with domain-wide delegation to
manage calendar events. Authentication is handled via a JWT (JSON Web Token)
client assertion flow:

1. The service account private key is loaded from `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
2. Escaped `\n` characters in the key value are converted to real newlines
3. A `JWT` auth client is created with the service account email and key
4. The client requests the `https://www.googleapis.com/auth/calendar.events` scope
5. The JWT is used to authenticate all Google Calendar API calls

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_CALENDAR_ID` | Yes | The Google Calendar ID (usually an email address) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Yes | The service account email from Google Cloud Console |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Yes | The service account private key (supports escaped `\n`) |

**Important**: The private key is typically provided with literal `\n` sequences
when set as an environment variable. The integration converts these to real
newlines automatically. No other formatting is needed.

## Calendar-Sharing Requirement

The Google Calendar must be shared with the service account email address:

1. Open Google Calendar settings for the target calendar
2. Go to **Settings and sharing** → **Share with specific people or groups**
3. Add the service account email (`GOOGLE_SERVICE_ACCOUNT_EMAIL`)
4. Grant **Make changes to events** permissions

Without this sharing step, the service account will receive 403 Forbidden errors
when attempting to create events.

## Booking-to-Calendar Sequence

```
POST /api/bookings
  │
  ├──1. Validate input (timezone, slot, availability)
  │
  ├──2. Call create_funnel_appointment RPC (atomic)
  │   └── Creates appointment with status = pending
  │
  ├──3. Create integration_deliveries record (pending)
  │
  ├──4. Mark integration_delivery as processing
  │
  ├──5. Query appointment + lead info
  │
  ├──6. Create Google Calendar event
  │   ├── Title: "Fusion 44X Pool Consultation"
  │   ├── Description: Lead name, email, phone, ZIP
  │   ├── Extended properties: appointmentId, bookingEventId
  │   ├── Timezone: America/New_York
  │   └── Attendees: None (avoids domain-wide delegation requirement)
  │
  ├──7. Mark integration_delivery as delivered
  │
  ├──8. Call confirm_funnel_appointment RPC
  │   └── Sets status = confirmed, external_event_id
  │
  └──9. Return confirmed booking response
```

## Idempotency

The booking endpoint is idempotent:

- **Same `booking_event_id` + confirmed appointment**: Returns the existing
  confirmed appointment directly. No duplicate Google Calendar event is created.
- **Same `booking_event_id` + pending appointment + existing delivery**: Reconciles
  by checking if the delivery was successful and the Google event exists, then
  confirms the appointment.
- **Same `booking_event_id` + different booking data**: Rejected by the
  `create_funnel_appointment` RPC (code `P0020`).

## Compensation Behavior

### Google event created, database confirmation fails

1. The Google Calendar event is deleted (compensation)
2. The integration delivery is marked as `failed` with error `COMPENSATED_DELETED_GCAL_EVENT`
3. A safe server error (500) is returned
4. The appointment remains in its prior state (pending, then failed if
   fail_funnel_appointment was called)

### Database appointment exists, Google creation fails

1. The appointment is marked `failed` via `fail_funnel_appointment` RPC
2. The integration delivery is marked as `failed`
3. A safe 502 error is returned
4. The time slot becomes available again since failed appointments do not block

### Compensation failure

If the Google Calendar delete fails during compensation:
- The error is logged with appointment ID and event ID (no credentials)
- No exception is thrown to the caller
- A safe 500 error is still returned

## Error Handling

| Scenario | HTTP Status | Safe Code |
|---|---|---|
| Google Calendar API returns 403 | 502 | `GCAL_403` |
| Google Calendar API returns 404 | 502 | `GCAL_404` |
| Google Calendar API returns 500 | 502 | `GCAL_500` |
| Generic Google Calendar error | 502 | `GCAL_ERROR` |
| Database confirmation fails after Google event created | 500 | `DB_CONFIRM_FAILED` |
| Lead info query fails | 500 | `LEAD_INFO_FAILED` |
| Integration delivery create fails | 500 | `DELIVERY_CREATE_FAILED` |

**No raw Google API error messages are exposed to the client.** All errors are
normalized to safe codes before being returned.

## Manual Test Procedure

```bash
# Ensure environment variables are set
export GOOGLE_CALENDAR_ID="your-calendar@group.calendar.google.com"
export GOOGLE_SERVICE_ACCOUNT_EMAIL="sa@your-project.iam.gserviceaccount.com"
export GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Run the test script
node scripts/test-google-calendar.mjs
```

The script:
1. Creates a test event clearly labeled `[TEST] Fusion 44X Calendar Integration Test`
2. Prints the event ID, summary, start/end times, and calendar link
3. Deletes the event immediately
4. Reports success or failure

**This script must never run automatically during tests or build.**

## Production Deployment Variables

In Vercel, set these environment variables:
- `GOOGLE_CALENDAR_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

Ensure the service account email is shared with the production calendar.

## What Remains for Email Notifications

- Email confirmation after successful booking (`confirmation_email_sent_at`)
- Email reminder before consultation (`reminder_email_sent_at`)
- Email templates for confirmation and reminder
- Email delivery tracking via `integration_deliveries`
- Integration with an email provider (Resend / SendGrid)

These will be implemented in a separate branch after this Google Calendar
integration is deployed and verified.

## Key Files

| File | Purpose |
|---|---|
| `src/lib/booking/providers/types.ts` | Calendar provider contract |
| `src/lib/booking/providers/google/client.ts` | Google Calendar implementation |
| `src/lib/booking/providers/google/index.ts` | Module exports |
| `src/lib/booking/providers/index.ts` | Provider types exports |
| `src/lib/booking/create-booking.ts` | Booking workflow orchestration |
| `src/lib/booking/integration-delivery.ts` | Integration delivery tracking |
| `src/app/api/bookings/route.ts` | Booking API endpoint |
| `supabase/migrations/20260724000400_confirm_funnel_appointment.sql` | Database migration |
| `tests/unit/google-calendar.test.ts` | Tests |
| `scripts/test-google-calendar.mjs` | Manual verification script |
