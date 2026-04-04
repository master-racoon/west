---
title: "[DEV] US-4.1 Transfer Stock Between Warehouses"
lane: backlog
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T00:00:00Z
description: "User transfers quantity of item between warehouses with optional bin selection"
labels:
  - flow-3-transfer-stock
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
