---
title: "[DEV] US-5.1 Quick Count and Reconcile Inventory"
lane: backlog
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T00:00:00Z
description: "User counts physical items and adjusts inventory to match observation"
labels:
  - flow-4-quick-count
---

## DFD Reference

**Flow**: [Flow-4: Quick Count (Physical Count Adjustment)](../../docs/dfd_level0.md#flow-4-quick-count)

**Data Contract** (from dfd_level0.md):

- Request: `{ warehouse_id: UUID, bin_id?: UUID, item_id: UUID, observed_quantity: int (≥0) }`
- Response: `{ movement_id: UUID, item_id: UUID, previous_balance: int, new_balance: int, delta: int, movement_type: 'COUNT_ADJUSTMENT' }`

---

## Vertical Slice (DB → API → UI)

### 1. Database Schema

`warehouse-backend/src/db/schema.ts`

No new schema — uses existing `movement` table. COUNT_ADJUSTMENT movements record the delta.

---

### 2. API Routes

`warehouse-backend/src/routes/inventory.ts` (update)

**POST /api/inventory/count-adjust**

- **Auth**: Any authenticated user
- **Request Schema**: `CountAdjustRequest`
  - `warehouse_id`: UUID
  - `bin_id`: UUID, optional (required if warehouse.use_bins = true)
  - `item_id`: UUID
  - `observed_quantity`: int, min 0
- **Response Schema**: `CountAdjustResponse`
  - `movement_id`, `item_id`, `previous_balance` (int), `new_balance` (int), `delta` (int, can be negative), `movement_type: 'COUNT_ADJUSTMENT'`
- **Handler**:
  1. Verify warehouse exists
  2. Verify item exists
  3. If warehouse.use_bins = true, verify bin_id provided and exists
  4. Compute current balance for (warehouse, bin?, item)
  5. Calculate delta = observed_quantity - current_balance
  6. Create movement (type='COUNT_ADJUSTMENT', quantity=delta)
  7. Return movement + balances (previous and new)
- **Error Handling**:
  - 404 if warehouse, item, or bin not found
  - 400 if warehouse.use_bins=true but no bin_id

---

### 3. Frontend

**Hook**: `warehouse-frontend/src/hooks/queries/useInventory.ts` (update)

```typescript
export function useCountAdjust() {
  return useMutation({
    mutationFn: (data: CountAdjustRequest) =>
      client.inventory.countAdjust(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "balance"] });
    },
  });
}
```

**Component**: `warehouse-frontend/src/pages/QuickCount.tsx` (new page)

- **Layout**:
  1. Warehouse selector
  2. Bin selector (conditional: if warehouse.use_bins = true, fetch bins for warehouse)
  3. Item scanner or selector
  4. Observed quantity input (number, min=0)
  5. Submit button
  6. Result summary card
- **Flow**:
  - User selects warehouse
  - If warehouse uses bins, user selects bin
  - User scans or selects item
  - Item detail shows current recorded balance
  - User enters observed quantity (what they physically count)
  - Submit: call `countAdjust()`
  - On success:
    - Show result card: "Item [X] | Was: [prev] | Now: [new] | Delta: ±[delta]"
    - If delta > 0: "Found [delta] extra items" (gain)
    - If delta < 0: "Missing [|delta|] items" (loss)
    - If delta = 0: "Inventory matches" (no adjustment)
    - Clear form for next count
  - On error: show error toast
- **Validation**:
  - Observed quantity ≥ 0
  - Item must be selected
  - If warehouse uses bins, bin must be selected

---

## Testing

### Happy Path

- [ ] Backend: Count 12 items, recorded 10 → delta = +2, movement.quantity = 2, new_balance = 12
- [ ] Backend: Count 5 items, recorded 10 → delta = -5, movement.quantity = -5, new_balance = 5
- [ ] Backend: Count 10 items, recorded 10 → delta = 0, movement.quantity = 0, new_balance = 10
- [ ] Frontend: Form submits, result card displays delta correctly

### Error Paths

- [ ] Backend: Observed quantity < 0 → 400 Bad Request
- [ ] Backend: Warehouse.use_bins=true but no bin_id → 400
- [ ] Backend: Invalid item_id → 404
- [ ] Frontend: Item not selected → validation error
- [ ] Frontend: Observed quantity < 0 → validation error

### Edge Cases

- [ ] Backend: Item with 0 recorded balance, count 5 → delta = +5, new_balance = 5
- [ ] Backend: Count creates movement even with delta = 0 (audit trail)
- [ ] Frontend: Rapid counts of same item → each creates movement
- [ ] Frontend: Large observed quantity (boundary testing)

---

## Implementation Notes

- COUNT_ADJUSTMENT movements always succeed (no shortfall check like REMOVE)
- Delta can be positive (found extra), negative (found missing), or zero (matched)
- Movement records the delta, not the full quantity
- User scans item to find current balance before entering observed quantity
- After schema: `npm run db:generate` → `db:migrate` → `generate-api`

## Conversation

### user
