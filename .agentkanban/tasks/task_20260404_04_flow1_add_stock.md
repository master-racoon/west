---
title: "[DEV] US-2.1 Scan and Add Stock to Warehouse"
lane: todo
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T00:00:00Z
description: "User scans barcode, enters quantity, and adds stock to warehouse"
labels:
  - flow-1-add-stock
---

## DFD Reference

**Flow**: [Flow-1: Add Stock (Receiving)](../../docs/dfd_level0.md#flow-1-add-stock)

**Data Contract** (from dfd_level0.md):

- Request: `{ warehouse_id: UUID, barcode_or_item_id: string, quantity: int (>0), bin_id?: UUID }`
- Response: `{ movement_id: UUID, item_id: UUID, warehouse_id: UUID, bin_id?: UUID, quantity: int, balance_after: int }`

---

## Vertical Slice (DB → API → UI)

### 1. Database Schema

`warehouse-backend/src/db/schema.ts`

**`movement` table** (immutable log):

- `id` (UUID, PK)
- `type` (ENUM: 'ADD', 'REMOVE', 'TRANSFER', 'COUNT_ADJUSTMENT', 'MANUAL_ADJUSTMENT')
- `user_id` (UUID, FK → user.id)
- `item_id` (UUID, FK → item.id)
- `source_warehouse_id` (UUID, FK → warehouse.id, nullable)
- `source_bin_id` (UUID, FK → bin.id, nullable)
- `dest_warehouse_id` (UUID, FK → warehouse.id, nullable)
- `dest_bin_id` (UUID, FK → bin.id, nullable)
- `quantity` (INT, NOT NULL)
- `note` (TEXT, nullable)
- `created_at` (TIMESTAMP, DEFAULT now())

**Indexes**:

- `idx_movement_item_id` on `(item_id)`
- `idx_movement_warehouse_id` on `(source_warehouse_id)` and `(dest_warehouse_id)`
- `idx_movement_user_id` on `(user_id)`

**`inventory_balance` view (computed)**:

- Aggregates movements by (warehouse, bin?, item)
- Query: SUM(quantity) grouped by warehouse/bin/item

---

### 2. API Routes

`warehouse-backend/src/routes/inventory.ts` (new file)

**POST /api/inventory/add**

- **Auth**: Any authenticated user
- **Request Schema**: `AddStockRequest`
  - `warehouse_id`: UUID
  - `barcode_or_item_id`: string (lookup by barcode first, then item_id)
  - `quantity`: int, min 1
  - `bin_id`: UUID, optional (required if warehouse.use_bins = true)
- **Response Schema**: `AddStockResponse`
  - `movement_id`, `item_id`, `warehouse_id`, `bin_id` (if applicable), `quantity`, `balance_after` (int)
- **Handler**:
  1. Fetch warehouse — verify it exists
  2. Lookup item by barcode_or_item_id (try barcode first via join, fallback to item.id)
  3. If warehouse.use_bins = true, verify bin_id provided and exists
  4. Create movement record (type='ADD')
  5. Return movement + computed balance after
- **Error Handling**:
  - 404 if item not found → `NotFoundError("Item not found")`
  - 400 if warehouse.use_bins=true but no bin_id → `BadRequestError("Bin required for this warehouse")`
  - 404 if bin_id invalid → `NotFoundError("Bin not found")`

**GET /api/inventory/balance**

- **Auth**: Any authenticated user
- **Query filters**: `warehouse_id` (optional), `bin_id` (optional), `item_id` (optional)
- **Response**: Array of `{ warehouse_id, bin_id?, item_id, quantity }`
- **Handler**: Query inventory_balance view with filters

---

### 3. Frontend

**Hook**: `warehouse-frontend/src/hooks/queries/useInventory.ts`

```typescript
export function useAddStock() {
  return useMutation({
    mutationFn: (data: AddStockRequest) => client.inventory.addStock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", "balance"] });
    },
  });
}

export function useInventoryBalance(filters?: InventoryFilter) {
  return useQuery({
    queryKey: ["inventory", "balance", filters],
    queryFn: () => client.inventory.getBalance(filters),
  });
}
```

**Component**: `warehouse-frontend/src/pages/AddStock.tsx`

- **Layout**:
  1. Warehouse selector (dropdown or list)
  2. Barcode/Item input field (with scanner integration)
  3. Quantity input (number, min=1)
  4. Bin selector (conditional: only if warehouse.use_bins = true, fetch bins for selected warehouse)
  5. Submit button
- **Flow**:
  - User selects warehouse
  - User scans/enters barcode (triggers lookup on blur/enter)
  - If item found, show item name
  - User enters quantity
  - If warehouse uses bins, show bin dropdown (fetch bins for warehouse)
  - Submit creates movement
  - Toast: "Added X qty of [Item] to [Warehouse] [Bin]"
  - Clear form for next scan
- **Error Handling**:
  - Show toast on barcode not found
  - Show validation error if quantity ≤ 0
  - Show error if bin required but not selected

---

## Acceptance Criteria (Frontend Functional)

- Feature is implemented in the object-oriented `Inventory` page under the `Add` tab.
- Barcode input supports scan-first workflow (auto-focus/enter handling) and resolves item identity before submit.
- Warehouse selection controls conditional bin behavior; bin selector only appears when `use_bins = true`.
- Submit button is disabled during mutation to prevent duplicate submissions from rapid scan workflows.
- Success state confirms movement and resets actionable fields for next scan cycle.
- Error states provide clear recovery for unknown barcode, invalid quantity, and missing required bin.

---

## Testing

### Happy Path

- [ ] Backend: Add 10 qty to warehouse (no bins) → movement created, balance_after = 10
- [ ] Backend: Add 5 qty to warehouse with bin → movement created with bin_id, balance_after = 5
- [ ] Backend: Lookup item by barcode → correct item returned
- [ ] Frontend: Scan barcode → item name displays, quantity input enabled

### Error Paths

- [ ] Backend: Unknown barcode → 404 Not Found
- [ ] Backend: Warehouse.use_bins=true but no bin_id → 400 BadRequest
- [ ] Backend: Non-existent bin_id → 404 Not Found
- [ ] Backend: Invalid quantity (0, negative) → 400 Bad Request
- [ ] Frontend: Barcode not found toast
- [ ] Frontend: Bin selector required for bins-enabled warehouse

### Edge Cases

- [ ] Backend: First ADD movement initializes balance to quantity
- [ ] Backend: Multiple movements aggregate correctly in balance view
- [ ] Frontend: Rapid scans (debounce barcode lookup)
- [ ] Frontend: Switch warehouse, bin selector updates

---

## Implementation Notes

- Movement is immutable — update/delete not supported
- Inventory balance computed from log (no separate table to update)
- Barcode lookup must be fast (critical for scanning UX)
- After schema: `npm run db:generate` → `db:migrate` → `generate-api`
- Integration tests must verify balance aggregation

## Conversation

### user
