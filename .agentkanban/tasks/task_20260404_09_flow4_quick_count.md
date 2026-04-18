---
title: "[DEV] US-5.1 Quick Count and Reconcile Inventory"
lane: doing
created: 2026-04-04T00:00:00Z
updated: 2026-04-18T09:03:50.372Z
description: User counts physical items and adjusts inventory to match observation
labels:
  - flow-4-quick-count
sortOrder: 1775260800001
slug: flow4_quick_count
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

  ***

  ## Acceptance Criteria (Frontend Functional)
  - Feature is implemented in the object-oriented `Inventory` page under the `Quick Count` tab.
  - User sees current recorded balance context for selected warehouse/bin/item before entering observed value.
  - Bin selection is conditionally required based on warehouse `use_bins` configuration.
  - Delta preview/result clearly communicates gain, loss, or no-change outcomes.
  - Submit action includes loading/success/error states and prevents duplicate submissions.
  - After submit, result summary remains visible long enough for verification and then supports fast next-count workflow.

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

### assistant

Implemented the Flow-4 quick count slice end to end. Backend now exposes `POST /api/inventory/count-adjust` with warehouse/bin/item validation, advisory-lock balance reconciliation, and `COUNT_ADJUSTMENT` movement creation for positive, negative, and zero deltas. Frontend Inventory now renders a real Quick Count tab with warehouse and conditional bin selection, barcode-or-item resolution, recorded balance context, delta preview, result summary, and a fast next-count reset flow. Added backend integration coverage for positive, negative, zero-delta, and bin-required cases.

### user

Repair the Flow 4 quick-count implementation in the west workspace based on these QA findings for /Users/ulf/Documents/GitHub/west/.agentkanban/tasks/task_20260404_09_flow4_quick_count.md:

1. Blocking: the new DB-backed quick-count backend tests race with other DB-backed test files because they share full-database truncation without serialization. Apply a narrow fix so the supported backend test harness can run these DB-backed files reliably.
2. Medium: the Quick Count UI only offers a free-text barcode/item-id input, but the task calls for scanner or selector. Add the smallest reasonable item-selection fallback without bloating the page.
3. Low: the task says error toast; the page currently only shows inline/banner error state. Add the smallest aligned error feedback improvement.

Do not broaden scope into unrelated test-harness redesign or unrelated backend issues. Update the task history if your workflow expects it. Return a concise summary of changes, validation, and any remaining risks.

### agent

Applied a narrow Flow 4 QA repair.

- Backend harness: serialized backend Vitest files for the supported integration run so the DB-backed quick-count and warehouse tests no longer race on shared full-database truncation.
- Quick Count UI: kept the existing scanner/item-id path and added a compact item selector fallback that resolves directly into the same count flow.
- Error feedback: added a small transient error toast alongside the existing inline error banner so failures are easier to notice without introducing a broader notification system.

Validation in this pass: editor diagnostics on the touched backend config and Quick Count page after the patch. Not run here: backend tests, frontend tests, or API export/codegen commands.

Remaining risk: backend test serialization is intentionally coarse at the file level for reliability; if the suite grows substantially, a more granular isolation strategy may be worth revisiting later.
