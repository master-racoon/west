---
title: "[DEV] US-5.4 Delete Products"
lane: todo
created: 2026-05-05T00:00:00Z
updated: 2026-05-05T00:00:00Z
description: Owner can soft-delete or hard-delete items (products) that are no longer in use
labels:
  - flow-5-configuration
sortOrder: 10
slug: flow5_delete_items
---

## DFD Reference

**Flow**: [Flow-5: Configuration Management](../../docs/dfd_level0.md#flow-5-configuration)

**Data Contract**:

- Request (Delete Item): `DELETE /api/items/:id`
- Guard: Reject deletion if item has any associated movements (to preserve audit trail)
- Response (success): `204 No Content`
- Response (conflict): `409 { error: "Item has movement history and cannot be deleted" }`

---

## Vertical Slice (DB → API → UI)

### 1. Database Schema

`warehouse-backend/src/db/schema.ts`

No new schema. `movement.item_id` has `ON DELETE RESTRICT` — deletion blocked at DB level if movements exist.

Consider adding `deleted_at` (soft-delete timestamp) to `item` table if soft-delete behavior is preferred.

---

### 2. API Routes

`warehouse-backend/src/routes/items.ts`

**DELETE /api/items/:id**

- **Auth**: Owner role required
- **Guard**: Check if any movement references this `item_id`; if yes return `409`
- **Handler**: Delete item (cascades to `item_sku` and `barcode` via `ON DELETE CASCADE`)

---

### 3. Frontend

`warehouse-frontend/src/pages/ItemDetail.tsx` or items list page

- Add a "Delete" button visible to Owner role only
- Show confirmation dialog before deleting
- On success: redirect to items list with success toast
- On 409: show error "This item has movement history and cannot be deleted"

---

## Acceptance Criteria

- [ ] Owner can delete an item with no movement history
- [ ] Deletion is blocked (409) if any movement references the item
- [ ] Confirmation step prevents accidental deletion
- [ ] Non-owner users do not see the delete button
- [ ] Items list refreshes after successful deletion

## Conversation

### user

Create movement for deleting products (radera produkter) from the system.

### agent

Task created. Deletion is blocked at DB level via `ON DELETE RESTRICT` on `movement.item_id`. The API returns 409 if the item has movement history, otherwise hard-deletes (cascading to SKUs and barcodes). A soft-delete variant (adding `deleted_at`) is noted as an option if the team prefers hiding rather than removing products.

### user
