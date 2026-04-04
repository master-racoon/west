
## DFD-0: Warehouse Inventory System

### External Entities

1. **Family Team Users** (Operators)
   - Perform inventory operations: add, remove, transfer, count
   - Interact via barcode scanner + web UI
2. **Owner** (Administrator)
   - Configures warehouses, bins, items, users
   - Manages settings and overrides
   - Exports data

3. **Barcode Scanner** (Hardware)
   - Transmits barcode data to UI

### System Boundary

The system is a barcode-driven inventory web app with:

- **Backend (Hono API)**: REST endpoints, authorization, DB persistence
- **Frontend (React SPA)**: Scanning interface, forms, inventory views
- **Database (Postgres)**: Source of truth for all inventory state

### Level-0 Data Flows

**Note**: Read operations (querying inventory, viewing history) are implementation details owned by devs. CONTRACT defines mutations only.

**Flow Labels**: Each flow maps to Kanban task labels for filtering and organization. See [Flow-to-Task Label Mapping](#flow-to-task-label-mapping) at the end of this document.

#### **Flow 1: Add Stock (Receiving)** `#flow-1-add-stock`

```
User → [Select warehouse] → [Scan barcode] → [If unknown: create item] → [Qty] → [Optional: select bin] → Confirm
                                                                                  ↓
                                                          Backend validates & creates ADD movement
                                                                  ↓
                                                          Database updates balance
                                                                  ↓
                                           Frontend confirms "X qty added to Warehouse A Bin B"
```

**Data in:**

- Warehouse ID
- Barcode or Item ID
- Quantity (int > 0)
- Bin ID (if use_bins=true)
- Optional: new item metadata (name, description) if creating item

**Data out:**

- Movement record created (ADD type)
- Updated inventory balance

---

#### **Flow 2: Remove Stock (Consumption/Sale)** `#flow-2-remove-stock`

```
User → [Select warehouse] → [Scan item] → [Qty] → [If use_bins: select bin] → Confirm
                                                  ↓
                                   Backend validates sufficient stock
                                   (if not: warn owner, allow override)
                                   ↓
                                   Creates REMOVE movement
                                   ↓
                             Database updates balance (may go negative if owner overrides)
                                   ↓
                              Frontend confirms removal
```

**Data in:**

- Warehouse ID
- Item ID / Barcode
- Quantity to remove
- Bin ID (if applicable)
- Owner override flag (optional)

**Data out:**

- Movement record (REMOVE type)
- Updated balance
- Warning if insufficient stock (for owner to decide)

---

#### **Flow 3: Transfer Stock (Between Warehouses/Bins)** `#flow-3-transfer-stock`

```
User → [Scan item] → [Qty] → [Select source warehouse/bin] → [Select destination warehouse/bin] → Confirm
                                                                    ↓
                                                    Backend creates TRANSFER movement
                                                    ↓
                                            Updates both source & destination
                                                    ↓
                                           Frontend confirms "X moved from A→B"
```

**Data in:**

- Item ID
- Quantity
- Source warehouse/bin
- Destination warehouse/bin

**Data out:**

- TRANSFER movement record
- Updated source inventory (decreases)
- Updated destination inventory (increases)

---

#### **Flow 4: Quick Count (Physical Count Adjustment)** `#flow-4-quick-count`

```
User → [Select warehouse/bin] → [Scan item] → [Enter observed quantity] → Confirm
                                                        ↓
                                    Backend computes delta (observed vs. recorded)
                                                        ↓
                                    Creates COUNT_ADJUSTMENT movement
                                                        ↓
                                        Database reconciles balance
                                                        ↓
                                    Frontend shows adjustment details
```

**Data in:**

- Warehouse/Bin ID
- Item ID
- Observed quantity (int)

**Data out:**

- COUNT_ADJUSTMENT movement (delta recorded)
- Updated balance
- Summary: "was 50, now 47" or similar

---

#### **Flow 5: Configuration Management (Owner)** `#flow-5-configuration`

```
Owner → [Create/update warehouse (use_bins: T/F)] → Backend validates & persists → Database
        [Create/update items & barcodes]
        [Create/update bins]
                                                        ↓
                                        Frontend reflects changes in UI
```

**Data in:**

- Warehouse config (name, use_bins flag)
- Item definitions (name, description, new barcodes)
- Bin definitions (name)

**Data out:**

- Updated warehouse/item/bin records
- Cascading effects on inventory constraints

---

### Core Data Entities (DDD Aggregates)

1. **Warehouse**
   - id, name, use_bins (boolean)
   - Contains items, bins, movements

2. **Item (SKU)**
   - id, name, description
   - Multiple barcodes → same item
   - Can be created ad-hoc during scanning

3. **Bin** (optional, per warehouse)
   - id, warehouse_id, name
   - Only present if warehouse.use_bins = true

4. **Inventory Balance** (computed view)
   - Quantity at (warehouse, bin?, item)
   - Derived from movements (append-only log)

5. **Movement** (immutable log)
   - id, timestamp, user, type (ADD|REMOVE|TRANSFER|COUNT_ADJUSTMENT|MANUAL_ADJUSTMENT)
   - Item, source/dest warehouse/bin
   - Quantity, note
   - Append-only; queries aggregate to compute balance

6. **User**
   - id, role (Owner | User)
   - Session/auth via BetterAuth

---

### Cross-Cutting Concerns

- **Authorization**: Role-based (Owner: config + override; User: operations only)
- **Validation**: No negative inventory except owner override; barcode uniqueness; warehouse/bin existence; quantity > 0
- **Idempotency**: Movements must prevent duplicates from re-scanning (implementation detail: devs choose strategy—microtime, request signature, or other)
- **Audit Trail**: Every movement is immutable; historical record never deleted or modified

---

### Flow-to-Task Label Mapping

Use these labels to filter Kanban tasks by DFD flow:

| Flow | Label | Tasks |
|------|-------|-------|
| Inventory Visibility (Read) | `inventory-visibility` | Search/Scan Item, View Location, View Movement History |
| Flow 1: Add Stock | `flow-1-add-stock` | Scan & Add Quantity, Register New Item |
| Flow 2: Remove Stock | `flow-2-remove-stock` | Scan & Remove Quantity, Prevent Negative |
| Flow 3: Transfer Stock | `flow-3-transfer-stock` | Between Warehouses, With Optional Bins |
| Flow 4: Quick Count | `flow-4-quick-count` | Physical Count Adjustment |
| Flow 5: Configuration | `flow-5-configuration` | Warehouse Settings, Manage Items/Barcodes, Export Data |

---

## Definition of Done

- [x] Identified external entities (Family Users, Owner, Barcode Scanner)
- [x] Mapped 5 primary mutation flows (add → remove → transfer → count → configure)
- [x] Identified core data entities and aggregates
- [x] Identified system boundaries (Backend, Frontend, Database)
- [x] Cross-cutting concerns documented
- [x] Read operations (visibility, search, export) scoped as implementation details (devs own)
