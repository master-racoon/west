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
- [x] Add route to app main file

## Frontend

- [ ] Run npm run generate-api to update typed client
- [ ] Create useCreateWarehouse() hook
- [ ] Create useWarehouses() hook
- [ ] Create WarehouseCreate.tsx component with form
- [ ] Add form validation and error handling

## Testing

- [ ] Unit/integration tests for POST create (happy path)
- [ ] Integration tests for GET list
- [ ] Error tests: duplicate name (409), non-owner (403), validation (400)
- [ ] Edge cases: boundary lengths, special chars
