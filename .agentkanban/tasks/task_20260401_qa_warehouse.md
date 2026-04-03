---
title: "[QA] Warehouse Inventory System Test Plan"
lane: todo
created: 2026-04-01
updated: 2026-04-01
description: Define test cases and validation for the complete Warehouse system
parent: task_20260401_dfd0_warehouse.md
---

## Conversation

### user

Define the QA test plan for the complete Warehouse system.

### agent

## [QA] Warehouse Inventory System Test Plan

Referenced from: [DFD-0] Warehouse Inventory System Data Flow

### Test Scope

This plan covers end-to-end happy path scenarios and critical error paths across all major flows:

1. Inventory Visibility (Search/View)
2. Add Stock
3. Remove Stock
4. Transfer Stock
5. Quick Count
6. Configuration Management
7. Data Export

---

## Test Environment

- **Backend**: Hono API on Cloudflare Pages Functions (or local dev :8788)
- **Frontend**: React SPA (dev :5173)
- **Database**: Neon Postgres (Dockerized for tests)
- **Tools**: Playwright E2E tests, Vitest integration tests (backend), TanStack Query for API)
- **Auth**: BetterAuth (test users: owner@family.local, user@family.local)

---

## Happy Path Test Cases

### TC-001: Search and view inventory

**Setup**:

- Create warehouse A (no bins)
- Create item "Widget A" with barcode "123456"
- Add 50 qty to warehouse A

**Steps**:

1. User logs in
2. Opens search bar, scans barcode "123456"
3. System shows item in dropdown
4. User clicks item to view details
5. Item detail page loads, showing:
   - Item name: "Widget A"
   - Barcode: "123456"
   - Inventory table: Warehouse A | 50 qty
   - Movement history: 1 ADD entry with timestamp, qty 50

**Expected**: Item found, inventory correct, history loaded

---

### TC-002: Add stock (no bins)

**Setup**:

- Warehouse A (no bins)
- Item "Widget A" barcode "123456"
- Current qty: 0

**Steps**:

1. User navigates to Add Stock form
2. Selects Warehouse A
3. Scans barcode "123456"
4. Enters quantity: 50
5. Optional note: "Receiving order #001"
6. Clicks Confirm

**Expected**:

- ADD movement created
- Inventory balance updated to 50
- Confirmation message shown
- Form resets

---

### TC-003: Create item during add stock

**Setup**:

- Warehouse A (no bins)

**Steps**:

1. User navigates to Add Stock form
2. Selects Warehouse A
3. Scans unknown barcode "999888"
4. System shows creation dialog
5. User enters name: "New Item"
6. User enters quantity: 25
7. Clicks Confirm

**Expected**:

- Item created with barcode "999888"
- ADD movement with qty 25 recorded
- Confirmation shown
- Item now searchable

---

### TC-004: Add stock with bins

**Setup**:

- Warehouse B (use_bins=true)
- Create bin "Shelf-A"
- Item "Gadget B"
- Current qty in Shelf-A: 0

**Steps**:

1. User navigates to Add Stock form
2. Selects Warehouse B
3. Searches for item "Gadget B"
4. Bin selector appears (required)
5. Selects "Shelf-A"
6. Enters quantity: 30
7. Clicks Confirm

**Expected**:

- ADD movement created with bin_id
- Balance updated for (Gadget B, Warehouse B, Shelf-A) = 30
- Confirmation shown

---

### TC-005: Remove stock (sufficient balance)

**Setup**:

- Warehouse A
- Item "Widget A" qty 50

**Steps**:

1. User navigates to Remove Stock form
2. Selects Warehouse A
3. Scans barcode "123456" (Widget A)
4. System shows current balance: 50
5. Enters quantity to remove: 10
6. Clicks Confirm

**Expected**:

- REMOVE movement created with qty 10
- Balance updated to 40
- Confirmation shown with before/after

---

### TC-006: Attempt remove with insufficient balance (regular user)

**Setup**:

- Warehouse A
- Item "Widget A" qty 10

**Steps**:

1. User navigates to Remove Stock form
2. Selects Warehouse A
3. Scans "123456" (Widget A)
4. System shows balance: 10
5. Tries to remove 20
6. Clicks Confirm

**Expected**:

- Error shown: "Insufficient stock: have 10, trying to remove 20"
- No movement recorded
- Form not submitted

---

### TC-007: Owner override negative inventory

**Setup**:

- Warehouse A
- Item "Widget A" qty 10
- Owner logged in

**Steps**:

1. Owner navigates to Remove Stock form
2. Selects Warehouse A
3. Scans "123456" (Widget A)
4. Tries to remove 20
5. Warning shown: "Insufficient balance. Override?"
6. Owner clicks "Force Remove"
7. Modal prompts for reason
8. Owner enters: "Customer goodwill"
9. Submits

**Expected**:

- REMOVE movement created with qty 20 + override_reason
- Balance becomes -10
- Confirmation shown with negative balance warning
- Movement record includes override_reason

---

### TC-008: Transfer stock between warehouses

**Setup**:

- Warehouse A qty 50, Warehouse B qty 0
- Item "Widget A"

**Steps**:

1. User navigates to Transfer Stock form
2. Scans item "Widget A"
3. Enters quantity: 20
4. Selects source: Warehouse A
5. Selects destination: Warehouse B
6. Clicks Confirm

**Expected**:

- TRANSFER movement created
- Warehouse A balance: 50 → 30
- Warehouse B balance: 0 → 20
- Confirmation shows both balances

---

### TC-009: Quick count adjustment (correction downward)

**Setup**:

- Warehouse A, Item "Widget A" qty 50 (recorded)
- User physically counts and finds only 47

**Steps**:

1. User navigates to Quick Count form
2. Selects Warehouse A
3. Scans "123456" (Widget A)
4. System shows recorded: 50
5. User enters observed: 47
6. Optional note: "Found damaged items"
7. Clicks Confirm

**Expected**:

- COUNT_ADJUSTMENT movement created with qty=-3 (delta)
- Balance updated to 47
- Summary shown: "Was 50, now 47 (delta: -3)"

---

### TC-010: Quick count correction upward

**Setup**:

- Warehouse A, Item "Gadget B" qty 10 (recorded)
- User counts and finds 15

**Steps**:

1. User navigates to Quick Count form
2. Selects Warehouse A
3. Scans item "Gadget B"
4. Enters observed: 15
5. Clicks Confirm

**Expected**:

- COUNT_ADJUSTMENT movement with qty=+5
- Balance updated to 15
- Summary: "Was 10, now 15 (delta: +5)"

---

### TC-011: Create warehouse (owner)

**Setup**:

- Owner logged in

**Steps**:

1. Owner navigates to Admin > Warehouses
2. Clicks "Create Warehouse"
3. Modal shows with fields: name, use_bins
4. Enters name: "Warehouse C"
5. Toggles use_bins: false
6. Clicks Create

**Expected**:

- Warehouse C created
- Listed in warehouse admin table
- Can be selected in forms

---

### TC-012: Create warehouse with bins enabled

**Setup**:

- Owner logged in

**Steps**:

1. Admin > Warehouses
2. Create Warehouse
3. Name: "Warehouse D"
4. Toggle use_bins: true
5. Create

**Expected**:

- Warehouse D created with use_bins=true
- Bin management section available for this warehouse
- Can create bins

---

### TC-013: Create bin (owner)

**Setup**:

- Warehouse D with use_bins=true

**Steps**:

1. Owner navigates to Admin > Warehouses > Warehouse D > Bins
2. Clicks "Create Bin"
3. Modal: name "Shelf-A"
4. Clicks Create

**Expected**:

- Bin "Shelf-A" created
- Listed in bin admin
- Can be selected in add/remove/transfer forms

---

### TC-014: Create item (owner)

**Setup**:

- Owner logged in

**Steps**:

1. Admin > Items
2. Clicks "Create Item"
3. Modal: name "New Gadget", description "Red color"
4. Clicks Create

**Expected**:

- Item created
- Listed in item admin
- Can be scanned/searched

---

### TC-015: Add barcode to item (owner)

**Setup**:

- Item "New Gadget" with no barcodes

**Steps**:

1. Admin > Items > click "New Gadget"
2. Barcode section, click "Add Barcode"
3. Enter barcode: "555666"
4. Clicks Add

**Expected**:

- Barcode added to item
- Barcode "555666" now resolves to "New Gadget" when scanned

---

### TC-016: Export inventory snapshot (owner)

**Setup**:

- Owner logged in
- Warehouse A with qty 50, Warehouse B with qty 25

**Steps**:

1. Admin > Data Export
2. Clicks "Download Inventory (CSV)"
3. Browser downloads file

**Expected**:

- CSV file downloaded (inventory\_<timestamp>.csv)
- Contains columns: Item ID, Item Name, Warehouse, Bin, Quantity, Last Updated
- Warehouse A entry shown with 50
- Warehouse B entry shown with 25
- Proper CSV escaping if names contain commas

---

### TC-017: Export movements with filters (owner)

**Setup**:

- Multiple movements across items/warehouses/dates

**Steps**:

1. Admin > Data Export
2. Select filter: Item = "Widget A"
3. Clicks "Download Movements (CSV)"

**Expected**:

- CSV file downloaded
- Contains only movements for "Widget A"
- All columns present: Movement ID, Type, Timestamp, etc.
- Proper timestamp format (ISO8601)

---

## Error Path Test Cases

### TC-E001: Search with empty query

**Steps**:

1. User opens search, tries to search with empty string

**Expected**:

- Error message: "Search term required"
- No API call made

---

### TC-E002: Add stock with zero quantity

**Setup**:

- Add Stock form open

**Steps**:

1. Selects warehouse, item, enters qty: 0
2. Clicks Confirm

**Expected**:

- Validation error: "Quantity must be greater than 0"
- No movement recorded

---

### TC-E003: Add stock to non-existent warehouse

**Setup**:

- Form open with invalid warehouse ID in URL (manual injection)

**Steps**:

1. Attempts to submit with invalid warehouse_id

**Expected**:

- Error: "Warehouse not found"
- 404 response

---

### TC-E004: Remove from non-bin warehouse but bin_id provided

**Setup**:

- Warehouse A (use_bins=false)
- Item "Widget A"

**Steps**:

1. Form attempts to submit with {item_id, warehouse_id: A, bin_id: "xyz", qty: 5}

**Expected**:

- Validation error: "Bin not allowed for this warehouse"
- 400 response

---

### TC-E005: Cannot disable bins if occupied

**Setup**:

- Warehouse B (use_bins=true)
- Bin "Shelf-A" with item qty 10

**Steps**:

1. Owner navigates to Admin > Warehouses > Warehouse B
2. Toggles use_bins from true to false
3. Clicks Save

**Expected**:

- Warning shown: "Cannot disable bins: 1 bin(s) contain items"
- Change not applied
- 409 response from API

---

### TC-E006: Cannot delete non-empty bin

**Setup**:

- Warehouse B with bin "Shelf-A" containing qty 10

**Steps**:

1. Admin > Warehouses > Warehouse B > Bins
2. Clicks delete on "Shelf-A"
3. Confirmation dialog shows: "This bin has 10 items. Delete anyway?"
4. Clicks Delete

**Expected**:

- Error: "Bin not empty"
- 409 response
- Bin not deleted

---

### TC-E007: Duplicate barcode

**Setup**:

- Item A with barcode "123456"

**Steps**:

1. Admin > Items > Item B > Add Barcode
2. Enters barcode "123456" (already exist on Item A)
3. Clicks Add

**Expected**:

- Error: "Barcode already exists"
- 409 response
- Barcode not added

---

### TC-E008: Access admin pages as regular user

**Setup**:

- Regular user logged in

**Steps**:

1. Attempts to navigate to /admin/warehouses
2. Or attempts to POST /api/warehouses

**Expected**:

- 403 Forbidden response
- Redirect to home or error page
- Regular user cannot see admin pages

---

### TC-E009: Transfer from warehouse to itself

**Setup**:

- Transfer form open

**Steps**:

1. Scan item
2. Enter qty
3. Select source: Warehouse A
4. Select destination: Warehouse A
5. Clicks Confirm

**Expected**:

- Error: "Source and destination must be different"
- 400 response

---

### TC-E010: Transfer with insufficient source balance

**Setup**:

- Warehouse A qty 5
- Warehouse B qty 0

**Steps**:

1. User transfers item qty 10 from A to B

**Expected**:

- Error: "Insufficient balance in source warehouse"
- 400 response
- No movement recorded

---

---

## Non-Functional Requirements

### Performance

- Search results return within 500ms
- Item detail page loads within 1s
- CSV export completes within 5s for 10k rows

### Accessibility

- All forms have proper labels
- Keyboard navigation works
- Error messages clear and accessible

### Security

- Authorization checks on all admin endpoints
- No sensitive data in logs/exports
- SQL injection prevented (Drizzle ORM)

### Usability

- Confirmation dialogs before destructive actions
- Clear error messages (not technical jargon)
- Success/failure feedback immediate

---

## Test Execution Strategy

1. **Unit Tests** (Backend Vitest):
   - Movement record creation
   - Balance aggregation logic
   - Validation rules

2. **Integration Tests** (Backend Vitest):
   - End-to-end API flows
   - Authorization checks
   - DB constraints

3. **E2E Tests** (Frontend Playwright):
   - Full user workflows (happy + error paths)
   - UI interactions
   - Cross-browser compatibility (Chrome, Firefox, Safari)

4. **Manual QA**:
   - Real barcode scanning hardware
   - Mobile device testing (if applicable)
   - User acceptance with family team

---

## Definition of Done

- [ ] All TC happy paths pass (TC-001 through TC-017)
- [ ] All TC error paths validated (TC-E001 through TC-E010)
- [ ] No blocking bugs logged
- [ ] Performance benchmarks met
- [ ] Accessibility audit passed
- [ ] Security review completed
- [ ] User documented in README

### user
