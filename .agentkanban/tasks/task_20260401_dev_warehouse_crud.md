---
title: "[DEV] CRUD operations for warehouses"
lane: todo
created: 2026-04-01
updated: 2026-04-01
description: Implement warehouse management endpoints (DB → API → UI)
parent: task_20260401_contract_config.md
---

## Conversation

### user

Break down the configuration management contract into vertical slices.

### agent

## [DEV] CRUD operations for warehouses

Referenced from: [CONTRACT] Configuration Management (Admin)

### Vertical Slice

**Goal**: Owner can create, list, edit warehouses, and toggle bin usage

**User Story**: "As an owner, I want to define whether a warehouse uses bins or not, so the system matches how the space is organized"

### Implementation Checklist

- [ ] **DB**:
  - Ensure warehouses table with (id, name, use_bins, created_at, updated_at)
  - created_at & updated_at timestamps
- [ ] **API**: Implement endpoints
  - `GET /api/warehouses` → list all with counts
  - `POST /api/warehouses` → create new
  - `PATCH /api/warehouses/:warehouseId` → update name/use_bins
- [ ] **Backend Logic**:
  - GET: return warehouses with bin_count & total_items aggregates
  - POST: validate name non-empty, use_bins boolean; create & return
  - PATCH: validate name non-empty; if disabling bins, check no items in bins (return 409 if occupied)
- [ ] **Authorization**: Owner role only
- [ ] **Frontend**:
  - Create `WarehouseAdmin` component
  - Create `useWarehouses()` query hook
  - Create `useCreateWarehouse()` mutation hook
  - Create `useUpdateWarehouse(id)` mutation hook
  - UI: list warehouses, create button (modal form), click to edit, toggle use_bins
  - On edit use_bins=true→false: show warning "This will remove all bins. Are you sure?"
- [ ] **Types**: Generate API client
- [ ] **Tests**:
  - Happy path: create warehouse "A" use_bins=false → listed correctly
  - Create with bins: create "B" use_bins=true → bins enabled
  - Edit name: "A" → "Alpha" → name reflected
  - Toggle bins: use_bins=false → set true → bins now enabled
  - Cannot disable with items: create bin, add item, try disable → 409 error
  - Validation: empty name → 400

### Definition of Done

- [ ] `GET /api/warehouses` returns correct schema with counts
- [ ] `POST /api/warehouses` endpoint working, name validation
- [ ] `PATCH /api/warehouses/:warehouseId` endpoint working
- [ ] Disabling bins blocked if items present (409)
- [ ] Frontend warehouse list renders with proper columns
- [ ] Create form modal with name & use_bins fields
- [ ] Edit inline or modal to rename/toggle
- [ ] Confirmation/warning on destructive changes (toggling bins)
- [ ] E2E test: create warehouse → edit name → toggle bins

### user
