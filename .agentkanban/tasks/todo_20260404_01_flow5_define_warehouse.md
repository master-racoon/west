---
title: "TODO - US-1.1 Define Warehouse with Bin Mode"
lane: in-progress
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T00:00:00Z
---

# Iteration 1

## Database

- [x] Update schema.ts with warehouse table (id, name, use_bins, created_at, updated_at)
- [x] Add UNIQUE constraint on LOWER(name)
- [x] Run db:generate
- [x] Run db:migrate

## Backend API

- [x] Create warehouse-backend/src/routes/warehouses.ts
- [x] Define CreateWarehouseRequest Zod schema
- [x] Define WarehouseResponse Zod schema
- [x] Implement POST /api/warehouses handler
- [x] Implement GET /api/warehouses handler
- [x] Add route to app main file

## Frontend

- [ ] Run npm run generate-api to update typed client
- [x] Create useCreateWarehouse() hook
- [x] Create useWarehouses() hook
- [x] Create WarehouseCreate.tsx component with form
- [x] Add form validation and error handling

## Testing

- [x] Unit/integration tests for POST create (happy path)
- [x] Integration tests for GET list
- [x] Error tests: duplicate name (409), non-owner (403), validation (400)
- [x] Edge cases: boundary lengths, special chars

# Iteration 2 — Local dev environment & E2E tests

## Local Dev Fixes

- [x] Replace mock DB in app.ts with real Neon/Drizzle connection
- [x] Create warehouse-backend/src/db/index.ts with createDbClient() (neon proxy support)
- [x] Fix Vite proxy rewrite that stripped /api prefix
- [x] Fix migrate.ts to use .env.local pattern for direct Postgres
- [x] Create .env.local with direct Postgres URL for migrations
- [x] Run migrations successfully against Docker Postgres

## Error Handling

- [x] Fix api.ts to propagate HTTP status code in error messages (was throwing generic error)

## E2E Tests (Playwright)

- [x] Create warehouse-frontend/e2e/warehouse-create.spec.ts
- [x] Test: create warehouse without bins → success
- [x] Test: create warehouse with bins → success
- [x] Test: duplicate warehouse name → shows "already exists" error
- [x] Test: empty name → form validation prevents submission
- [x] Test: button disabled while submitting
- [x] All 5 E2E tests passing
