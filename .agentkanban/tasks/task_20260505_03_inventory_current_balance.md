---
title: "[DEV] US-6.4 View Current Inventory Balance"
lane: todo
created: 2026-05-05T00:00:00Z
updated: 2026-05-05T00:00:00Z
description: Users can see the current stock balance per item across all warehouses and bins
labels:
  - inventory-visibility
sortOrder: 12
slug: inventory_current_balance
---

## DFD Reference

**Flow**: Inventory Visibility — read operations ([dfd_level0.md](../../docs/dfd_level0.md#inventory-visibility))

**Data Contract**:

- Request: `GET /api/inventory/balance`
  - Query params: `warehouse_id?`, `item_id?`, `sku?`
- Response: `{ items: [ { item_id, item_name, skus: string[], total_quantity, warehouses: [ { warehouse_id, warehouse_name, quantity, bins?: [ { bin_id, bin_name, quantity } ] } ] } ] }`

---

## Vertical Slice (DB → API → UI)

### 1. Database Schema

`warehouse-backend/src/db/schema.ts`

No new schema. `inventory_balance` view already aggregates movement data. Verify `inventory_balance` includes SKU data via join to `item_sku`.

---

### 2. API Routes

`warehouse-backend/src/routes/inventory.ts`

**GET /api/inventory/balance**

- **Auth**: Any authenticated user
- **Query params**: `warehouse_id` (optional filter), `item_id` (optional), `sku` (optional — resolves item from SKU)
- **Response**: Hierarchical balance grouped by item → warehouse → bin
- **Handler**: Join `inventory_balance` with `item`, `item_sku`, `warehouse`, `bin`

---

### 3. Frontend

New page or section in `warehouse-frontend/src/pages/InventorySearch.tsx` or dedicated `CurrentBalance.tsx`

- Table/list showing item name, SKU(s), and total quantity
- Per-row expandable row for warehouse breakdown
- Filter by warehouse dropdown
- Filter/search by item name or SKU
- Empty state: "No inventory found"
- Loading state while fetching

---

## Acceptance Criteria

- [ ] All authenticated users can view current balance
- [ ] Balance is grouped by item with warehouse/bin breakdown
- [ ] Filtering by warehouse narrows the list
- [ ] Searching by SKU filters correctly
- [ ] Zero-balance items are visible (to identify stockouts)
- [ ] Page shows loading and empty states correctly

## Conversation

### user

Create task for viewing current balance (se nuvarande saldo).

### agent

Task created. Builds on the existing `inventory_balance` DB view. Key addition is filtering by SKU query param and a dedicated frontend view showing the full item → warehouse → bin hierarchy. Zero-balance items should be included so users can spot stockouts.

### user
