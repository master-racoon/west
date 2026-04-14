---
title: "[DEV] US-1.2 Create and Manage Items with Barcodes"
lane: doing
created: 2026-04-04T00:00:00Z
updated: 2026-04-13T14:41:39.700Z
description: Owner creates items and assigns multiple barcodes to track SKUs
labels:
  - flow-5-configuration
sortOrder: 1
slug: flow5_items_barcodes
---

## DFD Reference

**Flow**: [Flow-5: Configuration Management](../../docs/dfd_level0.md#flow-5-configuration)

**Data Contract**:

- Request (Create Item): `{ name: string (1-200), description?: string, barcodes?: string[] }`
- Response: `{ id: UUID, name: string, description?: string, barcodes: string[], created_at: ISO8601 }`

---

## Vertical Slice (DB → API → UI)

### 1. Database Schema

`warehouse-backend/src/db/schema.ts`

Create two tables:

**`item` table**:

- `id` (UUID, PK)
- `name` (VARCHAR(200), NOT NULL)
- `description` (TEXT, nullable)
- `created_at` (TIMESTAMP, DEFAULT now())
- `updated_at` (TIMESTAMP)

**`barcode` table** (junction):

- `id` (UUID, PK)
- `item_id` (UUID, FK → item.id, ON DELETE CASCADE)
- `barcode` (VARCHAR(200), UNIQUE, NOT NULL)
- `created_at` (TIMESTAMP, DEFAULT now())

**Index**: `idx_barcode_item_id` on `(item_id)` for fast lookups

---

### 2. API Routes

`warehouse-backend/src/routes/items.ts` (new file)

**POST /api/items**

- **Auth**: Owner role required
- **Request Schema**: `CreateItemRequest`
  - `name`: string, 1-200 chars
  - `description`: string, optional, max 1000 chars
  - `barcodes`: string[], optional, min 1 if provided, each 1-200 chars
- **Response Schema**: `ItemResponse`
  - `id`, `name`, `description`, `barcodes` (array), `created_at`
- **Handler**:
  - Insert item into `item` table
  - If barcodes provided, insert into `barcode` table
  - Validate barcode uniqueness before insert (409 if duplicate)
  - Return 201 with full item + barcodes

**GET /api/items**

- **Auth**: Any authenticated user
- **Response**: Array of items with barcode counts
- **Handler**: Query all items with barcode arrays

**GET /api/items/:id**

- **Auth**: Any authenticated user
- **Response**: Single item with full barcode array
- **Handler**: Query item + barcodes by ID

**POST /api/items/:id/barcodes**

- **Auth**: Owner role required
- **Request Schema**: `AddBarcodeRequest`
  - `barcode`: string, 1-200 chars
- **Response**: Updated item with new barcode
- **Handler**:
  - Verify item exists
  - Check barcode uniqueness
  - Insert barcode into `barcode` table
  - Return updated item

**GET /api/barcodes/lookup/:barcode**

- **Auth**: Any authenticated user
- **Response**: `{ item_id: UUID, item_name: string }` or 404
- **Handler**: Fast lookup for scanning UIs (used during stock operations)

---

### 3. Frontend

**Hook**: `warehouse-frontend/src/hooks/queries/useItems.ts`

```typescript
export function useCreateItem() {
  return useMutation({
    mutationFn: (data: CreateItemRequest) => client.items.createItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });
}

export function useItems() {
  return useQuery({
    queryKey: ["items"],
    queryFn: () => client.items.getItems(),
  });
}

export function useItemById(itemId: string) {
  return useQuery({
    queryKey: ["items", itemId],
    queryFn: () => client.items.getItem({ itemId }),
    enabled: !!itemId,
  });
}

export function useAddBarcode() {
  return useMutation({
    mutationFn: ({ itemId, barcode }: { itemId: string; barcode: string }) =>
      client.items.addBarcode({ itemId, body: { barcode } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["items", variables.itemId] });
    },
  });
}
```

**Components**:

1. `warehouse-frontend/src/pages/ItemCreate.tsx`
   - Form: `name` (required), `description` (optional), `barcodes` (dynamic multi-field)
   - Add/remove barcode fields
   - Submit creates item
   - Toast on success: "Item created"

2. `warehouse-frontend/src/pages/ItemDetail.tsx`
   - Display item name, description, barcode list
   - Button to add new barcode
   - Modal/form for entering new barcode
   - List of barcodes with option to view (future: delete if needed)

---

## Acceptance Criteria (Frontend Functional)

- Feature is available from the object-oriented `Items` page for `Owner` users.
- Items page supports list/search, create form, and barcode management in one coherent workflow.
- Item creation form enforces required `name` and barcode field validation with inline feedback.
- Barcode add action updates visible barcode list immediately and surfaces uniqueness conflicts clearly.
- Items list and item detail views include loading, empty, and error states.
- Newly created item is discoverable from Inventory operational flows (lookup/select) without manual reload.

---

## Testing

### Happy Path

- [ ] Backend: `POST /api/items` with name + barcodes → 201, item + barcodes returned
- [ ] Backend: `GET /api/items/:id` returns item with all barcodes
- [ ] Backend: `POST /api/items/:id/barcodes` adds new barcode to item
- [ ] Backend: `GET /api/barcodes/lookup/:barcode` returns correct item ID
- [ ] Frontend: Item creation form validates and submits
- [ ] Frontend: ItemDetail displays all barcodes

### Error Paths

- [ ] Backend: Duplicate barcode → 409 Conflict on create or add
- [ ] Backend: Non-owner → 403 Forbidden
- [ ] Backend: Invalid item ID → 404 Not Found
- [ ] Backend: Missing item name → 400 Bad Request
- [ ] Frontend: Form validation prevents empty name
- [ ] Frontend: Error toast on barcode conflict

### Edge Cases

- [ ] Backend: Item with 0 barcodes (valid until first ADD stock)
- [ ] Backend: Item name at boundary (1 char, 200 chars)
- [ ] Backend: Barcode lookup with non-existent barcode → 404
- [ ] Frontend: Rapid barcode additions → debounce/disable

---

## Implementation Notes

- Barcode lookup endpoint is critical for fast scanning UX — ensure indexed
- Barcodes are globally unique (not per warehouse)
- Item can be created without barcodes, then barcodes added later
- After schema changes: `npm run db:generate` → `db:migrate` → `generate-api`

## Conversation

### user
