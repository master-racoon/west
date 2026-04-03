---
title: "[DEV] Export inventory snapshot as CSV"
lane: todo
created: 2026-04-01
updated: 2026-04-01
description: Implement inventory export endpoint (DB → API → UI)
parent: task_20260401_contract_export.md
---

## Conversation

### user

Break down the data export contract into vertical slices.

### agent

## [DEV] Export inventory snapshot as CSV

Referenced from: [CONTRACT] Data Export (CSV)

### Vertical Slice

**Goal**: Owner can download current inventory balances as CSV file

**User Story**: "As an owner, I want to export inventory data, so I can use it in spreadsheets or accounting"

### Implementation Checklist

- [ ] **DB**:
  - Use existing movements table to aggregate current balances
  - No schema changes needed
- [ ] **API**: Implement `GET /api/exports/inventory` endpoint
  - Query params: warehouse_id?, format='csv'
  - Response: CSV stream with proper headers
  - Columns: Item ID, Item Name, Warehouse, Bin, Quantity, Last Updated
- [ ] **Backend Logic**:
  - Query movements, aggregate SUM per (item, warehouse, bin)
  - Join with item names, warehouse names, bin names
  - Format as CSV with proper escaping (quotes, commas in values)
  - Set response headers: Content-Type=text/csv, Content-Disposition=attachment
- [ ] **Authorization**: Owner role only
- [ ] **Frontend**:
  - Create `DataExportPanel` component
  - Create `useExportInventory(filters?)` mutation hook
  - Button: "Download Inventory (CSV)"
  - Optional filters: warehouse dropdown
  - On click: trigger export, browser auto-downloads file
- [ ] **Types**: Generate API client (or handle manually if response is binary blob)
- [ ] **Tests**:
  - Happy path: GET /api/exports/inventory → CSV file with correct data
  - Warehouse filter: GET /api/exports/inventory?warehouse_id=A → only A items
  - CSV format: proper quoting & escaping of special chars
  - Negative balances: included in export as-is (e.g., -5)
  - Empty inventory: still returns CSV with headers but no rows

### Definition of Done

- [ ] `GET /api/exports/inventory` endpoint working, returns CSV
- [ ] CSV columns correct: Item ID, Item Name, Warehouse, Bin, Quantity, Last Updated
- [ ] Proper CSV escaping (quotes around values with commas/quotes)
- [ ] Warehouse filter optional and working
- [ ] Response headers correct (Content-Type, Content-Disposition)
- [ ] Frontend button triggers download
- [ ] File naming includes timestamp (e.g., inventory_20260401_103000.csv)
- [ ] E2E test: add/remove items → export → verify CSV content

### user
