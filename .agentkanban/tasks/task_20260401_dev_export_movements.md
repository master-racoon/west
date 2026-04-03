---
title: "[DEV] Export movement history as CSV"
lane: todo
created: 2026-04-01
updated: 2026-04-01
description: Implement movement history export endpoint (DB → API → UI)
parent: task_20260401_contract_export.md
---

## Conversation

### user

Break down the data export contract into vertical slices.

### agent

## [DEV] Export movement history as CSV

Referenced from: [CONTRACT] Data Export (CSV)

### Vertical Slice

**Goal**: Owner can download full audit log of all movements as CSV for accounting/analysis

**User Story**: "As an owner, I want to export inventory data [movement history], so I can use it in spreadsheets or accounting"

### Implementation Checklist

- [ ] **DB**:
  - Use movements table and related joins
  - No schema changes needed
- [ ] **API**: Implement `GET /api/exports/movements` endpoint
  - Query params: item_id?, warehouse_id?, date_from?, date_to?, format='csv'
  - Response: CSV stream with proper headers
  - Columns: Movement ID, Timestamp, Type, Item ID, Item Name, User, Qty, Source Warehouse, Source Bin, Dest Warehouse, Dest Bin, Note
- [ ] **Backend Logic**:
  - Query movements with optional filters
  - Join with items, warehouses, bins, users
  - Order by timestamp DESC (newest first, or ASC for audit trail?)
  - Format as CSV with proper escaping
  - Set response headers: Content-Type=text/csv, Content-Disposition=attachment
- [ ] **Authorization**: Owner role only
- [ ] **Frontend**:
  - Create `DataExportPanel` component (or extend if already exists)
  - Create `useExportMovements(filters?)` mutation hook
  - Button: "Download Movements (CSV)"
  - Optional filters:
    - Item (search/select dropdown)
    - Warehouse (dropdown)
    - Date range (from/to date pickers)
  - On click: trigger export with filters, browser downloads file
- [ ] **Types**: Generate API client (or handle manually if response is binary blob)
- [ ] **Tests**:
  - Happy path: GET /api/exports/movements → CSV with all movements
  - Item filter: GET /api/exports/movements?item_id=123 → only movements for item 123
  - Warehouse filter: GET /api/exports/movements?warehouse_id=A → only A movements
  - Date range: GET /api/exports/movements?date_from=2026-03-01&date_to=2026-03-31 → only matching
  - CSV format: proper escaping of note field (may contain special chars)
  - Transfer movements: src/dest warehouse/bin columns filled
  - Empty result: no movements in range → CSV with headers, no rows

### Definition of Done

- [ ] `GET /api/exports/movements` endpoint working, returns CSV
- [ ] CSV columns complete: Movement ID, Timestamp, Type, Item, User, Qty, Warehouses, Bins, Note
- [ ] Proper CSV escaping (quotes around values with commas/quotes)
- [ ] All optional filters working (item, warehouse, date range)
- [ ] Response headers correct (Content-Type, Content-Disposition)
- [ ] Frontend filter UI with dropdowns & date pickers
- [ ] File naming includes timestamp
- [ ] Date filters use ISO8601 format (YYYY-MM-DD)
- [ ] E2E test: create movements → export with filters → verify CSV content includes correct rows

### user
