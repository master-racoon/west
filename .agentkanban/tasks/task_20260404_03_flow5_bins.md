---
title: "[DEV] US-1.3 Create and Manage Bins (Conditional)"
lane: backlog
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T00:00:00Z
description: "Owner creates bins/shelves in warehouses when use_bins=true"
labels:
  - flow-5-configuration
---

## DFD Reference

**Flow**: [Flow-5: Configuration Management](../../docs/dfd_level0.md#flow-5-configuration)

**Data Contract**:

- Request (Create Bin): `{ warehouse_id: UUID, name: string (1-100) }`
- Response: `{ id: UUID, warehouse_id: UUID, name: string, created_at: ISO8601 }`

---

## Vertical Slice (DB → API → UI)

### 1. Database Schema

`warehouse-backend/src/db/schema.ts`

**`bin` table**:

- `id` (UUID, PK)
- `warehouse_id` (UUID, FK → warehouse.id, ON DELETE CASCADE)
- `name` (VARCHAR(100), NOT NULL)
- `created_at` (TIMESTAMP, DEFAULT now())
- `updated_at` (TIMESTAMP)

**Index**: `idx_bin_warehouse_id` on `(warehouse_id)`

**Constraint**: UNIQUE on `(warehouse_id, LOWER(name))` — bin names unique per warehouse (case-insensitive)

---

### 2. API Routes

`warehouse-backend/src/routes/bins.ts` (new file)

**POST /api/bins**

- **Auth**: Owner role required
- **Request Schema**: `CreateBinRequest`
  - `warehouse_id`: UUID (must exist and have `use_bins = true`)
  - `name`: string, 1-100 chars
- **Response Schema**: `BinResponse`
  - `id`, `warehouse_id`, `name`, `created_at`
- **Handler**:
  - Verify warehouse exists
  - Verify warehouse.use_bins = true (400 BadRequest if false)
  - Check bin name uniqueness in warehouse
  - Insert bin
  - Return 201

**GET /api/warehouses/:warehouse_id/bins**

- **Auth**: Any authenticated user
- **Response**: Array of bins for warehouse
- **Handler**: Query bins where warehouse_id = :warehouse_id

**GET /api/bins/:id**

- **Auth**: Any authenticated user
- **Response**: Single bin (id, name, warehouse_id)
- **Handler**: Query by ID, 404 if not found

---

### 3. Frontend

**Hook**: `warehouse-frontend/src/hooks/queries/useBins.ts`

```typescript
export function useCreateBin() {
  return useMutation({
    mutationFn: (data: CreateBinRequest) => client.bins.createBin(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["bins", "warehouse", data.warehouse_id],
      });
    },
  });
}

export function useBinsByWarehouse(warehouseId: string) {
  return useQuery({
    queryKey: ["bins", "warehouse", warehouseId],
    queryFn: () => client.bins.getBins({ warehouseId }),
    enabled: !!warehouseId,
  });
}
```

**Components**:

1. `warehouse-frontend/src/pages/BinCreate.tsx`
   - Select warehouse (only those with `use_bins = true`)
   - Input bin name
   - Create bin on submit
   - Toast: "Bin created in [Warehouse Name]"

2. `warehouse-frontend/src/pages/BinList.tsx`
   - Filter by warehouse (via URL param or select)
   - Display bins as list/cards
   - Option to delete bin (if 0 inventory) — future task

---

## Testing

### Happy Path

- [ ] Backend: `POST /api/bins` with valid warehouse_id + name → 201, bin created
- [ ] Backend: `GET /api/warehouses/:id/bins` returns bins for warehouse
- [ ] Backend: Bin name case-insensitive unique per warehouse

### Error Paths

- [ ] Backend: Warehouse with `use_bins = false` → 400 BadRequest
- [ ] Backend: Duplicate bin name in same warehouse → 409 Conflict
- [ ] Backend: Non-existent warehouse_id → 404 or 400
- [ ] Backend: Non-owner → 403 Forbidden
- [ ] Frontend: Warehouse selector only shows bins-enabled warehouses

### Edge Cases

- [ ] Backend: Bin name at boundary (1 char, 100 chars)
- [ ] Backend: Delete warehouse cascades to bins
- [ ] Frontend: Create bin modal, then refresh list

---

## Implementation Notes

- Bins only exist if `warehouse.use_bins = true`
- Bin names are unique per warehouse but not globally
- During inventory operations (Flow 1-4), bin selector only shows bins for selected warehouse
- After schema changes: `npm run db:generate` → `db:migrate` → `generate-api`

## Conversation

### user
