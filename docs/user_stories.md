# User Stories — Warehouse Inventory System

A barcode-driven inventory web app for a small family team to track items across warehouses. The system records every movement of stock, optionally tracks bins/shelves, and keeps the interface optimized for fast scanning workflows.

**DFD Reference**: See [docs/dfd_level0.md](dfd_level0.md) for data flows and boundary contracts.

---

## Phase 0: Dependency Ordering

The user stories are sorted by **DFD flow sequence**. Foundational operations must precede dependent ones:

1. **Configuration Management** (`#flow-5-configuration`) — Owner must define warehouses, items, bins
2. **Add Stock** (`#flow-1-add-stock`) — Receive inventory first
3. **Remove Stock** (`#flow-2-remove-stock`) — Consume from existing inventory
4. **Transfer Stock** (`#flow-3-transfer-stock`) — Move between locations
5. **Quick Count** (`#flow-4-quick-count`) — Reconcile discrepancies

---

## User Stories by DFD Flow

### Group 1: Configuration Management `#flow-5-configuration`

#### US-1.1: Define Warehouse with Bin Mode

**DFD Flow**: [#flow-5-configuration](dfd_level0.md#flow-5-configuration)

**Role**: Owner

**Story**: As an owner, I want to define whether a warehouse uses bins or not, so the system matches how the space is organized.

**Acceptance Criteria**:

- Owner can create a warehouse with `name` and `use_bins` flag (boolean)
- Data contract validation (from dfd_level0.md):
  - `name`: required, string, 1-100 chars
  - `use_bins`: boolean flag
- When `use_bins = true`, bins become required for all inventory operations
- When `use_bins = false`, inventory is stored at warehouse level only
- Changes to `use_bins` persist in database

**Related Data Entities** (from dfd_level0.md):

- Warehouse aggregate: `id`, `name`, `use_bins`

---

#### US-1.2: Create and Manage Items with Barcodes

**DFD Flow**: [#flow-5-configuration](dfd_level0.md#flow-5-configuration)

**Role**: Owner

**Story**: As an owner, I want to manage items and assign barcodes, so the system reflects the real inventory.

**Acceptance Criteria**:

- Owner can create item with `name` and optional `description`
- Owner can assign/update multiple barcodes to the same item (barcode canary pattern)
- Data contract validation:
  - `name`: required, string, 1-200 chars
  - `description`: optional, string
  - `barcode`: must be unique per item, alphanumeric
- Item creation persists to database
- Multiple barcodes map to single item

**Related Data Entities**:

- Item (SKU) aggregate: `id`, `name`, `description`, barcodes array

---

#### US-1.3: Create and Manage Bins (Conditional)

**DFD Flow**: [#flow-5-configuration](dfd_level0.md#flow-5-configuration)

**Role**: Owner

**Story**: As an owner, I want to create bins/shelves in a warehouse, so I can organize storage locations.

**Acceptance Criteria**:

- Owner can create bins only if warehouse `use_bins = true`
- Bin creation requires `warehouse_id` and `name`
- Data contract validation:
  - `name`: required, string, 1-100 chars
- Bins appear in UI dropdowns during inventory operations

**Related Data Entities**:

- Bin aggregate: `id`, `warehouse_id`, `name`

---

### Group 2: Add Stock (Receiving) `#flow-1-add-stock`

#### US-2.1: Scan and Add Stock to Warehouse

**DFD Flow**: [#flow-1-add-stock](dfd_level0.md#flow-1-add-stock)

**Role**: Family User

**Story**: As a user, I want to scan an item barcode, enter quantity, and add it to a warehouse, so inventory stays accurate when items arrive.

**Acceptance Criteria**:

- User selects warehouse
- User scans barcode (or enters item ID manually)
- System finds existing item or prompts to create
- User enters quantity (int > 0)
- If warehouse `use_bins = true`, user selects/creates bin
- Confirm creates ADD movement and updates balance
- Data contract (from dfd_level0.md):
  - Request: `{ warehouse_id: UUID, barcode_or_item_id: string, quantity: int (>0), bin_id?: UUID }`
  - Response: `{ movement_id: UUID, item_id: UUID, warehouse_id: UUID, bin_id?: UUID, quantity: int, balance_after: int }`

**Related Data Entities**:

- Movement: type=ADD, timestamp, user, item, warehouse, bin (optional), quantity
- Inventory Balance: updated

---

#### US-2.2: Create Item On-the-Fly During Scan

**DFD Flow**: [#flow-1-add-stock](dfd_level0.md#flow-1-add-stock)

**Role**: Family User

**Story**: As a user, I want to create a new item when scanning an unknown barcode, so onboarding new products is fast.

**Acceptance Criteria**:

- If scan matches no existing item, UI prompts for item details
- User enters `name` (required), optional `description`
- New barcode is appended to created item
- Item is persisted; user can continue add-stock flow
- Data contract:
  - Request: `{ barcode: string, name: string (1-200), description?: string }`
  - Response: `{ item_id: UUID, name, description?, barcode }`

---

### Group 3: Remove Stock (Consumption) `#flow-2-remove-stock`

#### US-3.1: Scan and Remove Stock from Warehouse

**DFD Flow**: [#flow-2-remove-stock](dfd_level0.md#flow-2-remove-stock)

**Role**: Family User

**Story**: As a user, I want to scan an item and remove quantity, so inventory reflects items sold or consumed.

**Acceptance Criteria**:

- User selects warehouse
- User scans item
- User enters quantity to remove (int > 0)
- If warehouse `use_bins = true`, user selects bin
- System validates sufficient stock in (warehouse, bin?, item)
- If insufficient stock detected, system warns user and notifies owner
- If owner approves override, REMOVE movement is created with negative balance allowed
- Otherwise, removal is blocked
- Data contract (from dfd_level0.md):
  - Request: `{ warehouse_id: UUID, item_id: UUID, quantity: int (>0), bin_id?: UUID, owner_override?: boolean }`
  - Response (success): `{ movement_id: UUID, quantity_removed: int, balance_after: int }`
  - Response (insufficient): `{ warning: string, owner_approval_required: boolean }`

---

#### US-3.2: Warn Owner of Stock Shortfall

**DFD Flow**: [#flow-2-remove-stock](dfd_level0.md#flow-2-remove-stock) (warning path)

**Role**: Owner

**Story**: As an owner, I want the system to alert when removal would cause negative stock, so mistakes are prevented.

**Acceptance Criteria**:

- When removal quantity > available balance, system computes delta
- Owner receives notification (UI alert or log entry) with item, warehouse, and shortfall amount
- Owner can approve override or reject removal
- If approved, REMOVE movement includes `override_by_owner` flag
- Audit trail records owner decision

---

### Group 4: Transfer Stock `#flow-3-transfer-stock`

#### US-4.1: Transfer Stock Between Warehouses

**DFD Flow**: [#flow-3-transfer-stock](dfd_level0.md#flow-3-transfer-stock)

**Role**: Family User

**Story**: As a user, I want to transfer items between warehouses, so inventory location stays correct.

**Acceptance Criteria**:

- User scans item
- User enters quantity
- User selects source warehouse
- User selects destination warehouse
- If source warehouse `use_bins = true`, user selects source bin
- If destination warehouse `use_bins = true`, user selects destination bin
- System validates sufficient stock in source
- Confirm creates TRANSFER movement
- Source balance decreases, destination balance increases
- Data contract (from dfd_level0.md):
  - Request: `{ item_id: UUID, quantity: int (>0), source_warehouse_id: UUID, dest_warehouse_id: UUID, source_bin_id?: UUID, dest_bin_id?: UUID }`
  - Response: `{ movement_id: UUID, item_id: UUID, quantity: int, source_warehouse_id: UUID, dest_warehouse_id: UUID, source_balance_after: int, dest_balance_after: int }`

---

### Group 5: Quick Count (Reconciliation) `#flow-4-quick-count`

#### US-5.1: Quick Count Items and Reconcile Inventory

**DFD Flow**: [#flow-4-quick-count](dfd_level0.md#flow-4-quick-count)

**Role**: Family User

**Story**: As a user, I want to quickly count items on a shelf and update inventory, so discrepancies are corrected easily.

**Acceptance Criteria**:

- User selects warehouse
- If warehouse `use_bins = true`, user selects bin
- User scans item
- User enters observed quantity (int ≥ 0)
- System computes delta = observed - recorded_balance
- System creates COUNT_ADJUSTMENT movement with delta
- System updates balance to observed quantity
- UI displays adjustment details: "was X, now Y (delta: ±Z)"
- Data contract (from dfd_level0.md):
  - Request: `{ warehouse_id: UUID, bin_id?: UUID, item_id: UUID, observed_quantity: int (≥0) }`
  - Response: `{ movement_id: UUID, item_id: UUID, previous_balance: int, new_balance: int, delta: int, movement_type: 'COUNT_ADJUSTMENT' }`

---

### Group 6: Inventory Visibility (Read Operations)

#### US-6.1: View Inventory Level and Location

**Role**: Owner, Family User

**Story**: As a user, I want to search or scan an item and see current inventory across warehouses and bins, so I know stock availability immediately.

**Acceptance Criteria**:

- User can search by barcode, item name, or item ID
- System returns item details: name, description, barcodes
- Inventory display aggregates movement log to show current balance by (warehouse, bin?, item)
- If warehouse `use_bins = true`, balance shows per-bin breakdown
- If warehouse `use_bins = false`, balance shows warehouse-level total

---

#### US-6.2: View Movement History for Item

**Role**: Owner, Family User

**Story**: As a user, I want to see the history of movements for an item, so I understand why inventory changed.

**Acceptance Criteria**:

- Item detail page displays timestamp-sorted movement log
- Each movement shows: type, quantity, user, warehouse, bin (if applicable), timestamp
- Movement types displayed clearly: ADD, REMOVE, TRANSFER, COUNT_ADJUSTMENT, MANUAL_ADJUSTMENT

---

#### US-6.3: Find Item Location by Bin (if bins enabled)

**Role**: Owner, Family User

**Story**: As a user, I want to know where an item is stored (bins if applicable), so I can find it quickly.

**Acceptance Criteria**:

- Item detail page displays (warehouse, bin) location(s) where balance > 0
- If multiple locations, show balance per location
- Quick action to navigate to physical location (if warehouse UI supports it)

---

## Data Contract Summary (from dfd_level0.md)

Each user story with a DFD flow reference includes boundary data contracts specifying request/response schemas, validation rules, and constraints. During Phase 2 task creation, these contracts map to API endpoint schemas in route files (e.g., `warehouse-backend/src/routes/`).

---

## Kanban Task Mapping

Each user story (or group of closely related stories) becomes a **Phase 2 `/[DEV] <User Story>`** Kanban task referencing:

1. DFD flow number and section link
2. Boundary data contract for request/response validation
3. Vertical slice assignment (DB → API route → UI component)
4. Testing requirements (happy path, error paths, edge cases)

movement history

2.11 User roles
Two roles exist.
Owner
Can:
change settings

override negative inventory

manage items/bins/users

User
Can:
add

remove

transfer

count

2.12 Data export
Owner can export:
current inventory

movement history

Formats:
CSV
