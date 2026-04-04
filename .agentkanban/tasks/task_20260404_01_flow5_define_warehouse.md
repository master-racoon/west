---
title: "[DEV] US-1.1 Define Warehouse with Bin Mode"
lane: backlog
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T00:00:00Z
description: "Owner creates warehouse with use_bins configuration flag"
labels:
  - flow-5-configuration
---

## DFD Reference

**Flow**: [Flow-5: Configuration Management](../../docs/dfd_level0.md#flow-5-configuration)

**Data Contract**:

- Request: `{ name: string (1-100 chars), use_bins: boolean }`
- Response: `{ id: UUID, name: string, use_bins: boolean, created_at: ISO8601 }`

---

## Vertical Slice (DB → API → UI)

### 1. Database Schema

`warehouse-backend/src/db/schema.ts`

- Create `warehouse` table:
  - `id` (UUID, PK)
  - `name` (VARCHAR(100), NOT NULL, UNIQUE)
  - `use_bins` (BOOLEAN, DEFAULT false)
  - `created_at` (TIMESTAMP, DEFAULT now())
  - `updated_at` (TIMESTAMP)

---

### 2. API Route

`warehouse-backend/src/routes/warehouses.ts` (new file)

**POST /api/warehouses**

- **Auth**: Owner role required (`requireRole(c, "owner")`)
- **Request Schema**: Zod schema `CreateWarehouseRequest`
  - `name`: string, min 1, max 100
  - `use_bins`: boolean (default: false)
- **Response Schema**: `WarehouseResponse`
  - `id`, `name`, `use_bins`, `created_at`
- **Handler**:
  - Validate input via Zod
  - Check warehouse name uniqueness
  - Insert into DB
  - Return 201 with warehouse data
- **Error Handling**:
  - 409 Conflict if warehouse name already exists → `ConflictError("Warehouse already exists")`
  - 403 if not owner → handled by `requireRole` middleware
  - 400 for validation errors

**GET /api/warehouses**

- **Auth**: Any authenticated user
- **Response**: Array of warehouses (name, use_bins status)
- **Handler**: Query all warehouses, return list

---

### 3. Frontend

**Hook**: `warehouse-frontend/src/hooks/queries/useWarehouses.ts`

```typescript
export function useCreateWarehouse() {
  return useMutation({
    mutationFn: (data: CreateWarehouseRequest) =>
      client.warehouses.createWarehouse(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    },
  });
}

export function useWarehouses() {
  return useQuery({
    queryKey: ["warehouses"],
    queryFn: () => client.warehouses.getWarehouses(),
  });
}
```

**Component**: `warehouse-frontend/src/pages/WarehouseCreate.tsx`

- Form with fields: `name` (text input), `use_bins` (toggle/checkbox)
- Form validation (name required, 1-100 chars)
- Mutation on submit
- Toast on success: "Warehouse created"
- Error toast on failure
- Redirect to warehouse list on success

---

## Testing

### Happy Path (Unit + Integration)

- [ ] Backend: `POST /api/warehouses` with valid data → 201, warehouse ID returned
- [ ] Backend: Warehouse is queryable via `GET /api/warehouses`
- [ ] Backend: `use_bins = true` persists correctly

### Error Paths

- [ ] Backend: Duplicate warehouse name → 409 Conflict
- [ ] Backend: Non-owner role → 403 Forbidden
- [ ] Backend: Missing/invalid `name` → 400 Bad Request
- [ ] Frontend: Form validation prevents submission with empty name
- [ ] Frontend: Error toast on 409 conflict, user can retry

### Edge Cases

- [ ] Backend: Warehouse name at boundary (1 char, 100 chars)
- [ ] Backend: Special characters in name (allowed)
- [ ] Frontend: Rapid clicks on submit → debounce/disable button

---

## Implementation Notes

- After schema change: `npm run db:generate` → `npm run db:migrate` → `npm run generate-api`
- Use existing `AppError` classes from `warehouse-backend/src/utils/errors.ts`
- Tests use `clearDatabase()` and `signupUser("owner")` from test helpers
- Component exports from `pages/` for route-level handling

## Conversation

### user

Ready to implement this task. Clarify: should warehouse names be case-sensitive or case-insensitive for uniqueness?

### agent

Warehouse names should be **case-insensitive for uniqueness** (common UX pattern — prevents "Warehouse A" and "warehouse a" conflicts). Use a UNIQUE constraint with LOWER() in DB or enforce at application level before insert:

```sql
CREATE UNIQUE INDEX idx_warehouse_name_lower ON warehouse(LOWER(name))
```

Or in handler before insert:

```typescript
const normalizedName = data.name.toLowerCase();
// Check if exists, then insert
```

Recommend the DB-level constraint. Update schema and handler accordingly.

### user
