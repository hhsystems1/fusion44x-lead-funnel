# Custom Booking Flow

## Architecture

The booking flow is a client-rendered, multi-step UI that communicates with two server API routes backed by a PostgreSQL RPC for atomic database operations.

---

## Booking Configuration

All tunable values live in `src/config/booking.ts`:

| Key | Value |
|---|---|
| `APPOINTMENT_DURATION_MINUTES` | 30 |
| `SLOT_INTERVAL_MINUTES` | 30 |
| `TIMEZONE` | America/New_York |
| `MINIMUM_NOTICE_HOURS` | 2 |
| `BOOKING_WINDOW_DAYS` | 30 |
| `BUFFER_BEFORE_MINUTES` | 0 |
| `BUFFER_AFTER_MINUTES` | 0 |
| `WORKING_HOURS` | 9:00–17:00 (configurable) |
| `WORKING_DAYS` | Monday–Friday (1–5) |
| `BLOCKED_DATES` | empty array (add YYYY-MM-DD strings) |

All components, API routes, and tests import from this single source. The values are never duplicated.

---

## Booking Flow

```
Contact submitted → BOOKING step → user sees:
  1. Date picker (scrollable list of working days within window)
  2. Time slots grid (fetched from /api/availability)
  3. Review & confirm
  4. Success with add-to-calendar links
```

### UI States

- **Loading**: spinner while fetching availability
- **Empty**: no slots available (weekend, blocked date, or fully booked)
- **Error**: network error with retry button
- **Conflict**: 409 from booking → auto-refresh slots
- **Success**: confirmation with add-to-calendar links

---

## Availability Calculation

`GET /api/availability?date=YYYY-MM-DD&timezone=...`

1. Validate date format and booking window
2. Check day of week (working days only)
3. Check blocked dates
4. Generate slots at configured interval within working hours
5. Query `appointments` for overlapping `pending` or `confirmed` records
6. Remove past slots (enforce minimum notice)
7. Remove slots blocked by existing appointments
8. Return ISO timestamps and human-readable labels

### Slot Overlap Detection

A slot is blocked if any active appointment (pending or confirmed) satisfies:

```
existing.start_time < slot.end_time AND existing.end_time > slot.start_time
```

---

## Timezone Behavior

- All timestamps are stored in UTC (`timestamptz` columns)
- The display timezone is `America/New_York` (configurable)
- Slot generation converts date strings to UTC using the configured timezone's midnight
- Time labels are formatted using `Intl.DateTimeFormat` with the configured timezone
- The client sends the timezone with booking requests, but the server always validates against server-side configuration

---

## Atomic RPC Flow

`create_funnel_appointment` in `supabase/migrations/20260724000300_create_funnel_appointment.sql`

1. **Lock lead row** with `SELECT ... FOR UPDATE`
2. **Lock session row** with `SELECT ... FOR UPDATE`
3. Verify session belongs to lead (bidirectional FK check)
4. Reject if session status is already `booked`
5. Reject if lead status is already `scheduled`
6. Reject if any overlapping `pending` or `confirmed` appointment exists
7. Insert appointment with `pending` status
8. Update lead status to `scheduled`
9. Update session status to `booked`
10. Insert `booking_completed` funnel event
11. Return appointment ID

All steps happen within a single transaction. The function is `SECURITY DEFINER` with `search_path = ''`, revoked from public/anon/authenticated, and granted only to `service_role`.

---

## Conflict Prevention

| Layer | Protection |
|---|---|
| Client | `bookingCompletedRef.current` — prevents double submission |
| Client | Booking submission state disables confirm button during submission |
| Server | Rate limit (10 req/60s) |
| Database | `SELECT ... FOR UPDATE` row locks |
| Database | Overlapping appointment check inside the RPC |
| Database | Already-booked session/lead status check |

On 409 conflict, the UI:
- Sets `booking_error = "conflict"` in funnel state
- Clears selected slot
- Refreshes availability for the current date
- Shows the conflict message
- User picks a new slot

---

## State Persistence

The following are persisted in `sessionStorage`:

| Key | Key Constant |
|---|---|
| `selected_date` | `fusion44x_selected_date` |
| `selected_slot_start` | `fusion44x_selected_slot_start` |
| `selected_slot_end` | `fusion44x_selected_slot_end` |

On hydration, these values are restored so the user can resume their booking flow after a page reload.

On successful booking, `appointment_id` is stored in the funnel state (not sessionStorage — only the current session sees it).

---

## Calendar Link Generation

| Provider | Method | File |
|---|---|---|
| Google Calendar | URL with `action=TEMPLATE` | `src/lib/booking/calendar-links.ts` |
| Outlook Web | URL with deeplink/compose | `src/lib/booking/calendar-links.ts` |
| Apple Calendar / any | Downloadable .ics file | `src/lib/booking/calendar-links.ts` |

All use server-safe UTC timestamps. No credentials are required.

---

## What Remains for Google Calendar and Email Integration

### Google Calendar
- Implement `GoogleCalendarAdapter` in `src/lib/booking/index.ts`
- Call `registerBookingAdapter(createGoogleCalendarAdapter())` at server startup
- Use the Google Calendar API to create the event server-side
- Store the `external_event_id` on the appointment record
- Scheduled via `integration_deliveries` table with retry logic

### Email
- Implement email templates for confirmation and reminder
- Send via the email adapter in `src/lib/email/index.ts`
- Track delivery via `integration_deliveries` table
- Update `confirmation_email_sent_at` / `reminder_email_sent_at` on appointment
- Do NOT send until the Google Calendar adapter is confirmed working

### Meta CAPI
- Send `Schedule` event after booking_completed is confirmed
- Use the same `event_id` stored on the appointment for deduplication
- Send only the lead_id reference (no PII in metadata)

---

## Endpoints Created

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/availability` | Returns available time slots for a date |
| POST | `/api/bookings` | Creates an appointment atomically |

## Components Created

| Component | File | Purpose |
|---|---|---|
| `BookingSection` | `src/components/booking/booking-section.tsx` | Main orchestration component |
| `DatePicker` | `src/components/booking/date-picker.tsx` | Date selection with disabled dates |
| `TimeSlots` | `src/components/booking/time-slots.tsx` | Available time slot grid |
| `ReviewConfirm` | `src/components/booking/review-confirm.tsx` | Review and confirm step |
| `BookingSuccess` | `src/components/booking/booking-success.tsx` | Success + add-to-calendar links |

## Migration

`supabase/migrations/20260724000300_create_funnel_appointment.sql`
