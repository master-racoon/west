# User Stories — Warehouse Inventory System

A barcode-driven inventory web app for a small family team to track items across warehouses. The system records every movement of stock, can track exactly which shelf or bin something is in, and is designed to be fast to use with a barcode scanner.

**Technical reference**: See [docs/dfd_level0.md](dfd_level0.md) for system data flows and [docs/functional_requirements.md](functional_requirements.md) for consolidated functional requirements.

---

## Story Groups

Stories are ordered by how they depend on each other — you need to set up warehouses and items before you can move stock around.

1. **Access & Login** — get into the app securely
2. **Setup** — define warehouses, items, bins, and team members
3. **Add Stock** — record items arriving at a warehouse
4. **Remove Stock** — record items leaving a warehouse
5. **Transfer Stock** — move items between warehouses
6. **Quick Count** — correct inventory after a physical count
7. **Inventory Visibility** — look up where things are and what happened to them

---

## Group 0: Access & Login

### US-0.1: Sign In to the App

**Who**: Everyone (Owner, Family User)

**Story**: As a user, I want to sign in with a PIN so that only our team can access the inventory system.

**Acceptance Criteria**:

- Anyone who is not signed in is taken to the login page automatically
- Signed-in users see a layout with a side menu linking to every section of the app
- The side menu includes: Setup, Add Stock, Remove Stock, Transfer Stock, Quick Count, and Inventory
- Signing into a section takes you to the right page
- A sign-out option is always visible

---

## Group 1: Setup

### US-1.1: Create a Warehouse

**Who**: Owner

**Story**: As an owner, I want to create warehouses and decide whether they use storage bins, so the system matches how the physical space is organized.

**Acceptance Criteria**:

- Owner can create a warehouse with a name
- Owner can choose whether the warehouse tracks items by bin/shelf or just by warehouse overall
- If bins are enabled, all stock movements for that warehouse will require a bin to be selected
- The warehouse appears in all relevant dropdowns across the app

---

### US-1.2: Create and Manage Products

**Who**: Owner

**Story**: As an owner, I want to add products and assign barcodes to them, so the team can scan items rather than type them in manually.

**Acceptance Criteria**:

- Owner can create a product with a name and an optional description
- Owner can assign one or more barcodes to the same product
- A barcode can only belong to one product
- Products and barcodes can be updated after creation

---

### US-1.3: Bulk Import Products from a Spreadsheet

**Who**: Owner

**Story**: As an owner, I want to upload a CSV file of products, so I can get started quickly without entering hundreds of items one by one.

**Acceptance Criteria**:

- Owner can download a template CSV showing the expected format
- Owner uploads a filled-in CSV
- The system imports valid rows and skips rows with errors
- A summary shows how many rows were imported, skipped, and why any were skipped

---

### US-1.4: Create and Manage Bins

**Who**: Owner

**Story**: As an owner, I want to define the bins or shelves inside a warehouse, so the team can record exactly where stock is stored.

**Acceptance Criteria**:

- Bins can only be added to a warehouse that has bins enabled
- Each bin has a name (e.g. "Shelf A", "Row 3")
- Bins appear as selectable options during stock operations

---

### US-1.5: Manage Team Members

**Who**: Owner

**Story**: As an owner, I want to create accounts for family members with a PIN, so each person can sign in and I can see who made each change.

**Acceptance Criteria**:

- Owner can create a new user with a name and a PIN
- Owner can reset a user's PIN if they forget it
- Owner can unlock an account that has been locked after too many wrong PIN attempts
- Owner can remove a user from the system
- Non-owners cannot access the user management page

---

## Group 2: Add Stock (Receiving)

### US-2.1: Add Stock by Scanning a Barcode

**Who**: Family User

**Story**: As a user, I want to scan an item barcode and record how many arrived, so inventory is updated the moment stock comes in.

**Acceptance Criteria**:

- User selects a warehouse
- User scans a barcode or searches for an item by name
- If the item is known, it is selected automatically
- If the barcode is not recognised, the user is prompted to create a new product
- User enters the quantity arriving (must be at least 1)
- If the warehouse uses bins, the user must select a bin
- Confirming records the addition and shows the updated stock level

---

### US-2.2: Create a New Product While Scanning

**Who**: Family User

**Story**: As a user, I want to create a new product on the spot when I scan an unknown barcode, so I can keep working without switching to a different screen.

**Acceptance Criteria**:

- When a scanned barcode matches no existing product, a prompt appears inline
- User enters a product name (required) and optional description
- The new product is saved with the scanned barcode attached
- The user can then continue the stock addition without restarting

---

## Group 3: Remove Stock (Consumption)

### US-3.1: Remove Stock by Scanning a Barcode

**Who**: Family User

**Story**: As a user, I want to scan an item and record how many were taken out, so inventory reflects what has been sold or used.

**Acceptance Criteria**:

- User selects a warehouse
- User scans or searches for an item
- User enters the quantity to remove (must be at least 1)
- If the warehouse uses bins, the user must select a bin
- If there is enough stock, the removal is recorded immediately
- If there is not enough stock, the user sees a warning and the removal is paused for owner approval

---

### US-3.2: Owner Approves a Stock Shortfall

**Who**: Owner

**Story**: As an owner, I want to review and approve removals that would take stock below zero, so I can catch mistakes while still allowing legitimate exceptions.

**Acceptance Criteria**:

- When a removal would result in negative stock, the app shows a clear warning with the item name, warehouse, and how short we are
- The owner can approve or reject the removal
- If approved, the removal is recorded with a note that it was owner-approved
- If rejected, nothing changes in the inventory
- The decision is recorded in the movement history

---

## Group 4: Transfer Stock

### US-4.1: Transfer Stock Between Warehouses

**Who**: Family User

**Story**: As a user, I want to move items from one warehouse to another, so the records reflect where stock has physically moved to.

**Acceptance Criteria**:

- User scans or searches for an item
- User enters the quantity to move (must be at least 1)
- User selects a source warehouse and a destination warehouse
- If the source warehouse uses bins, user selects the source bin
- If the destination warehouse uses bins, user selects the destination bin
- The system checks there is enough stock at the source before allowing the transfer
- Confirming reduces the source balance and increases the destination balance

---

## Group 5: Quick Count (Stocktake)

### US-5.1: Correct Stock Levels After a Physical Count

**Who**: Family User

**Story**: As a user, I want to scan an item, enter the quantity I can actually see on the shelf, and have the system update the record, so discrepancies are fixed quickly.

**Acceptance Criteria**:

- User selects a warehouse (and a bin if applicable)
- User scans or searches for an item
- User enters the physical count they observed (can be zero)
- The system shows the current recorded balance alongside the entered count
- Confirming updates the balance to the entered count and records the difference
- The change log shows the previous quantity, the new quantity, and the difference

---

## Group 6: Inventory Visibility

### US-6.1: Look Up Current Stock Levels

**Who**: Owner, Family User

**Story**: As a user, I want to search for an item and instantly see how much is in stock and where it is, so I can answer questions without manually checking.

**Acceptance Criteria**:

- User can search by barcode, product name, or browse the product list
- Results show the product name, description, and all associated barcodes
- Stock levels are shown broken down by warehouse (and by bin, if bins are enabled)
- Locations with zero stock are not shown

---

### US-6.2: View the Movement History for an Item

**Who**: Owner, Family User

**Story**: As a user, I want to see a chronological log of every stock movement for an item, so I can understand why the balance changed.

**Acceptance Criteria**:

- The item detail page shows a list of all movements, newest first
- Each entry shows: what type of movement it was (received, removed, transferred, counted, adjusted), the quantity, who did it, which warehouse and bin were involved, and when
- Movement types are shown in plain language, not codes

---

### US-6.3: See Where an Item Is Stored

**Who**: Owner, Family User

**Story**: As a user, I want to see a list of every location where an item currently has stock, so I know exactly where to find it in the warehouse.

**Acceptance Criteria**:

- The item detail page lists every warehouse and bin where the item has stock greater than zero
- The quantity at each location is shown
- If an item is in multiple locations, all are listed

---

### US-6.4: Bulk Import Starting Balances from a Spreadsheet

**Who**: Owner

**Story**: As an owner, I want to upload a CSV with existing stock quantities, so I can seed the system with real balances when first setting it up.

**Acceptance Criteria**:

- Owner can download a template CSV with the expected columns
- Owner uploads a filled-in CSV with item SKU, warehouse name, optional bin name, and quantity
- Valid rows create stock balance records; invalid rows are skipped with a reason given
- A summary shows how many rows were processed, skipped, and why any failed
