---
title: "TODO - US-1.1 Define Warehouse with Bin Mode"
lane: doing
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
- [x] Implement PUT /api/warehouses/:id handler for warehouse edit
- [x] Add route to app main file

## Frontend

- [x] Sync frontend typed client for warehouse update contract
- [x] Create useCreateWarehouse() hook
- [x] Create useWarehouses() hook
- [x] Create useUpdateWarehouse() hook
- [x] Create WarehouseCreate.tsx component with form
- [x] Add form validation and error handling
- [x] Wire warehouse create flow into the configuration route
- [x] Wire warehouse edit flow into the existing warehouse list

## Testing

- [ ] Unit/integration tests for POST create (happy path)
- [ ] Integration tests for GET list
- [x] Add narrow backend test coverage for PUT update path
- [ ] Error tests: duplicate name (409), non-owner (403), validation (400)
- [ ] Edge cases: boundary lengths, special chars
