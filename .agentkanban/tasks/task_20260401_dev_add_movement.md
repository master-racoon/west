---
title: "[DEV] Record ADD movement and update balance"
lane: todo
created: 2026-04-01
updated: 2026-04-01
description: Implement add stock endpoint and form UI (DB → API → UI)
parent: task_20260401_contract_add_stock.md
---

## Conversation

### user

Break down the add stock contract into vertical slices.

### agent

## [DEV] Record ADD movement and update balance

Referenced from: [CONTRACT] Add Stock (Receiving)

### Vertical Slice

**Goal**: User enters qty → system records ADD movement → balance updated → user confirmed

**User Story**: "As a user, I want to scan an item and add quantity to a warehouse, so inventory stays accurate when items arrive"

### Implementation Checklist

- [ ] **DB**:
  - Ensure movements table with type enum including 'ADD'
  - Ensure inventory_balances view/computed column works correctly
- [ ] **API**: Implement `POST /api/movements/add` endpoint
  - Request: { item_id, warehouse_id, bin_id?, quantity, note? }
  - Response (201): movement record with new_balance
  - Validation: quantity > 0, warehouse exists, bin exists if required, item exists
- [ ] **Backend Logic**:
  - Validate warehouse.use_bins: if true, bin_id required; if false, bin_id must be null
  - Create movement record (type='ADD', timestamp=now, user=current_user)
  - New balance = SUM of all movements for (item, warehouse, bin)
  - Return movement with computed new_balance
- [ ] **Authorization**: User or Owner role
- [ ] **Frontend**:
  - Create `AddStockForm` component with fields:
    - Warehouse selector (dropdown)
    - Barcode/item search (reuse `ItemSearchBar`)
    - Quantity input (number, min 1)
    - Bin selector (if warehouse.use_bins = true)
    - Optional note (textarea)
    - Confirm button
  - Create `useAddMovement()` mutation hook
  - On submit: POST to /api/movements/add
  - On success: show confirmation (e.g., "Added 50 qty to Warehouse A, Shelf-B")
  - Invalidate related queries (item detail, warehouse inventory)
- [ ] **Types**: Generate API client
- [ ] **Tests**:
  - Happy path: add 50 qty → movement created, balance updated
  - With bin: warehouse.use_bins=true → add qty specifying bin → recorded correctly
  - Without bin: warehouse.use_bins=false → add qty → bin_id ignored or validated as null
  - Validation: qty=0 → 400 Bad Request
  - Validation: qty<0 → 400 Bad Request
  - Missing warehouse → 404
  - Missing bin (when required) → 400

### Definition of Done

- [ ] `POST /api/movements/add` endpoint working
- [ ] Balance correctly computed from movements history (no separate balance table needed if queries efficient)
- [ ] Warehouse bin requirement validated (bin_id required iff warehouse.use_bins=true)
- [ ] Frontend form captures all fields, submits correctly
- [ ] Confirmation message shown after success
- [ ] Form resets after successful submission (optional: pre-populate warehouse/item for next entry)
- [ ] E2E test: add qty → check item detail page shows updated balance

### user
