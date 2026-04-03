---
title: "[DEV] Record REMOVE movement with balance validation"
lane: todo
created: 2026-04-01
updated: 2026-04-01
description: Implement remove stock endpoint with negative inventory check (DB → API → UI)
parent: task_20260401_contract_remove_stock.md
---

## Conversation

### user

Break down the remove stock contract into vertical slices.

### agent

## [DEV] Record REMOVE movement with balance validation

Referenced from: [CONTRACT] Remove Stock (Consumption/Sale)

### Vertical Slice

**Goal**: User enters qty to remove → system validates balance → blocks if insufficient (unless owner override) → records REMOVE movement

**User Story**: "As a user, I want to scan an item and remove quantity, so inventory reflects items sold, consumed, or discarded"

### Implementation Checklist

- [ ] **DB**:
  - Ensure movements table with type enum including 'REMOVE'
- [ ] **API**: Implement `POST /api/movements/remove` endpoint
  - Request: { item_id, warehouse_id, bin_id?, quantity, note?, force_negative?, override_reason? }
  - Response (201): movement record with new_balance, warned_negative flag
  - Response (400): if balance insufficient and force_negative=false
  - Response (403): if force_negative=true but user is not Owner
- [ ] **Backend Logic**:
  - Compute current_balance = SUM(movements) for (item, warehouse, bin)
  - If quantity > current_balance AND force_negative=false: return 400
  - If force_negative=true: require owner role and override_reason; proceed anyway
  - Create movement record (type='REMOVE', quantity=qty)
  - Return movement with new_balance (may be negative if forced)
- [ ] **Authorization**: User or Owner. Only Owner can use force_negative.
- [ ] **Frontend**:
  - Create `RemoveStockForm` component
  - Create `useRemoveMovement()` mutation hook
  - Form flow:
    - Warehouse selector
    - Barcode/item search → show current balance
    - Quantity input (number, min 1)
    - Bin selector (if warehouse.use_bins=true)
    - Optional note
    - Estimate message: "Current balance: 50, will have 10 after"
  - On submit:
    - If balance will go negative (and user is not owner): show error "Insufficient stock"
    - If owner and negative: show warning "This will result in negative stock. Enter override reason?"
    - Modal prompts for override_reason, submits with force_negative=true
  - On success: show confirmation
- [ ] **Types**: Generate API client
- [ ] **Tests**:
  - Happy path: current=50, remove 10 → new_balance=40
  - Insufficient balance (user): current=10, try remove 50 → 400 error shown
  - Insufficient balance (owner override): current=10, remove 50, override → new_balance=-40, warned_negative=true
  - Missing reason on force_negative: owner tries to override without reason → 400
  - Non-owner attempts force_negative → 403
  - Validation: qty=0 or qty<0 → 400

### Definition of Done

- [ ] `POST /api/movements/remove` endpoint validates balance correctly
- [ ] Role-based access: force_negative restricted to Owner
- [ ] override_reason required if force_negative=true
- [ ] Frontend form shows current balance before/after estimate
- [ ] Insufficient balance shows error for regular users
- [ ] Owner sees warning + override modal
- [ ] Confirmation message after removal
- [ ] E2E test (user): add stock → remove (sufficient) → works
- [ ] E2E test (owner): add stock → remove more (insufficient) → override → succeeds with negative

### user
