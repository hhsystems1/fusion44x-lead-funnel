# Server Data Layer

## Endpoints

### `POST /api/funnel-sessions`

Create or reuse an anonymous funnel session.

**Input:**
```json
{
  "anonymous_id": "string (required, max 128 chars, trimmed)",
  "page_version": "string (required, max 32 chars, trimmed)",
  "landing_url": "string (optional, max 2048)",
  "referrer": "string (optional, max 2048)",
  "utm_source": "string (optional, max 256)",
  "utm_medium": "string (optional, max 256)",
  "utm_campaign": "string (optional, max 256)",
  "utm_content": "string (optional, max 256)",
  "utm_term": "string (optional, max 256)",
  "fbclid": "string (optional, max 512)",
  "fbc": "string (optional, max 512)",
  "fbp": "string (optional, max 512)",
  "device_category": "string (optional, max 64)"
}
```

**Response `201` (created):**
```json
{
  "id": "uuid",
  "anonymous_id": "string",
  "status": "active",
  "page_version": "string",
  "started_at": "timestamp"
}
```

**Response `200` (existing — idempotent on `anonymous_id`):**
Same shape as 201.

**Response `422` (validation error):**
```json
{
  "error": { "status": 422, "message": "Validation failed" }
}
```

**Behavior:** If a session with the given `anonymous_id` already exists, the existing session is returned (200) instead of creating a duplicate. Attribution fields (UTM, fbclid, fbc, fbp) are set on creation only and are not returned in the response.

---

### `POST /api/funnel-events`

Insert an append-only internal tracking event.

**Input:**
```json
{
  "session_id": "uuid (required)",
  "lead_id": "uuid (optional)",
  "event_name": "string (required, must be canonical event name)",
  "section_id": "string (optional, max 128)",
  "step_id": "string (optional, max 128)",
  "question_id": "string (optional, max 128)",
  "answer_code": "string (optional, max 128)",
  "duration_ms": "number (optional, must be >= 0, must be integer)",
  "page_version": "string (required, max 32)",
  "event_id": "uuid (optional)",
  "metadata": "object (optional, max 10 keys, no PII keys)",
  "occurred_at": "ISO datetime string (optional)"
}
```

**Response `201`:**
```json
{
  "success": true,
  "id": "uuid"
}
```

**Validation:**
- `event_name` must be one of the 27 canonical event names from `src/config/tracking-events.ts`.
- `duration_ms` must not be negative.
- `metadata` must be a JSON object with at most 10 keys.
- PII keys (`email`, `phone`, `first_name`, `last_name`, `name`, `address`) are rejected in `metadata` (case-insensitive check).
- The referenced `session_id` must exist in `funnel_sessions`.

**Database:** `funnel_events` is an append-only table. Rows are never updated or deleted by application code.

---

### `POST /api/leads`

Create a lead and link it to an existing anonymous session.

**Input:**
```json
{
  "session_id": "uuid (required)",
  "contact": {
    "first_name": "string (required, max 100)",
    "last_name": "string (required, max 100)",
    "email": "string (required, valid email, normalized to lowercase)",
    "phone": "string (required, normalized, digits/spaces/-().+ only)",
    "zip_code": "string (required, max 20)",
    "preferred_contact_method": "'email' | 'phone' | 'text' (optional)"
  },
  "diagnostic": {
    "water_feature": "'pool' | 'spa' | 'pool_and_spa'",
    "installation_type": "'in_ground' | 'above_ground' | 'not_sure'",
    "pool_size": "'under_10000' | '10000_to_20000' | '20001_to_30000' | 'over_30000' | 'not_sure'",
    "current_treatment": "'chlorine' | 'salt' | 'bromine' | 'pool_service' | 'other' | 'not_sure'",
    "current_issues": "array of issue codes (min 1)",
    "primary_goal": "'reduce_chemicals' | 'clearer_water' | 'more_comfortable_water' | 'easier_maintenance' | 'protect_equipment' | 'all_of_the_above'"
  },
  "consent": {
    "consent_to_contact": "true (required, must be exactly true)",
    "marketing_consent": "boolean (optional, defaults to false)",
    "consent_text_version": "string (required, max 32)"
  },
  "source": "string (optional, max 128)"
}
```

**Response `201`:**
```json
{
  "success": true,
  "lead_id": "uuid"
}
```

**Normalization:**
- Email is lowercased and trimmed.
- Phone digits are extracted; a 10-digit number gets `+1` prepended (US default). An 11-digit number starting with `1` gets `+` prepended.

**Consent:** `consent_to_contact` must be strictly `true`. This is enforced at the API validation layer and independently re-checked inside the PostgreSQL RPC function.

---

## Transaction / RPC Flow

The lead creation workflow is executed in a single PostgreSQL RPC call:

```
POST /api/leads
  → Zod validation + normalization
  → supabase.rpc("create_lead_from_funnel_session", { ... })
    → SELECT ... FOR UPDATE (lock session row)
    → Reject if session already linked to a lead
    → Reject if consent_to_contact is not true
    → Reject null/empty/duplicate current_issues
    → INSERT into leads
    → INSERT lead_answers rows (single-select + multi-select)
    → UPDATE funnel_sessions (lead_id, status = 'lead_created')
    → INSERT funnel_events (lead_created event)
    → RETURN new lead ID
```

The RPC function `create_lead_from_funnel_session` is defined in:
`supabase/migrations/20260724000200_create_lead_from_funnel_session.sql`

### RPC Function Signature

```
create_lead_from_funnel_session(
  p_session_id              uuid,
  p_first_name              text,
  p_last_name               text,
  p_email                   text,
  p_phone                   text,
  p_zip_code                text,
  p_water_feature           text,
  p_installation_type       text,
  p_pool_size               text,
  p_current_treatment       text,
  p_current_issues          text[],
  p_primary_goal            text,
  p_consent_to_contact      boolean,
  p_consent_text_version    text,
  p_preferred_contact_method text,
  p_marketing_consent       boolean,
  p_source                  text
) returns uuid
```

All parameters are required (no DEFAULT values). The API route passes explicit values for every parameter:
- `p_preferred_contact_method` receives `null` when the field is omitted
- `p_marketing_consent` receives `false` when the field is omitted (Zod default)
- `p_source` receives `null` when the field is omitted

This design avoids PostgreSQL syntax errors caused by defaulted parameters preceding non-defaulted ones.

### RPC-Level Validation

The RPC function performs independent validation before any write:

| Check | Exception Code | Condition |
|-------|---------------|-----------|
| Session exists | `P0002` | `SELECT ... FOR UPDATE` raises `no_data_found` if missing |
| Session already linked | `P0003` | `lead_id` is not null on the locked row |
| Consent required | `P0004` | `p_consent_to_contact IS NOT TRUE` |
| current_issues not null | `P0005` | `p_current_issues IS NULL` |
| current_issues not empty | `P0006` | `array_length = 0` |
| current_issues no duplicates | `P0007` | Duplicate values after `unnest` |

### Concurrency

The RPC locks the session row with `SELECT ... FOR UPDATE` before checking `lead_id`. This prevents two simultaneous requests from both proceeding — the second caller blocks until the first completes, then sees the updated `lead_id` and raises `P0003`.

### Security

- `SECURITY DEFINER` — executes with owner privileges regardless of the caller's role.
- `search_path = public` — prevents search-path injection attacks.
- No dynamic SQL (EXECUTE) — all queries use parameterized PL/pgSQL.
- EXECUTE revoked from `public`, `anon`, and `authenticated` roles.
- EXECUTE granted only to `service_role`.

---

## Service-Role Boundary

| Layer | Key Used | Environment Variable | Browser Accessible |
|-------|----------|---------------------|-------------------|
| Server API Routes | `service_role` | `SUPABASE_SERVICE_ROLE_KEY` | ❌ No |
| Client Components | `anon` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes |

The `service_role` key bypasses Row Level Security. All API routes that write to the database use the server-only Supabase client (`getServerSupabaseClient()`) which imports the service-role key.

The server-only module is marked with `import "server-only"` to prevent accidental client-side imports.

---

## Error Model

All errors return a consistent shape:

```json
{
  "error": {
    "status": 400 | 422 | 429 | 500,
    "message": "Human-readable message"
  }
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request body (too large, invalid JSON) |
| 405 | Method not allowed (only POST is accepted) |
| 422 | Validation failure (Zod schema) |
| 429 | Rate limited |
| 500 | Internal server error (details logged server-side only) |

Server logs include the `requestId` for correlation. Error details (including database errors) are never returned to the user.

---

## Rate Limiting

Rate limiting uses an in-memory `Map` keyed by client IP address.

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/funnel-sessions` | 30 requests | 60 seconds |
| `/api/funnel-events` | 120 requests | 60 seconds |
| `/api/leads` | 10 requests | 60 seconds |

**Warning:** This is a temporary development-only implementation. In-memory rate limiting does not scale across multiple server processes or instances. For production, replace with a shared store such as [Upstash Rate Limiting](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview) or an equivalent Redis-based solution.

---

## Data Never Returned to the Browser

- `SUPABASE_SERVICE_ROLE_KEY` — never imported in client components
- `SUPABASE_SERVICE_ROLE_KEY` — never logged
- Raw database error messages — never included in API responses
- Full request bodies — never logged
- Attribution fields (UTM, fbclid, fbc, fbp) — omitted from session response; stored but not returned
- PII — never accepted in `funnel_events.metadata`

---

## Unimplemented

- Visual funnel UI (components, pages)
- Booking (Google Calendar integration)
- Meta Conversions API (CAPI) events
- Email notifications (lead created, booking confirmation)
- Shared-store rate limiting (Upstash / Redis)
- Admin read policies for authenticated roles
- Production deployment configuration