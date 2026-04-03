# CLAUDE.md

> This file is automatically read by Claude Code. For the full, canonical AI instructions (with code examples and detailed patterns), see `.github/copilot-instructions.md`.

## Project: Warehouse

Barcode-driven inventory management system for a small family team. Track items across two warehouses (A & B), record every movement, manage bins/shelves, and optimize for fast scanning workflows.

## Architecture

Monorepo with two packages:

- `warehouse-backend/` — Hono API on Cloudflare Pages Functions + Neon Postgres + Drizzle ORM
- `warehouse-frontend/` — React SPA (Vite + TanStack Query + Zustand), deployed to Cloudflare Pages

Contract-first API: backend Zod schemas → `/openapi.json` → frontend `npm run generate-api` → typed client in `frontend/src/generated-api/`. Never edit generated-api/ manually.

Single backend service (`wrangler.toml`) with Neon Postgres.

## Quick Commands

```bash
make dev              # Docker + backend (:8788) + frontend (:5173)
make test             # Backend Vitest + E2E Playwright
make deploy           # Deploy all to Cloudflare
make context-check    # Validate context file freshness

# After any backend route/schema change:
cd warehouse-frontend && npm run generate-api

# DB migrations:
cd warehouse-backend
npm run db:generate && npm run db:migrate
```

## Context Map

Read these before starting non-trivial work:

- **Product spec**: `FRD.md` — full functional requirements, user stories, data model
- **AI instructions**: `.github/copilot-instructions.md` — detailed patterns, code examples, pitfalls (the canonical reference)
- **DB schema (source of truth)**: `warehouse-backend/src/db/schema.ts`
- **Route files**: `warehouse-backend/src/routes/*.ts`

## Key Patterns

**Backend**:

- Environment vars via `c.env.VAR_NAME` (Cloudflare Workers bindings). NEVER `process.env` in route handlers.
- Routes: Zod schemas → `createRoute()` with OpenAPI metadata → `router.openapi(route, handler)`
- Auth: `requireAuth(c)` / `requireRole(c, "owner")` / `assertCanAccessItem(c, itemId)`
- Errors: `throw new NotFoundError("...")` / `throw new ForbiddenError()` from `src/utils/errors.ts`. Never `throw new Error("Forbidden")`.
- DB: `c.get("db")` (Drizzle client), `c.get("auth")` (BetterAuth)

**Frontend**:

- Server state: TanStack Query hooks in `src/hooks/queries/`. Always invalidate after mutations.
- Client state: Zustand in `src/stores/authStore.ts` (session + user role)
- API client: `src/lib/api.ts` (proxy with 401 interceptor → redirect to login)
- Styling: Tailwind with semantic tokens (`text-text-primary`, `bg-bg-secondary`, `border-border`)

## Rules — MUST follow

1. **NEVER restructure components** (rename, split, merge, move, delete) without explicit user confirmation.
2. **Make the smallest possible change.** Fix exactly what was asked. If structural change seems needed, ask first.
3. **No unsolicited markdown files.** Don't create .md summary/doc files unless explicitly requested.
4. **Don't "clean up" unrelated code** while fixing something else.
5. **Don't replace one component with another** (e.g. swapping one form for another).
6. **Don't introduce new files/components** to solve a problem that fits in existing ones.

## Common Pitfalls

1. Forgetting `npm run generate-api` after backend changes
2. Using `process.env` in route handlers (use `c.env.*`)
3. Not invalidating TanStack Query cache after mutations
4. Using `throw new Error("Forbidden")` instead of `throw new ForbiddenError()`
5. Ignoring role-based access control — check `requireRole(c, "owner")` for admin operations
