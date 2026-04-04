---
applyTo: "**/*.ts"
---

## DFD-First Implementation

**Before implementing:** Read [dfd-first.instructions.md](dfd-first.instructions.md). Your task should map to a DFD flow. Validate that your implementation matches the DFD boundary contracts (request/response schemas, data types, validation rules).

## Adding a Feature (end-to-end)

1. Define backend route with Zod schemas in `warehouse-backend/src/routes/*.ts`
2. Add DB schema changes if needed → `db:generate` → `db:migrate`
3. Run `npm run generate-api` in frontend to update the typed client
4. Create TanStack Query hook in `warehouse-frontend/src/hooks/queries/`
5. Build page/component using the hook



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

## Testing

**Backend** (`npm test` in `warehouse-backend/`): Vitest integration tests against Dockerized Postgres (port 5433). Tests make real HTTP calls. Helpers in `src/tests/helpers.ts` (`clearDatabase()`, `signupUser()`).

**E2E** (`make test-e2e`): Playwright tests in `warehouse-frontend/e2e/`. Full Docker stack. Auth setup in `auth.setup.ts`.


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