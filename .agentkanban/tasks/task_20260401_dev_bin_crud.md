---
title: "[DEV] CRUD operations for bins"
lane: todo
created: 2026-04-01
updated: 2026-04-01
description: Implement bin (shelf/location) management endpoints (DB → API → UI)
parent: task_20260401_contract_config.md
---

## Conversation

### user

Break down the configuration management contract into vertical slices.

### agent

## [DEV] CRUD operations for bins

Referenced from: [CONTRACT] Configuration Management (Admin)

### Vertical Slice

**Goal**: Owner can create bins in warehouses that use bins, rename, and delete (if empty)

**User Story**: "As an owner, I want to... manage bins, so the system reflects the real environment"

### Implementation Checklist

- [ ] **DB**:
  - Ensure bins table (id, warehouse_id FK, name, created_at, updated_at)
  - Ensure warehouse.use_bins is checked before allowing bin CRUD
- [ ] **API**: Implement endpoints
  - `GET /api/warehouses/:warehouseId/bins` → list bins for warehouse
  - `POST /api/warehouses/:warehouseId/bins` → create bin
  - `PATCH /api/bins/:binId` → rename bin
  - `DELETE /api/bins/:binId` → delete bin (validation: must be empty)
- [ ] **Backend Logic**:
  - GET bins: return bins with item count aggregates
  - POST bin: validate warehouse exists & use_bins=true, name non-empty; create
  - PATCH bin: validate name non-empty; update
  - DELETE bin: check if any movements reference bin; if yes, return 409; otherwise delete
- [ ] **Authorization**: Owner role only
- [ ] **Frontend**:
  - Create `BinAdmin` component (list bins, create/edit/delete UI)
  - Create `useWarehouseBins(warehouseId)` query hook
  - Create `useCreateBin(warehouseId)` mutation hook
  - Create `useUpdateBin(binId)` mutation hook
  - Create `useDeleteBin(binId)` mutation hook
  - UI: list bins per warehouse (shown in warehouse detail or separate page)
  - Create button: modal with name input
  - Edit row: inline or modal to rename
  - Delete button: with confirmation "This bin has X items. Are you sure?"
- [ ] **Types**: Generate API client
- [ ] **Tests**:
  - Happy path: warehouse use_bins=true → create bin "Shelf-A" → listed
  - Cannot create in non-bin warehouse: warehouse use_bins=false → POST bin → 400
  - Rename bin: "Shelf-A" → "Shelf-A-1" → reflected
  - Cannot delete non-empty bin: add item to bin → try delete → 409
  - Delete empty bin: create bin → delete (before any movements) → succeeds
  - Validation: empty name → 400

### Definition of Done

- [ ] `GET /api/warehouses/:warehouseId/bins` returns correct schema with item counts
- [ ] `POST /api/warehouses/:warehouseId/bins` endpoint with validation (use_bins=true)
- [ ] `PATCH /api/bins/:binId` endpoint working
- [ ] `DELETE /api/bins/:binId` endpoint with emptiness check (409 if occupied)
- [ ] Frontend bin list rendered per warehouse
- [ ] Create bin modal with name field
- [ ] Edit/rename bin inline or modal
- [ ] Delete button with confirmation showing occupancy
- [ ] Cannot create bins in non-bin warehouses (UI hides or error)
- [ ] E2E test: warehouse with bins → create bin → rename → try delete (has items) → error

### user
