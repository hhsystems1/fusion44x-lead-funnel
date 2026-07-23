# Fusion 44X — Lead Funnel

A single-page lead-generation funnel built with Next.js (App Router), TypeScript, and Tailwind CSS.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS 4
- **Linting:** ESLint 9

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Project Structure

```
src/
  app/          — App Router pages and API routes
  components/   — UI components (booking, forms, layout, media, sections, ui)
  config/       — Configuration-driven questions, content, tracking events
  lib/          — Service adapters (analytics, booking, email, meta, security, supabase, validation)
  types/        — Shared TypeScript types
supabase/       — Supabase migrations and Edge Functions
tests/          — e2e, integration, unit tests
docs/           — Architecture and design documentation
```

## Architecture Rules

See `docs/architecture.md`, `docs/tracking-plan.md`, and `docs/security-boundaries.md`.
