# Warehouse - AI Coding Instructions

## Architecture

**Monorepo** — two packages:

- `warehouse-backend/`: Hono API on Cloudflare Pages Functions + Neon Postgres + Drizzle ORM
- `warehouse-frontend/`: React SPA (Vite + TanStack Query + Zustand), deployed to Cloudflare Pages

**Contract-first API**: Backend defines Zod schemas via `@hono/zod-openapi` → serves `/openapi.json` → frontend runs `npm run generate-api` → typed client in `frontend/src/generated-api/`. Never edit `generated-api/` manually.

**Role-based access control**: Owner and User roles. Owners can configure warehouses, manage items/bins, and override constraints. Users can perform inventory operations (add, remove, transfer, count).

## Dev Workflow

```bash
make dev            # Docker (Postgres) + backend (:8788) + frontend (:5173)
make test           # Backend Vitest + E2E Playwright, both via Docker
make deploy         # Deploy backend + frontend to Cloudflare
```

After any backend route/schema change:

```bash
cd warehouse-frontend && npm run generate-api
```

DB migrations (source of truth: `backend/src/db/schema.ts`):

```bash
cd warehouse-backend
npm run db:generate      # Generate migration from schema changes
npm run db:migrate       # Apply locally
npm run db:migrate:prod  # Apply to production
```

## Context Map — Where to Find What

Before starting any non-trivial task, consult the relevant context sources:

| Source                | Path                                | When to read                                                                                             |
| --------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Product spec**      | `FRD.md`                            | For understanding requirements, user stories, data model, and functional specifications.                 |
| **This file**         | `.github/copilot-instructions.md`   | Architecture, patterns, pitfalls, agent rules. Always loaded by GitHub Copilot.                          |
| **CLAUDE.md**         | `CLAUDE.md` (repo root)             | Same core rules, formatted for Claude Code / non-Copilot agents.                                         |
| **DB schema**         | `warehouse-backend/src/db/schema.ts` | Source of truth for data model.                                                                          |
| **Route files**       | `warehouse-backend/src/routes/*.ts`  | API endpoint definitions and request/response schemas.                                                   |

> **Staleness warning**: When in doubt, verify against actual source code. The DB schema (`warehouse-backend/src/db/schema.ts`) and route files are always the source of truth.

## Backend Patterns

**Environment variables** — access via Hono context `c.env.VARIABLE_NAME` (Cloudflare Workers bindings). Never use `process.env` in route handlers; it doesn't exist in Workers. `process.env` is only valid in Node scripts (migrations, tests, seeds).

```typescript
// ✅ In route handlers
const bucket = c.env.VIDEOS_BUCKET;
const frontendUrl = c.env.FRONTEND_URL;

// ✅ In migrations/seeds (Node scripts)
const dbUrl = process.env.DATABASE_URL;
```

**Route definition** (`warehouse-backend/src/routes/*.ts`): Define Zod request/response schemas → `createRoute()` with OpenAPI metadata → `router.openapi(route, handler)`. See existing routes for the canonical pattern.

**Authorization** (`warehouse-backend/src/authorization/middleware.ts`):

```typescript
const user = requireAuth(c); // 401 if not logged in
const owner = requireRole(c, "owner"); // 403 if not owner
await assertCanAccessItem(c, itemId); // ownership/access check
```

**Errors** — use `AppError` subclasses from `warehouse-backend/src/utils/errors.ts`:

```typescript
import { ForbiddenError, NotFoundError } from "../utils/errors";
throw new NotFoundError("Item not found"); // → 404
throw new ForbiddenError(); // → 403
```

The `onError` handler in `app.ts` maps these to HTTP responses. Avoid `throw new Error("Forbidden:...")`.

**DB access**: Each request gets `c.get("db")` (Drizzle client) and `c.get("auth")` (BetterAuth) via middleware in `app.ts`.

## Frontend Patterns

**Server state** — TanStack Query hooks in `src/hooks/queries/` (one file per domain). Always invalidate after mutations:

```typescript
// src/hooks/queries/useItems.ts
export function useItems() {
  return useQuery({
    queryKey: ["items"],
    queryFn: () => client.items.getItems(),
  });
}
```

**Client state** — Zustand in `src/stores/authStore.ts` (user session, role, persisted to localStorage).

**API client** (`src/lib/api.ts`): Proxy wrapper around the generated client. Intercepts 401s → dispatches `auth:unauthorized` → global redirect to login.

**Styling**: Tailwind with semantic CSS variable tokens — `text-text-primary`, `bg-bg-secondary`, `border-border`. Dark mode via `prefers-color-scheme`. Defined in `tailwind.config.js` + `index.css`.

**Component structure**: `pages/` (route-level, fetch data with hooks) → `components/` (reusable, receive props). Heavy pages use `React.lazy()` + `Suspense` (see `App.tsx`).

## Testing

**Backend** (`npm test` in `warehouse-backend/`): Vitest integration tests against Dockerized Postgres (port 5433). Tests make real HTTP calls. Helpers in `src/tests/helpers.ts` (`clearDatabase()`, `signupUser()`).

**E2E** (`make test-e2e`): Playwright tests in `warehouse-frontend/e2e/`. Full Docker stack. Auth setup in `auth.setup.ts`.

## Key Files

| Purpose                        | Path                                        |
| ------------------------------ | ------------------------------------------- |
| App + middleware chain         | `warehouse-backend/src/app.ts`              |
| DB schema (source of truth)    | `warehouse-backend/src/db/schema.ts`        |
| Auth middleware                | `warehouse-backend/src/authorization/middleware.ts` |
| Error classes                  | `warehouse-backend/src/utils/errors.ts`     |
| Zod request/response schemas   | `warehouse-backend/src/schemas/`            |
| Backend routes                 | `warehouse-backend/src/routes/`             |
| Test helpers                   | `warehouse-backend/src/tests/helpers.ts`    |
| API client + 401 interceptor   | `warehouse-frontend/src/lib/api.ts`         |
| Auth store + user session      | `warehouse-frontend/src/stores/authStore.ts` |
| Query hooks                    | `warehouse-frontend/src/hooks/queries/`     |
| Dev orchestration              | `Makefile`                                  |
| Product requirements           | `FRD.md`                                    |

## Adding a Feature (end-to-end)

1. Define backend route with Zod schemas in `warehouse-backend/src/routes/*.ts`
2. Add DB schema changes if needed → `db:generate` → `db:migrate`
3. Run `npm run generate-api` in frontend to update the typed client
4. Create TanStack Query hook in `warehouse-frontend/src/hooks/queries/`
5. Build page/component using the hook

## Common Pitfalls

1. **Forgetting `npm run generate-api`** after backend changes — frontend client will be stale
2. **Using `process.env` in route handlers** — use `c.env.*` for Workers bindings
3. **Not invalidating queries** after mutations — always `queryClient.invalidateQueries({ queryKey: [...] })`
4. **Ignoring role-based access control** — check `requireRole(c, "owner")` for admin operations
5. **Using `throw new Error("Forbidden")` instead of `throw new ForbiddenError()`** — use the `AppError` subclasses

## ⚠️ AI Agent Rules — MUST follow on every single edit

### NEVER restructure components without explicit user confirmation

- Do NOT rename, split, merge, move, or delete components unless the user explicitly says so
- Do NOT replace one component with another
- Do NOT rewrite a whole component when a small targeted change will do
- Do NOT introduce new files or components to solve a problem that fits in existing ones
- Do NOT "clean up" or "simplify" unrelated code while fixing something else

### Make the smallest possible change

Fix exactly what was asked. Nothing more. If structural change seems needed, **ask first**.

### No unsolicited markdown files

Do not create `.md` summary or documentation files unless the user explicitly requests them.
