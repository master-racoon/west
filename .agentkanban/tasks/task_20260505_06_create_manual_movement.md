---
title: "[DEV] US-7.1 Create Manual Movements"
lane: done
created: 2026-05-05T00:00:00Z
updated: 2026-06-04T13:01:29.650Z
description: Owner can create ad-hoc MANUAL_ADJUSTMENT movements directly from a form, without the scan-first flow
labels:
  - flow-5-configuration
sortOrder: -1.9375
slug: create_manual_movement
---

## DFD Reference

**Flow**: Extension of [Flow-5: Configuration Management](../../docs/dfd_level0.md#flow-5-configuration)

MANUAL_ADJUSTMENT is already defined in the `movement_type` enum in the schema. This story exposes it as a dedicated Owner-only form for corrections that don't fit the normal scan flows (e.g. write-offs, corrections, opening balances for single items).

**Data Contract**:

- Request: `POST /api/inventory/movements`
  - `{ type: "MANUAL_ADJUSTMENT" | "ADD" | "REMOVE", item_id: UUID, warehouse_id: UUID, bin_id?: UUID, quantity: int (non-zero), note?: string (max 500) }`
  - `quantity` positive = stock in, negative = stock out for MANUAL_ADJUSTMENT
- Response: `{ movement_id: UUID, type, item_id, warehouse_id, bin_id?, quantity, note, created_at }`

---

## Vertical Slice (DB → API → UI)

### 1. Database Schema

No schema changes. `movement` table supports `MANUAL_ADJUSTMENT` type already.

---

### 2. API Routes

`warehouse-backend/src/routes/inventory.ts`

**POST /api/inventory/movements**

- **Auth**: Owner role required
- **Handler**:
  1. Validate item exists
  2. Validate warehouse (and bin if provided)
  3. Insert movement record
  4. No stock-level guard for MANUAL_ADJUSTMENT (owner override by definition)
- Existing ADD/REMOVE endpoints continue to work for regular operators

---

### 3. Frontend

`warehouse-frontend/src/pages/` — new `CreateMovement.tsx` or section in Owner admin area

- Form fields: movement type selector (MANUAL_ADJUSTMENT only for non-scan), item lookup (SKU/barcode/name search), warehouse, bin (if use_bins), quantity (signed int), note
- "Resolve item" pattern same as AddStock/QuickCount
- Submit creates the movement
- Success: show movement details and option to create another
- Only accessible to Owner role

---

## Acceptance Criteria

- [ ] Owner can create a MANUAL_ADJUSTMENT movement with positive or negative quantity
- [ ] Item lookup works by SKU or barcode
- [ ] Warehouse and bin selection is available
- [ ] Note field is optional but surfaced in movement history
- [ ] Movement appears in audit history with type MANUAL_ADJUSTMENT
- [ ] Non-owner users cannot access this form

## Conversation

### user

Create task for creating movements (skapa rörelser).

### agent

Task created. Targets the existing MANUAL_ADJUSTMENT movement type in the schema. Adds a dedicated Owner-only form that bypasses stock-level guards (by design). The item-lookup resolve pattern is reused from AddStock/QuickCount for consistency.

### user
