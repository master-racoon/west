---
title: "[DEV] US-6 Inventory Visibility (Search, History, Location)"
lane: done
created: 2026-04-04T00:00:00Z
updated: 2026-04-18T14:56:47.323Z
description: Users view inventory levels, movement history, and item locations
labels:
  - inventory-visibility
sortOrder: -2
slug: read_inventory_visibility
---

## DFD Reference

**Flows**: US-6.1, US-6.2, US-6.3 (read operations owned by devs, not part of mutation contract)

See [dfd_level0.md](../../docs/dfd_level0.md) for data model reference.

---

## Vertical Slice (DB → API → UI)

### 1. Database Schema

`warehouse-backend/src/db/schema.ts`

No new schema — uses existing tables (item, movement, inventory_balance view).

---

### 2. API Routes

`warehouse-backend/src/routes/inventory.ts` (update)

**GET /api/items/:id/balance**

- **Auth**: Any authenticated user
- **Response Schema**: `{ item_id, item_name, warehouses: [ { warehouse_id, warehouse_name, total_quantity, bins: [ { bin_id, bin_name, quantity } ] } ] }`
- **Handler**:
  - Query inventory_balance for item_id
  - Group by warehouse, then by bin (if warehouse.use_bins = true)
  - Return hierarchical structure:
    - Item name
    - For each warehouse: total quantity and per-bin breakdown (if applicable)

**GET /api/items/:id/movements**

- **Auth**: Any authenticated user
- **Query params**: `limit` (default 100), `offset` (default 0)
- **Response Schema**: Array of movements
  - `{ movement_id, type, timestamp, user_id, user_name, quantity, source_warehouse, dest_warehouse, source_bin?, dest_bin?, note }`
- **Handler**:
  - Query movements for item_id, sorted by timestamp DESC
  - Join with user table for user names
  - Paginate with limit/offset
  - Return latest movements first

**GET /api/items/search**

- **Auth**: Any authenticated user
- **Query params**: `q` (search string, required)
- **Response Schema**: Array of matching items
  - `{ item_id, item_name, description, barcodes: [array], total_quantity }`
- **Handler**:
  - Search by:
    - Item name (case-insensitive, substring match)
    - Barcode (exact or prefix match for scanning)
    - Item ID (if q is valid UUID)
  - Return top matches (limit 10)
  - Include total_quantity across all warehouses

---

### 3. Frontend

**Hooks**: `warehouse-frontend/src/hooks/queries/useInventory.ts` (update)

```typescript
export function useItemBalance(itemId: string) {
  return useQuery({
    queryKey: ["items", itemId, "balance"],
    queryFn: () => client.inventory.getItemBalance({ itemId }),
    enabled: !!itemId,
  });
}

export function useItemMovements(itemId: string, limit: number = 100) {
  return useQuery({
    queryKey: ["items", itemId, "movements"],
    queryFn: () => client.inventory.getItemMovements({ itemId, limit }),
    enabled: !!itemId,
  });
}

export function useSearchItems(query: string) {
  return useQuery({
    queryKey: ["items", "search", query],
    queryFn: () => client.inventory.searchItems({ q: query }),
    enabled: !!query && query.length > 0,
    staleTime: 5000, // Cache search for 5s
  });
}
```

**Components**:

**1. `warehouse-frontend/src/pages/InventorySearch.tsx` (new page)**

- **Layout**:
  - Search bar (text input, auto-focus)
  - Search results list (items, barcodes, total quantity)
  - Click item → navigate to ItemDetail
- **Behavior**:
  - Type triggers `useSearchItems` with debounce (300ms)
  - Show spinner while searching
  - Display up to 10 results
  - Show message if no results

**2. `warehouse-frontend/src/pages/ItemDetail.tsx` (new page)**

- **Layout**:
  - Item header: name, description, barcodes
  - Tabs:
    - **Availability Tab**:
      - Hierarchical display:
        - Warehouse A: 15 total
          - Bin 1: 10
          - Bin 2: 5
        - Warehouse B: 8 total
          - (or just "No bins" if warehouse.use_bins=false)
    - **Movement History Tab**:
      - Table of movements (timestamp, type, user, quantity, source→dest, note)
      - Pagination or load-more button
      - Filters: type filter (ADD/REMOVE/TRANSFER/COUNT_ADJUSTMENT)
- **Behavior**:
  - Fetch balance and movements on mount
  - Show spinner while loading
  - Display current inventory per warehouse/bin
  - List movements in reverse chronological order
  - Highlight recent movements (e.g., timestamp < 1 hour: bold)

---

## Acceptance Criteria (Frontend Functional)

- Feature is delivered through object-oriented read pages: `Inventory Explorer` and `Movements`.
- Search UX supports barcode/name/id lookup with debounce and clear no-results handling.
- Search results provide direct navigation to item-level detail context.
- Item detail presents both location availability and movement history without losing selected item context.
- Read views include loading, empty, and error states for search, balances, and movement datasets.
- Movement history supports practical filtering/pagination for real operational use.

---

## Testing

### Happy Path

- [ ] Backend: Search "item name" → returns exact matches
- [ ] Backend: Search barcode "12345" → returns item with that barcode
- [ ] Backend: Get balance for item → returns per-warehouse/per-bin breakdown
- [ ] Backend: Get movements for item → returns sorted list with user names
- [ ] Frontend: Search bar finds items, click navigates to detail
- [ ] Frontend: ItemDetail shows availability per warehouse and bins
- [ ] Frontend: ItemDetail shows movement history with types

### Error Paths

- [ ] Backend: Search with empty query → 400 Bad Request or empty results
- [ ] Backend: Get balance for non-existent item → 404
- [ ] Backend: Get movements for non-existent item → 404 or empty array
- [ ] Frontend: Search no results → "No items found" message
- [ ] Frontend: Movement history empty → "No movements recorded" message

### Edge Cases

- [ ] Backend: Item with multiple barcodes, search by each → all return same item
- [ ] Backend: Item with 0 balance across all locations
- [ ] Backend: Item with 100+ movements → pagination works correctly
- [ ] Frontend: Very long item names/descriptions → display truncation

---

## Implementation Notes

- Search is read-only, no authorization checks needed (all authenticated users)
- Barcode search supports prefix matching for fast scanning workflows
- Movement history shows all transaction types and details
- Hierarchical balance display depends on warehouse.use_bins flag
- Some endpoints (search, balance, movements) are high-frequency reads — validate query performance

## Conversation

### user

implement

### agent

Implemented US-6 Inventory Visibility end-to-end.

**Backend** (`warehouse-backend/src/routes/items.ts`):

- Enhanced `GET /search?q=` — now searches by name (substring), barcode (exact + prefix), and UUID; returns `barcodes[]` and `total_quantity`
- Added `GET /:id/balance` — hierarchical balance per warehouse/bin; 404 on missing item; only shows bins when `warehouse.use_bins=true`
- Added `GET /:id/movements?limit=&offset=` — paginated movement history with joins to users, warehouses, bins; returns `{ total, movements[] }`

**Frontend**:

- `src/generated-api/services/ItemsService.ts` — added `getItemBalance` and `getItemMovements` methods
- `src/lib/api.ts` — added `client.items.getItemBalance` and `client.items.getItemMovements`
- `src/hooks/queries/useItems.ts` — added `useItemBalance`, `useItemMovements` hooks + interfaces
- `src/pages/InventorySearch.tsx` — new page with debounced search, spinner, error/empty/results states, click-to-navigate
- `src/pages/ItemDetail.tsx` — new page with Availability tab (warehouse/bin hierarchy) and Movements tab (table + pagination); error states on all fetches
- `src/App.tsx` — replaced `ComingSoon` route with `InventorySearchPage` at `/dashboard/inventory-visibility` and `ItemDetailPage` at `/dashboard/inventory-visibility/:id`

SideMenu already had the "Inventory Visibility" nav link pointing to `/dashboard/inventory-visibility`. No schema migrations needed (uses existing tables).

### user
