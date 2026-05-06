---
title: "[DEV] US-4.2 Bulk Upload Current Balance via CSV"
lane: todo
created: 2026-05-05T00:00:00Z
updated: 2026-05-05T00:00:00Z
description: Owner can upload a CSV to set opening/current stock balances, creating COUNT_ADJUSTMENT movements in bulk
labels:
  - flow-4-quick-count
sortOrder: 14
slug: flow4_bulk_upload_balance
---

## DFD Reference

**Flow**: [Flow-4: Quick Count (Physical Count Adjustment)](../../docs/dfd_level0.md#flow-4-quick-count)

Bulk balance upload is a mass variant of Quick Count — each row creates a `COUNT_ADJUSTMENT` movement that reconciles the recorded balance to the CSV-specified quantity.

**Data Contract**:

- Request: `POST /api/inventory/bulk-balance` — multipart form with CSV file
  - CSV columns: `sku` (required), `warehouse_name` (required), `bin_name` (optional), `quantity` (required, int ≥ 0)
- Response: `{ processed: number, skipped: number, errors: [ { row: number, reason: string } ] }`

**CSV Example**:

```
sku,warehouse_name,bin_name,quantity
SKU-001,Warehouse A,Shelf 1,50
SKU-002,Warehouse A,,30
SKU-003,Warehouse B,,0
```

---

## Vertical Slice (DB → API → UI)

### 1. Database Schema

No schema changes. Each row becomes a `COUNT_ADJUSTMENT` movement record.

---

### 2. API Routes

`warehouse-backend/src/routes/inventory.ts`

**POST /api/inventory/bulk-balance**

- **Auth**: Owner role required
- **Content-Type**: `multipart/form-data` with `file` field (CSV)
- **Max size**: 5 MB
- **Handler per row**:
  1. Resolve `sku` → `item_id` (error if not found)
  2. Resolve `warehouse_name` → `warehouse_id` (error if not found)
  3. Resolve `bin_name` → `bin_id` if provided (error if not found)
  4. Compute current balance for (item, warehouse, bin)
  5. Calculate delta = `quantity - current_balance`
  6. If delta ≠ 0: insert `COUNT_ADJUSTMENT` movement with the delta
  7. If delta = 0: skip row (no movement needed)
- **Atomicity**: Rows are processed individually; failed rows are reported but do not rollback successful rows

---

### 3. Frontend

`warehouse-frontend/src/pages/` — new `BulkUploadBalance.tsx` or section in inventory settings

- File picker for CSV
- Download sample CSV template
- Upload button
- Loading/progress state
- Result summary: "X rows processed, Y skipped (no change), Z errors"
- Error table: row number and reason

---

## Acceptance Criteria

- [ ] Owner can upload a CSV and stock balances are adjusted via COUNT_ADJUSTMENT movements
- [ ] Rows where quantity equals current balance are skipped (no unnecessary movements)
- [ ] Unknown SKU, warehouse, or bin in a row produces a row-level error without aborting the rest
- [ ] Resulting movements appear in movement history with type `COUNT_ADJUSTMENT`
- [ ] CSV template is downloadable
- [ ] Non-owner users cannot access this feature

## Conversation

### user

Create task for bulk uploading current balance (bulk upload current balance).

### agent

Task created. Each CSV row maps to a COUNT_ADJUSTMENT movement — the same mechanism as manual Quick Count but applied in bulk. Rows with delta = 0 are skipped to keep the audit log clean. Non-atomic processing (row-by-row) lets partial uploads succeed with a clear error report.

### user
