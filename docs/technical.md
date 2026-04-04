## Architecture

**Monorepo** — two packages:

- `warehouse-backend/`: Hono API on Cloudflare Pages Functions + Neon Postgres + Drizzle ORM
- `warehouse-frontend/`: React SPA (Vite + TanStack Query + Zustand), deployed to Cloudflare Pages

**Contract-first API**: Backend defines Zod schemas via `@hono/zod-openapi` → serves `/openapi.json` → frontend runs `npm run generate-api` → typed client in `frontend/src/generated-api/`. Never edit `generated-api/` manually.

**Role-based access control**: Owner and User roles. Owners can configure warehouses, manage items/bins, and override constraints. Users can perform inventory operations (add, remove, transfer, count).



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

