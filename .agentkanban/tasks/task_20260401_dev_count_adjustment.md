---
title: "[DEV] Record COUNT_ADJUSTMENT movement"
lane: todo
created: 2026-04-01
updated: 2026-04-01
description: Implement quick count physical adjustment (DB → API → UI)
parent: task_20260401_contract_quick_count.md
---

## Conversation

### user

Break down the quick count contract into vertical slices.

### agent

## [DEV] Record COUNT_ADJUSTMENT movement

Referenced from: [CONTRACT] Quick Count (Physical Inventory Adjustment)

### Vertical Slice

**Goal**: User physically counts item → enters observed qty → system computes delta → records COUNT_ADJUSTMENT movement

**User Story**: "As a user, I want to quickly count items on a shelf/bin and update inventory, so discrepancies are corrected easily"

### Implementation Checklist

- [ ] **DB**:
  - Ensure movements table with type enum including 'COUNT_ADJUSTMENT'
- [ ] **API**: Implement `POST /api/movements/count-adjustment` endpoint
  - Request: { item_id, warehouse_id, bin_id?, observed_quantity, note? }
  - Response (201): movement record with recorded_quantity, observed_quantity, delta, new_balance
  - Response (400): negative observed_qty, missing bin (if required), invalid warehouse/item
- [ ] **Backend Logic**:
  - Compute recorded_quantity = SUM(movements) for (item, warehouse, bin)
  - delta = observed_quantity – recorded_quantity
  - Create movement record (type='COUNT_ADJUSTMENT', quantity=delta)
  - Return full details (before/after/delta) for user confirmation
- [ ] **Authorization**: User or Owner role
- [ ] **Frontend**:
  - Create `QuickCountForm` component
  - Create `CountAdjustmentSummary` component (shows before/after/delta)
  - Create `useCountAdjustment()` mutation hook
  - Form fields:
    1. Warehouse selector (or pre-filled)
    2. Bin selector (if warehouse uses bins, or pre-filled)
    3. Barcode/item search → show recorded qty
    4. Observed quantity input (number, min 0)
    5. Optional note
  - On submit: POST to /api/movements/count-adjustment
  - On success: show summary component (e.g., "Was 50, physically counted 47, delta -3")
- [ ] **Types**: Generate API client
- [ ] **Tests**:
  - Happy path: recorded=50, observed=47 → delta=-3, new_balance=47
  - Correction upward: recorded=10, observed=15 → delta=+5, new_balance=15
  - Multiple adjustments: count, adjust, count again → each adjustment recorded
  - Zero observed: observed=0 → delta = -recorded, new_balance=0
  - Validation: observed<0 → 400
  - Validation: missing bin (if required) → 400

### Definition of Done

- [ ] `POST /api/movements/count-adjustment` endpoint working
- [ ] Delta correctly computed as observed – recorded
- [ ] Movement quantity stored as delta (not observed qty)
- [ ] Frontend form captures input, submits correctly
- [ ] Summary component displays before/after/delta clearly
- [ ] E2E test: add qty → count (enter different qty) → adjustment recorded → item detail shows correct balance

### user
