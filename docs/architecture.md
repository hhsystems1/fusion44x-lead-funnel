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
