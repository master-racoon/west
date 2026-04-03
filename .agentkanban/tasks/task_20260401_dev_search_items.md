---
title: "[DEV] Search items by barcode or name"
lane: todo
created: 2026-04-01
updated: 2026-04-01
description: Implement item search with barcode/name resolution (DB → API → UI) as vertical slice
parent: task_20260401_contract_visibility.md
---

## Conversation

### user

Break down the inventory visibility contract into vertical slices.

### agent

## [DEV] Search items by barcode or name

Referenced from: [CONTRACT] Inventory Visibility (Search/View)

### Vertical Slice

**Goal**: User searches by barcode or item name → backend resolves to item → frontend shows results

**User Story**: "As an owner, I want to search or scan an item and see results immediately"

### Implementation Checklist

- [ ] **DB**: Ensure items & item_barcodes tables exist with proper indexes
- [ ] **API**: Implement `GET /api/items/search` endpoint with Zod schema
  - Input: `q` (search term), optional `warehouse_id`
  - Output: Array of matching items with barcode list
  - Validation: q must be ≥ 1 character
- [ ] **Backend Logic**:
  - Search items.name ILIKE %q% OR item_barcodes.barcode = q (exact first, then fuzzy)
  - Join with item_barcodes to return all barcodes per item
- [ ] **Authorization**: Any authenticated user
- [ ] **Frontend**:
  - Create `ItemSearchBar` component (input field, debounced search)
  - Create `useItemSearch(query)` hook with TanStack Query
  - Display results as dropdown/inline list
- [ ] **Types**: Generate API client via `npm run generate-api`
- [ ] **Tests**:
  - Happy path: search "Widget" → returns matching items
  - Exact match: scan "123456789" → returns item with that barcode
  - No results: search "xyz" → empty array
  - Validation: empty search → error

### Definition of Done

- [ ] `GET /api/items/search` returns correct shape per schema
- [ ] Search works by barcode (exact match prioritized) and name (ILIKE)
- [ ] Frontend search bar with debounce (300ms) to avoid excessive API calls
- [ ] Results render as clickable list, navigating to item detail view
- [ ] No N+1 queries: barcode list fetched in single query
- [ ] E2E test: scan barcode → search results populated

### user
