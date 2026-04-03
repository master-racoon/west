---
title: "[DEV] View item details with inventory balance and history"
lane: todo
created: 2026-04-01
updated: 2026-04-01
description: Implement item detail page with inventory breakdown and movement log (DB → API → UI)
parent: task_20260401_contract_visibility.md
---

## Conversation

### user

Break down the inventory visibility contract into vertical slices.

### agent

## [DEV] View item details with inventory balance and history

Referenced from: [CONTRACT] Inventory Visibility (Search/View)

### Vertical Slice

**Goal**: User navigates to item → sees total qty, breakdown by warehouse/bin, and movement history

**User Stories**:

- "As an owner, I want to see where an item is stored (bins if used)"
- "As an owner, I want to see the history of movements for an item"

### Implementation Checklist

- [ ] **DB**:
  - Ensure items, item_barcodes, movements, bins, warehouses indexed
  - No schema changes needed; use aggregation queries
- [ ] **API**: Implement `GET /api/items/:itemId` endpoint
  - Return item metadata (name, description, barcodes)
  - Aggregate inventory_balances from movements (SUM group by warehouse/bin)
  - Return movement history (last 50 movements, ordered by timestamp DESC)
  - Validation: itemId must exist
- [ ] **Backend Logic**:
  - Query movements filtered by item_id
  - GROUP BY (warehouse_id, bin_id) with SUM(quantity) = current_balance
  - Return movements in reverse chrono order
- [ ] **Authorization**: Any authenticated user
- [ ] **Frontend**:
  - Create `ItemDetailsView` component (layout: summary + inventory table + movement log)
  - Create `useItem(itemId)` hook with TanStack Query
  - Display inventory as table (warehouse | bin | qty)
  - Display movements as paginated/scrollable log with types, deltas, user, timestamp, note
- [ ] **Types**: Generate API client
- [ ] **Tests**:
  - Happy path: GET /api/items/123 → full item details with balances
  - Inventory aggregation: multiple movements → correct sum per location
  - Movement history: 10 movements recorded → all visible, newest first
  - Negative balance allowed: movements sum to negative → shown as-is
  - Missing item: GET /api/items/fake → 404

### Definition of Done

- [ ] `GET /api/items/:itemId` returns correct shape per schema
- [ ] Inventory balances correctly aggregated from movements (no hardcoded values)
- [ ] Movements ordered DESC by timestamp
- [ ] Warehouse/bin names resolved (JOINed from respective tables)
- [ ] Frontend displays inventory table with proper columns
- [ ] Frontend displays movement log with pagination or scroll
- [ ] Item page accessible via search results (click → detail page)
- [ ] E2E test: Add movement → refresh item detail → new movement in history

### user
