---
title: "[DEV] Record TRANSFER movement between warehouses"
lane: todo
created: 2026-04-01
updated: 2026-04-01
description: Implement transfer stock endpoint (DB → API → UI)
parent: task_20260401_contract_transfer_stock.md
---

## Conversation

### user

Break down the transfer stock contract into vertical slices.

### agent

## [DEV] Record TRANSFER movement between warehouses

Referenced from: [CONTRACT] Transfer Stock (Between Warehouses)

### Vertical Slice

**Goal**: User selects source/dest warehouses, item, qty → system validates source balance → records TRANSFER → both balances updated

**User Story**: "As a user, I want to transfer items between warehouses, so inventory location stays correct"

### Implementation Checklist

- [ ] **DB**:
  - Ensure movements table with type enum including 'TRANSFER'
  - Ensure movements has both source and dest warehouse/bin fields
- [ ] **API**: Implement `POST /api/movements/transfer` endpoint
  - Request: { item_id, quantity, source_warehouse_id, source_bin_id?, dest_warehouse_id, dest_bin_id?, note? }
  - Response (201): movement record with source_new_balance, dest_new_balance
  - Response (400): insufficient source balance, missing bins (if required), same source/dest
- [ ] **Backend Logic**:
  - Validate source_warehouse ≠ dest_warehouse (or same warehouse different bin?)
  - Validate source bin exists if source warehouse uses bins
  - Validate dest bin exists if dest warehouse uses bins
  - Compute source_current_balance
  - If quantity > source_current_balance: return 400
  - Create movement record (type='TRANSFER', source_warehouse/bin, dest_warehouse/bin)
  - Return both balances
- [ ] **Authorization**: User or Owner role
- [ ] **Frontend**:
  - Create `TransferStockForm` component with multi-step flow
  - Create `WarehouseSelector` reusable component (warehouse dropdown + bin selector)
  - Create `useTransferMovement()` mutation hook
  - Form fields:
    1. Barcode/item search
    2. Quantity input
    3. Source warehouse + bin (if required)
    4. Dest warehouse + bin (if required)
    5. Optional note
  - On submit: POST to /api/movements/transfer
  - On success: show confirmation with both balances
- [ ] **Types**: Generate API client
- [ ] **Tests**:
  - Happy path: transfer 10 from A to B → A decreases 10, B increases 10
  - With bins: transfer from A/Shelf1 to B/Shelf2 → recorded correctly
  - Insufficient source: source=5, transfer 10 → 400 error
  - Same source/dest: try A→A → 400 error
  - Missing dest bin: dest warehouse uses bins, bin_id not provided → 400
  - Validation: qty=0 or qty<0 → 400

### Definition of Done

- [ ] `POST /api/movements/transfer` endpoint working
- [ ] Balance validation against source warehouse/bin
- [ ] Both source and dest balances correctly updated
- [ ] Bin requirement enforced per warehouse config
- [ ] Frontend form captures all fields, submits correctly
- [ ] Confirmation shows both before/after balances
- [ ] E2E test: add qty to A → transfer to B → check both item details

### user
