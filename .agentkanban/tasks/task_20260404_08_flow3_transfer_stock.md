---
title: "[DEV] US-4.1 Transfer Stock Between Warehouses"
lane: done
created: 2026-04-04T00:00:00Z
updated: 2026-04-18T10:53:35.861Z
description: User transfers quantity of item between warehouses with optional bin selection
labels:
  - flow-3-transfer-stock
sortOrder: 10
slug: flow3_transfer_stock
---

## DFD Reference

**Flow**: [Flow-3: Transfer Stock (Between Warehouses/Bins)](../../docs/dfd_level0.md#flow-3-transfer-stock)

**Data Contract** (from dfd_level0.md):

- Request: `{ item_id: UUID, quantity: int (>0), source_warehouse_id: UUID, dest_warehouse_id: UUID, source_bin_id?: UUID, dest_bin_id?: UUID }`
- Response: `{ movement_id: UUID, item_id: UUID, quantity: int, source_warehouse_id: UUID, dest_warehouse_id: UUID, source_balance_after: int, dest_balance_after: int }`

---

## Vertical Slice (DB → API → UI)

### 1. Database Schema

`warehouse-backend/src/db/schema.ts`

No new schema — uses existing `movement` table. Transfer is recorded as single movement with source and dest fields.

---

### 2. API Routes

`warehouse-backend/src/routes/inventory.ts` (update)

**POST /api/inventory/transfer**

- **Auth**: Any authenticated user
- **Request Schema**: `TransferStockRequest`
  - `item_id`: UUID
  - `quantity`: int, min 1
  - `source_warehouse_id`: UUID
  - `dest_warehouse_id`: UUID
  - `source_bin_id`: UUID, optional (required if source warehouse.use_bins = true)
  - `dest_bin_id`: UUID, optional (required if dest warehouse.use_bins = true)
- **Response Schema**: `TransferStockResponse`
  - `movement_id`, `item_id`, `quantity`, `source_warehouse_id`, `dest_warehouse_id`, `source_balance_after` (int), `dest_balance_after` (int)
- **Handler**:
  1. Verify both warehouses exist
  2. Verify item exists
  3. If source warehouse.use_bins = true, verify source_bin_id provided and exists
  4. If dest warehouse.use_bins = true, verify dest_bin_id provided and exists
  5. Compute source balance (warehouse, bin?, item)
  6. Verify quantity ≤ source balance (no negative transfers)
  7. Create movement (type='TRANSFER') with source/dest warehouse/bin
  8. Return with computed balances (source decreases, dest increases)
- **Error Handling**:
  - 404 if item, source warehouse, or dest warehouse not found
  - 404 if source_bin_id or dest_bin_id invalid
  - 400 if source warehouse.use_bins=true but no source_bin_id
  - 400 if dest warehouse.use_bins=true but no dest_bin_id
  - 422 "Insufficient Stock" if quantity > source balance

---

### 3. Frontend

**Hook**: `warehouse-frontend/src/hooks/queries/useInventory.ts` (update)

```typescript
export function useTransferStock() {
  return useMutation({
    mutationFn: (data: TransferStockRequest) =>
      client.inventory.transferStock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "balance"] });
    },
  });
}
```

**Component**: `warehouse-frontend/src/pages/TransferStock.tsx` (new page)

- **Layout**:
  1. Item selector or barcode scanner
  2. Quantity input
  3. Source warehouse selector
  4. Source bin selector (conditional: if source warehouse.use_bins = true)
  5. Separator / "→" arrow
  6. Destination warehouse selector (must be different from source)
  7. Destination bin selector (conditional: if dest warehouse.use_bins = true)
  8. Submit button
- **Flow**:
  - User scans item or selects from list
  - User enters quantity to transfer
  - User selects source warehouse
  - If source warehouse uses bins, user selects source bin (fetch bins for source warehouse)
  - User selects destination warehouse (dropdown excludes source warehouse)
  - If dest warehouse uses bins, user selects dest bin (fetch bins for dest warehouse)
  - Submit: call `transferStock()`
  - On success: toast "Transferred X from [Source] to [Dest]", clear form
  - On error: show error toast
- **Validation**:
  - Quantity > 0
  - Source and destination must be different
  - If source uses bins, source_bin required
  - If dest uses bins, dest_bin required
  - Source balance must be ≥ quantity (checked on submit)

  ***

  ## Acceptance Criteria (Frontend Functional)
  - Feature is implemented in the object-oriented `Inventory` page under the `Transfer` tab.
  - Source and destination selectors enforce distinct warehouses in UI before submit.
  - Bin selectors are shown independently based on each selected warehouse `use_bins` setting.
  - Transfer form surfaces source availability context before mutation to reduce failed submits.
  - Submit action provides loading/success/error states and prevents duplicate transfer submissions.
  - Successful transfer updates current inventory context and clears actionable fields for next transfer.

---

## Testing

### Happy Path

- [ ] Backend: Transfer 5 qty between warehouses (no bins) → movement created, source -5, dest +5
- [ ] Backend: Transfer 3 qty between bins in different warehouses → movement includes source/dest bin_ids
- [ ] Backend: Balance aggregation correct (source_balance_after, dest_balance_after)
- [ ] Frontend: Form validates, bin selectors appear/disappear based on warehouse config

### Error Paths

- [ ] Backend: Source and dest warehouses same → 400 Bad Request
- [ ] Backend: Quantity > source balance → 422 Insufficient Stock
- [ ] Backend: Source warehouse.use_bins=true but no source_bin_id → 400
- [ ] Backend: Invalid bin_id → 404 Not Found
- [ ] Frontend: Quantity ≤ 0 → validation error
- [ ] Frontend: Source = dest → validation error (disable in UI)

### Edge Cases

- [ ] Backend: Transfer exactly the source balance → source_balance_after = 0, dest += full amount
- [ ] Backend: Transfer from bin A to bin B in different warehouses
- [ ] Backend: Transfer from non-binned warehouse to binned warehouse (dest_bin_id required)
- [ ] Frontend: Rapid warehouse selection changes → bin selectors update correctly

---

## Implementation Notes

- Transfer is a single TRANSFER movement (not ADD + REMOVE)
- Source and dest must be different warehouses
- Bin selection logic depends on each warehouse's use_bins flag (not paired)
- Transfer never allows negative source balance (unlike REMOVE with override)
- After schema: `npm run db:generate` → `db:migrate` → `generate-api`

## Conversation

### user

Repair the Flow 3 transfer-stock implementation in the west workspace based on these QA findings:

1. The Transfer tab can reject a valid transfer before the source-balance query finishes loading because availability defaults to 0. Fix this functional bug narrowly.
2. The checked-in contract artifacts are stale for the transfer endpoint: backend route/frontend client exist but `warehouse-backend/openapi.json` does not include `/api/inventory/transfer`. Bring the checked-in contract artifacts back into sync as narrowly as possible for this slice.

Do not broaden scope into test harness or unrelated coverage work. Update the task history if your workflow expects it. Return a concise summary of changes, validation, and remaining risks.

### agent

Applied a narrow Flow 3 repair.

- Frontend: guarded transfer submission while the source-balance query is still settling so the form no longer compares a valid quantity against the pre-load `0` fallback. The availability copy and submit disabled state now reflect that in-flight check.
- Contract artifact: added the missing `/api/inventory/transfer` entry to `warehouse-backend/openapi.json` with the checked-in request/response schema shape already implemented by the backend route.

Validation in this pass: editor diagnostics on the touched frontend file and the task/openapi file set after the patch. Not run here: backend tests, frontend tests, or OpenAPI export/codegen commands.

Remaining risk: `openapi.json` is now back in sync for this transfer slice, but it was updated manually here rather than regenerated from the export script.

### user

Implement this dependency slice after remove stock: add backend transfer movement support plus the frontend transfer workflow under the Inventory page Transfer tab. Keep it minimal but complete, follow repo conventions, and report validation and any blockers.

### agent

Implemented the transfer slice end-to-end.

- Backend: added `POST /api/inventory/transfer` in `warehouse-backend/src/routes/inventory.ts` with DFD-aligned request/response schemas, warehouse/item/bin validation, same-warehouse rejection, insufficient-stock rejection at `422`, and a single `TRANSFER` movement written inside a transaction with advisory locks around the source and destination inventory scopes.
- Frontend: added `useTransferStock()` in `warehouse-frontend/src/hooks/queries/useInventory.ts`, wired `client.inventory.transferStock()` in `warehouse-frontend/src/lib/api.ts`, extended the generated inventory service with the transfer call, and replaced the Transfer placeholder in `warehouse-frontend/src/App.tsx` with a real `TransferStockPage`.
- UI: the new transfer page resolves items by barcode or item id, enforces distinct source/destination warehouses, conditionally shows source and destination bin selectors based on each warehouse's `use_bins` flag, shows source availability context before submit, blocks duplicate submits while pending, and clears the actionable fields after a successful transfer.

Validation performed in this implementation pass:

- `get_errors` on `warehouse-backend/src/routes/inventory.ts` after the backend edit, including one follow-up fix for the `422` error path.
- `get_errors` on the touched frontend files: `warehouse-frontend/src/hooks/queries/useInventory.ts`, `warehouse-frontend/src/lib/api.ts`, `warehouse-frontend/src/generated-api/services/InventoryService.ts`, `warehouse-frontend/src/App.tsx`, and `warehouse-frontend/src/pages/TransferStock.tsx`.

Not run here: backend tests, frontend tests, API codegen command, or OpenAPI export command.

### user
