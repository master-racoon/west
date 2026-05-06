---
title: "[DEV] US-5.6 Bulk Upload Products via CSV"
lane: todo
created: 2026-05-05T00:00:00Z
updated: 2026-05-05T00:00:00Z
description: Owner can upload a CSV file to create multiple products (items + SKUs) in one operation
labels:
  - flow-5-configuration
sortOrder: 13
slug: flow5_bulk_upload_products
---

## DFD Reference

**Flow**: [Flow-5: Configuration Management](../../docs/dfd_level0.md#flow-5-configuration)

**Data Contract**:

- Request: `POST /api/items/bulk` — multipart form with CSV file
  - CSV columns: `name` (required), `description` (optional), `sku` (optional, may repeat per item), `barcode` (optional, may repeat per item)
  - Multiple rows with the same `name` are merged into one item with multiple SKUs/barcodes
- Response: `{ created: number, skipped: number, errors: [ { row: number, reason: string } ] }`

**CSV Example**:

```
name,description,sku,barcode
Widget A,Blue widget,SKU-001,1234567890
Widget A,,SKU-002,
Widget B,Red widget,SKU-003,9876543210
```

---

## Vertical Slice (DB → API → UI)

### 1. Database Schema

No schema changes. Uses existing `item`, `item_sku`, `barcode` tables.

---

### 2. API Routes

`warehouse-backend/src/routes/items.ts`

**POST /api/items/bulk**

- **Auth**: Owner role required
- **Content-Type**: `multipart/form-data` with `file` field (CSV)
- **Max size**: 5 MB
- **Handler**:
  1. Parse CSV rows
  2. Group rows by `name` to merge multi-SKU items
  3. Upsert items (create or skip if name already exists)
  4. Insert unique SKUs and barcodes (skip duplicates, record as skipped)
  5. Return summary with row-level errors
- **Validation per row**: name required (1–200 chars), SKU uniqueness, barcode uniqueness

---

### 3. Frontend

`warehouse-frontend/src/pages/` — new `BulkUploadProducts.tsx` or section in items settings

- File picker for CSV
- Download sample CSV template link
- Upload button triggers `POST /api/items/bulk`
- Progress/loading state during upload
- Result summary: "X created, Y skipped, Z errors"
- Error table showing row number and reason for failures

---

## Acceptance Criteria

- [ ] Owner can upload a valid CSV and items are created
- [ ] Duplicate SKUs/barcodes in CSV are skipped with an error row reported
- [ ] Items already existing (by name) are skipped (no duplicate creation)
- [ ] CSV template download is available
- [ ] Upload result summary clearly shows created/skipped/error counts
- [ ] Row-level errors are displayed with the row number and reason
- [ ] Non-owner users cannot access the bulk upload feature

## Conversation

### user

Create task for bulk uploading products.

### agent

Task created. Uses CSV multipart upload. Rows sharing the same `name` are merged into one item with multiple SKUs/barcodes. The response includes row-level error detail so users can fix and re-upload only the failing rows.

### user
