---
title: "[BUG] US-2.4 Show SKU on Resolved Item (Resolve Buttons)"
lane: todo
created: 2026-05-05T00:00:00Z
updated: 2026-06-04T13:01:44.354Z
description: After resolving an item via the Resolve button, the SKU is not displayed in the resolved item confirmation area on scan pages
labels:
  - flow-1-add-stock
sortOrder: 1775260800000
slug: bug_sku_on_resolve_display
---

## DFD Reference

**Flows**: All scan flows that use the resolve pattern (Flows 1–4)

The `resolveItemReference` API call returns `{ id, name, sku? }`. The frontend `ResolvedItem` interface declares `sku?` but the backend `GET /api/items/resolve` may not be returning `sku` in all cases. Additionally, the resolved item display on some pages may not render the SKU even when it is returned.

---

## Bug Analysis

### Root Cause Candidates

1. **Backend**: `GET /api/items/resolve` does not include `sku` in the response payload
2. **Frontend**: `ResolvedItem` interface has `sku?` defined but the resolved item display only shows SKU conditionally — if backend omits it the field is silently absent
3. **All scan pages** re-define `ResolvedItem` locally instead of sharing a type — inconsistency across pages

### Affected Files

- `warehouse-backend/src/routes/items.ts` — resolve endpoint response
- `warehouse-frontend/src/pages/AddStock.tsx` — resolved item display
- `warehouse-frontend/src/pages/RemoveStock.tsx` — same pattern
- `warehouse-frontend/src/pages/QuickCount.tsx` — same pattern
- `warehouse-frontend/src/pages/TransferStock.tsx` — same pattern

---

## Vertical Slice Fix

### 1. Backend

`warehouse-backend/src/routes/items.ts` — `GET /api/items/resolve`

- Ensure response includes `sku: string | null` (first SKU from `item_sku` for this item, or null)
- Join `item_sku` in resolve query

### 2. Frontend Shared Type

`warehouse-frontend/src/lib/api.ts`

- Export a shared `ResolvedItem` type: `{ id: string; name: string; sku: string | null }`
- Remove local re-definitions from individual pages

### 3. Display Fix (all scan pages)

Resolved item confirmation area should always show:

- Item name
- SKU if present: `SKU: SKU-001`
- If no SKU: show `—` rather than nothing

---

## Acceptance Criteria

- [ ] After resolving any item, the SKU is shown in the resolved item display area
- [ ] Items without a SKU show a clear indicator (e.g. "No SKU") rather than empty
- [ ] SKU display is consistent across AddStock, RemoveStock, QuickCount, and Transfer pages
- [ ] Backend resolve endpoint always includes `sku` field in response (nullable if none assigned)

## Conversation

### user

Create task for bug: SKU not shown on resolve buttons (SKU ej infort pa 'resolve' knappar).

### agent

Task created. The `ResolvedItem` type already has `sku?` in the interface and display code uses it conditionally. The likely issue is the backend resolve endpoint not returning the SKU field. Fix is: join `item_sku` in the resolve query and ensure `sku` is in the response. Secondary improvement: share the `ResolvedItem` type across pages to prevent future drift.

### user
