---
title: "[DEV] US-3.1 Scan and Remove Stock from Warehouse"
lane: todo
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T00:00:00Z
description: "User removes quantity from warehouse with owner override for negative stock"
labels:
  - flow-2-remove-stock
---

## DFD Reference

**Flow**: [Flow-2: Remove Stock (Consumption/Sale)](../../docs/dfd_level0.md#flow-2-remove-stock)

**Data Contract** (from dfd_level0.md):

- Request: `{ warehouse_id: UUID, item_id: UUID, quantity: int (>0), bin_id?: UUID, owner_override?: boolean }`
- Response (success): `{ movement_id: UUID, quantity_removed: int, balance_after: int }`
- Response (insufficient): `{ warning: string, owner_approval_required: boolean }`

---

## Vertical Slice (DB → API → UI)

### 1. Database Schema

`warehouse-backend/src/db/schema.ts`

No new schema — uses existing `movement` table from task_20260404_04.

**Add column to movement table** (if not present):

- `override_by_owner` (BOOLEAN, DEFAULT false, nullable) — flag for owner-approved negative stock

---

### 2. API Routes

`warehouse-backend/src/routes/inventory.ts` (update)

**POST /api/inventory/remove**

- **Auth**: Any authenticated user
- **Request Schema**: `RemoveStockRequest`
  - `warehouse_id`: UUID
  - `item_id`: UUID
  - `quantity`: int, min 1
  - `bin_id`: UUID, optional (required if warehouse.use_bins = true)
  - `owner_override`: boolean, optional (default: false)
- **Response Schema**:
  - Success: `{ success: true, movement_id: UUID, quantity_removed: int, balance_after: int }`
  - Warning (insufficient): `{ success: false, warning: string, owner_approval_required: true, current_balance: int, requested_quantity: int }`
- **Handler**:
  1. Fetch warehouse
  2. Lookup item
  3. If warehouse.use_bins = true, verify bin_id
  4. Compute current balance for (warehouse, bin?, item)
  5. If quantity > balance:
     - If owner_override = true: proceed (create movement with override flag, balance goes negative)
     - If owner_override = false: return 402 "Insufficient Stock" with warning (user must get owner approval)
  6. If quantity ≤ balance: create movement, return success
  7. Return movement + computed balance_after
- **Error Handling**:
  - 404 if item not found
  - 404 if warehouse/bin not found
  - 400 if warehouse.use_bins=true but no bin_id
  - 402 (or 422) "Insufficient Stock" if quantity exceeds balance and no override
  - 403 if non-owner tries to override

---

### 3. Frontend

**Hook**: `warehouse-frontend/src/hooks/queries/useInventory.ts` (update)

```typescript
export function useRemoveStock() {
  return useMutation({
    mutationFn: (data: RemoveStockRequest) =>
      client.inventory.removeStock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "balance"] });
    },
  });
}
```

**Component**: `warehouse-frontend/src/pages/RemoveStock.tsx` (new page)

- **Layout**:
  1. Warehouse selector
  2. Barcode/Item input (with scanner integration)
  3. Quantity input
  4. Bin selector (conditional: if warehouse.use_bins = true)
  5. Submit button
- **Flow**:
  - User selects warehouse, scans item, enters quantity
  - On submit:
    - Call `removeStock()` with owner_override = false
    - If success: toast "Removed X qty", clear form
    - If 402 "Insufficient Stock": show warning modal
      - Display current_balance, requested_quantity, shortfall
      - "Owner Approval Required" message
      - Button: "Request Owner Approval" (opens link to owner dashboard or sends notification)
      - Button: "Cancel"
- **Owner Approval Workflow**:
  - Owner receives notification (via toast/dashboard) of pending removals
  - Owner can view removal request (item, warehouse, quantity, original user)
  - Owner button: "Approve" → submits removeStock with owner_override = true
  - Owner button: "Reject" → closes request, user cannot proceed

  ***

  ## Acceptance Criteria (Frontend Functional)
  - Feature is implemented in the object-oriented `Inventory` page under the `Remove` tab.
  - Remove workflow shows item/warehouse context and current availability before final submit.
  - Bin selector appears only when selected warehouse uses bins and is required before submit.
  - Shortfall path is handled as a guided UI branch (warning modal/prompt), not a generic failure toast.
  - Remove action supports loading/success/error states and prevents duplicate submissions.
  - Successful removal updates visible inventory context immediately for continued operations.

---

## Testing

### Happy Path

- [ ] Backend: Remove 3 qty from balance of 10 → success, balance_after = 7
- [ ] Backend: Remove from warehouse with bins → movement includes bin_id
- [ ] Frontend: Remove stock form validates, submits, toast shows success

### Error Paths (Insufficient Stock)

- [ ] Backend: Remove 15 qty from balance of 10, no override → 402 warning returned
- [ ] Backend: Remove 15 qty from balance of 10, owner_override=true → movement created with override flag, balance_after = -5
- [ ] Backend: Non-owner attempts override → 403 Forbidden
- [ ] Frontend: Insufficient stock warning modal shown, user can request approval

### Edge Cases

- [ ] Backend: Remove exactly the balance → balance_after = 0
- [ ] Backend: Remove to negative with override → recorded correctly
- [ ] Backend: Rapid removals (concurrent) → each aggregates correctly
- [ ] Frontend: Owner approves removal after delay → UI updates

---

## Implementation Notes

- Movement with negative balance only allowed with owner_override flag
- Insufficient stock warning is not a failure — it's a workflow decision point
- Owner approval can be synchronous (modal) or async (notification + dashboard)
- Must invalidate inventory balance cache after removal
- Integration test: remove without override (402) → owner approves → remove with override (success)

## Conversation

### user
