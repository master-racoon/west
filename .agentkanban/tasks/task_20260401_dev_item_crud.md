---
title: "[DEV] CRUD operations for items and barcodes"
lane: todo
created: 2026-04-01
updated: 2026-04-01
description: Implement item and barcode management endpoints (DB → API → UI)
parent: task_20260401_contract_config.md
---

## Conversation

### user

Break down the configuration management contract into vertical slices.

### agent

## [DEV] CRUD operations for items and barcodes

Referenced from: [CONTRACT] Configuration Management (Admin)

### Vertical Slice

**Goal**: Owner can create items, edit metadata, add/remove barcodes, manage SKU catalog

**User Story**: "As an owner, I want to manage items, barcodes... so the system reflects the real environment"

### Implementation Checklist

- [ ] **DB**:
  - Ensure items table (id, name, description, created_at, updated_at)
  - Ensure item_barcodes table (id, item_id, barcode UNIQUE, created_at)
- [ ] **API**: Implement endpoints
  - `GET /api/items/admin` → list all items with inventory totals & barcode lists
  - `POST /api/items` → create new item
  - `PATCH /api/items/:itemId` → edit name/description
  - `POST /api/items/:itemId/barcodes` → add barcode
  - `DELETE /api/items/:itemId/barcodes/:barcodeId` → remove barcode
- [ ] **Backend Logic**:
  - GET admin: return items with aggregated quantity + warehouse splits + barcode list
  - POST item: validate name non-empty; create & return
  - PATCH item: update name/description
  - POST barcode: validate barcode non-empty & unique; create
  - DELETE barcode: remove (no referential constraints needed, soft delete OK)
- [ ] **Authorization**: Owner role only
- [ ] **Frontend**:
  - Create `ItemAdmin` component with searchable/paginated item list
  - Create `useItemsAdmin()` query hook
  - Create `useCreateItem()` mutation hook
  - Create `useUpdateItem(id)` mutation hook
  - Create `useAddBarcode(itemId)` mutation hook
  - Create `useDeleteBarcode(itemId, barcodeId)` mutation hook
  - UI: list items with columns (name, barcode list, total qty)
  - Create modal: name + description fields
  - Edit row: inline edit name/description
  - Barcode section: list barcodes, add/remove buttons
  - On delete item: warn if inventory > 0 (allow but warn)
- [ ] **Types**: Generate API client
- [ ] **Tests**:
  - Happy path: create item "Widget" → listed in admin
  - Add barcode: create item → add barcode "123" → barcode listed
  - Add multiple barcodes: same item, add "123" & "456" → both listed
  - Duplicate barcode: add "123" to item A, try add "123" to item B → 409 Conflict
  - Edit item: change name "Widget" → "Gadget" → reflected
  - Delete barcode: item with 2 barcodes → remove one → 1 barcode remains
  - Validation: empty name → 400

### Definition of Done

- [ ] `GET /api/items/admin` returns correct schema with quantities per warehouse
- [ ] `POST /api/items` endpoint working, name validation
- [ ] `PATCH /api/items/:itemId` endpoint working
- [ ] `POST /api/items/:itemId/barcodes` endpoint with unique constraint
- [ ] `DELETE /api/items/:itemId/barcodes/:barcodeId` endpoint working
- [ ] Frontend item list renders with searchable/paginated table
- [ ] Create item modal with name & description
- [ ] Edit inline or modal for name/description
- [ ] Barcode list visible with add/remove buttons
- [ ] Confirmation on destructive actions (delete barcode)
- [ ] E2E test: create item → add barcode → edit name → remove barcode

### user
