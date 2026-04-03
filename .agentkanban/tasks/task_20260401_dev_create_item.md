---
title: "[DEV] Resolve or create item by barcode"
lane: todo
created: 2026-04-01
updated: 2026-04-01
description: Implement barcode resolution with inline item creation (DB → API → UI)
parent: task_20260401_contract_add_stock.md
---

## Conversation

### user

Break down the add stock contract into vertical slices.

### agent

## [DEV] Resolve or create item by barcode

Referenced from: [CONTRACT] Add Stock (Receiving)

### Vertical Slice

**Goal**: User scans unknown barcode → system creates item on-the-fly → returns item ID for further operations

**User Story**: "As a user, I want the system to let me create a new item when scanning an unknown barcode, so onboarding new products is easy"

### Implementation Checklist

- [ ] **DB**:
  - Ensure items and item_barcodes tables exist
  - item_barcodes.barcode UNIQUE constraint
- [ ] **API**: Implement `POST /api/items/barcode/:barcode/or-create` endpoint
  - Path param: barcode (string)
  - Optional request body: { name, description } (if item unknown)
  - Return item (id, name, description, barcodes, created: bool)
  - Status 200 if item exists; 201 if created
- [ ] **Backend Logic**:
  - Query item_barcodes for barcode
  - If found: return item (created: false)
  - If not found: expect name in body, create item + barcode, return (created: true)
  - Validation: if creating, name required & min 1 char
- [ ] **Authorization**: User or Owner role
- [ ] **Frontend**:
  - Create `ItemCreationDialog` component (modal with name + description fields)
  - Create `useResolveBarcode(barcode)` hook (query)
  - Create `useCreateItemFromBarcode(barcode, name, desc)` hook (mutation)
  - On scan: call query hook
    - If found: auto-proceed to qty entry
    - If not found: show creation dialog (name is required, description optional)
    - On creation: call mutation, auto-proceed
- [ ] **Types**: Generate API client
- [ ] **Tests**:
  - Happy path: scan known barcode → return existing item (created: false)
  - Create item: scan unknown barcode → show dialog → enter name → POST → item created (created: true)
  - Duplicate barcode: scan barcode → returns item A → try to manually create with same barcode → 409 Conflict
  - Missing name: scan unknown barcode → dialog → submit empty name → validation error

### Definition of Done

- [ ] `POST /api/items/barcode/:barcode/or-create` working with correct status codes
- [ ] Barcode uniqueness constraint enforced (409 on duplicate)
- [ ] Item creation idempotent: same request → same result
- [ ] Item name validation (non-empty)
- [ ] Frontend dialog UX: focused on name field, description optional, auto-debounces
- [ ] Hooks properly invalidate related queries on creation
- [ ] E2E test: scan unknown barcode → create item → verify in search

### user
