---
title: "[DEV] US-6.5 SKU Search Across All Lookup Fields"
lane: todo
created: 2026-05-05T00:00:00Z
updated: 2026-05-05T00:00:00Z
description: All item-lookup inputs (AddStock, RemoveStock, Transfer, QuickCount, CreateMovement) accept SKU as a valid search term, and the resolve endpoint returns the matching item
labels:
  - inventory-visibility
  - flow-1-add-stock
sortOrder: 16
slug: inventory_sku_search
---

## DFD Reference

**Flows**: All mutation flows that use item-lookup (Flows 1–4 + MANUAL_ADJUSTMENT)

Item resolution currently goes through `GET /api/items/resolve?q=<value>`. That endpoint must query `item_sku.sku` in addition to `barcode.barcode` and `item.id`.

**Data Contract**:

- Request (existing): `GET /api/items/resolve?q=<value>`
  - `value` matched against: `item.id` (UUID), `barcode.barcode`, **`item_sku.sku`** (new)
- Response (unchanged): `{ id: UUID, name: string, sku?: string }`

---

## Vertical Slice (DB → API → UI)

### 1. Database Schema

No schema changes. `item_sku` table with `idx_item_sku_unique` index already supports fast SKU lookups.

---

### 2. API Routes

`warehouse-backend/src/routes/items.ts`

**GET /api/items/resolve** (update existing handler)

- Add a third lookup branch: `WHERE item_sku.sku = :q`
- Join `item_sku` → `item` to return the matched item
- Priority order: UUID match → barcode match → SKU match (first match wins)
- Return existing response shape (no breaking changes)

---

### 3. Frontend

No dedicated UI changes required. Because all lookup flows already use `resolveItemReference()` from `lib/api.ts`, fixing the backend endpoint propagates to all pages automatically:

- `AddStock.tsx`
- `RemoveStock.tsx`
- `TransferStock.tsx`
- `QuickCount.tsx`
- `CreateMovement.tsx` (new, from US-7.1)

Add placeholder text update: `"Scan barcode or enter SKU"` (already matches but verify on all pages).

---

## Acceptance Criteria

- [ ] Entering a valid SKU in any item-lookup field and pressing Resolve returns the correct item
- [ ] SKU match works on AddStock, RemoveStock, QuickCount, Transfer, and CreateMovement pages
- [ ] UUID and barcode lookups continue to work (no regression)
- [ ] Resolved item display shows the matched SKU when resolved via SKU

## Conversation

### user

Create task for adding SKU search in all fields (lagg till soka pa SKU i alla falt).

### agent

Task created. The fix is minimal: update the resolve endpoint to include a third lookup branch against `item_sku.sku`. Because all scan pages share `resolveItemReference()` from `lib/api.ts`, a single backend change propagates everywhere. No new UI components needed.

### user
