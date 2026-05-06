---
title: "[DEV] US-5.5 Edit Products"
lane: todo
created: 2026-05-05T00:00:00Z
updated: 2026-05-05T00:00:00Z
description: Owner can edit item name, description, and manage its SKUs/barcodes
labels:
  - flow-5-configuration
sortOrder: 11
slug: flow5_edit_items
---

## DFD Reference

**Flow**: [Flow-5: Configuration Management](../../docs/dfd_level0.md#flow-5-configuration)

**Data Contract**:

- Request (Update Item): `PATCH /api/items/:id`
  - `{ name?: string (1-200), description?: string }`
- Response: `{ id: UUID, name, description, skus: string[], barcodes: string[], updated_at: ISO8601 }`
- Request (Add SKU): `POST /api/items/:id/skus` `{ sku: string (1-100) }`
- Request (Remove SKU): `DELETE /api/items/:id/skus/:skuId`
- Request (Add Barcode): `POST /api/items/:id/barcodes` `{ barcode: string (1-200) }`
- Request (Remove Barcode): `DELETE /api/items/:id/barcodes/:barcodeId`

---

## Vertical Slice (DB → API → UI)

### 1. Database Schema

`warehouse-backend/src/db/schema.ts`

No schema changes. Existing `item`, `item_sku`, `barcode` tables cover this.

---

### 2. API Routes

`warehouse-backend/src/routes/items.ts`

**PATCH /api/items/:id**

- **Auth**: Owner role required
- **Handler**: Update `name` and/or `description`, set `updated_at = now()`

**POST /api/items/:id/skus**

- **Auth**: Owner role required
- **Guard**: SKU must be globally unique (`idx_item_sku_unique`)

**DELETE /api/items/:id/skus/:skuId**

- **Auth**: Owner role required
- **Guard**: Item must retain at least one identifier (barcode or SKU) — warn if removing last one

**POST /api/items/:id/barcodes** / **DELETE /api/items/:id/barcodes/:barcodeId**

- Same pattern as SKU management above

---

### 3. Frontend

`warehouse-frontend/src/pages/ItemDetail.tsx`

- Editable form for `name` and `description` (visible to Owner role)
- Inline tag-style list for SKUs: add new, remove existing
- Inline tag-style list for barcodes: add new, remove existing
- Save button per section or single save
- Validation inline

---

## Acceptance Criteria

- [ ] Owner can update item name and description
- [ ] Owner can add and remove SKUs (with uniqueness validation)
- [ ] Owner can add and remove barcodes (with uniqueness validation)
- [ ] Changes are persisted and reflected immediately in the UI
- [ ] Non-owners see the detail page as read-only
- [ ] Updated `updated_at` timestamp is reflected after save

## Conversation

### user

Create task for editing products (redigera produkter).

### agent

Task created. Covers name/description updates plus inline SKU and barcode management. Each sub-resource (sku, barcode) gets its own add/remove endpoint to keep each operation small and independently testable.

### user
