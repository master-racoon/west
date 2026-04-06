---
title: "[DEV] US-2.2 Create Item On-the-Fly During Scan"
lane: todo
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T00:00:00Z
description: "User creates new item and assigns barcode when scanning unknown product"
labels:
  - flow-1-add-stock
---

## DFD Reference

**Flow**: [Flow-1: Add Stock (Receiving)](../../docs/dfd_level0.md#flow-1-add-stock) (sub-flow: create item on unknown barcode)

**Data Contract** (from dfd_level0.md):

- Request: `{ barcode: string, name: string (1-200), description?: string }`
- Response: `{ item_id: UUID, name: string, description?: string, barcode: string }`

---

## Vertical Slice (DB → API → UI)

### 1. Database Schema

`warehouse-backend/src/db/schema.ts`

No new schema required — uses existing `item` and `barcode` tables from task_20260404_02.

---

### 2. API Routes

`warehouse-backend/src/routes/items.ts` (update existing)

**POST /api/items/quick-create** (new endpoint)

- **Auth**: Any authenticated user
- **Request Schema**: `QuickCreateItemRequest`
  - `barcode`: string, 1-200 chars (unique)
  - `name`: string, 1-200 chars
  - `description`: string, optional, max 1000 chars
- **Response Schema**: `ItemResponse` (same as full item response)
  - `id`, `name`, `description`, `barcodes` (array with one entry), `created_at`
- **Handler**:
  1. Verify barcode is not already mapped to existing item (409 if duplicate)
  2. Create item with name/description
  3. Create barcode entry
  4. Return item + barcode(s)
- **Error Handling**:
  - 409 if barcode already exists → `ConflictError("Barcode already in use")`
  - 400 for validation errors

---

### 3. Frontend

**Hook**: `warehouse-frontend/src/hooks/queries/useItems.ts` (update)

```typescript
export function useQuickCreateItem() {
  return useMutation({
    mutationFn: (data: QuickCreateItemRequest) =>
      client.items.quickCreateItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });
}
```

**Component**: `warehouse-frontend/src/components/ItemCreationModal.tsx` (new modal)

- **Trigger**: When barcode lookup returns 404, show modal
- **Fields**:
  - `barcode`: readonly (pre-filled from scan)
  - `name`: text input, required, 1-200 chars
  - `description`: textarea, optional
- **Actions**:
  - Cancel (close modal, user can re-enter different barcode)
  - Create (submit mutation)
- **Behavior**:
  - On success: return created item to parent, continue ADD stock flow
  - On error (409 duplicate barcode): show toast "Barcode already exists", allow editing
  - On validation error: show inline errors

**Update**: `warehouse-frontend/src/pages/AddStock.tsx`

- When barcode lookup returns 404:
  - Show ItemCreationModal with barcode pre-filled
  - Wait for item creation
  - On success, re-trigger barcode lookup (now succeeds)
  - Continue ADD stock workflow (user enters quantity, etc.)

---

## Acceptance Criteria (Frontend Functional)

- Unknown barcode path from `Inventory` → `Add` tab opens inline quick-create UI without leaving the workflow.
- Quick-create form pre-fills barcode as read-only and enforces required `name` with inline validation.
- Create action shows pending state and prevents duplicate submissions while request is in flight.
- On success, modal closes and parent add-stock flow continues with created item selected/resolved.
- Cancel action returns user to add-stock form with no side effects on current form context.
- Conflict/error responses are shown clearly with recovery guidance (retry or use existing item).

---

## Testing

### Happy Path

- [ ] Backend: `POST /api/items/quick-create` with barcode + name → 201, item created with barcode
- [ ] Backend: Barcode immediately available for lookup
- [ ] Frontend: Scan unknown barcode → modal appears with barcode pre-filled
- [ ] Frontend: Enter name, submit → item created, modal closes, barcode lookup succeeds

### Error Paths

- [ ] Backend: Duplicate barcode → 409 Conflict
- [ ] Backend: Missing name → 400 Bad Request
- [ ] Frontend: Barcode already exists → toast, allow user to edit
- [ ] Frontend: Cancel modal → closes, user can re-enter barcode

### Edge Cases

- [ ] Backend: Item name at boundary (1 char, 200 chars)
- [ ] Backend: Very long description (max 1000 chars)
- [ ] Frontend: Rapid creation attempts (debounce, disable button)
- [ ] Frontend: Modal dismissal (ESC key, click outside)

---

## Implementation Notes

- Quick-create is a convenience endpoint for scanning workflows
- Does not replace full item configuration (owner can still add more barcodes later)
- After quick creation, user continues ADD stock flow with new item
- Integration test: scan → 404 → create item → scan again → success

## Conversation

### user
