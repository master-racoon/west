---
title: "TODO - US-1.1 Define Warehouse with Bin Mode"
lane: in-progress
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T00:00:00Z
---

# Iteration 1

## Database
- [ ] Update schema.ts with warehouse table (id, name, use_bins, created_at, updated_at)
- [ ] Add UNIQUE constraint on LOWER(name)
- [ ] Run db:generate
- [ ] Run db:migrate

## Backend API
- [ ] Create warehouse-backend/src/routes/warehouses.ts
- [ ] Define CreateWarehouseRequest Zod schema
- [ ] Define WarehouseResponse Zod schema
- [ ] Implement POST /api/warehouses handler
- [ ] Implement GET /api/warehouses handler
- [ ] Add route to app main file

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
