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
