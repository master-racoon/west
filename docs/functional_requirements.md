# Lightweight Functional Map — Object-Oriented Pages

This document organizes user stories by stable domain objects/pages (not 1 story = 1 page).  
Source stories: [docs/user_stories.md](user_stories.md)

---

## 1) Authentication & App Shell

**Purpose**: Secure entry and consistent navigation frame.

**Stories mapped**:

- US-0.1 Access Password-Protected App Shell with Domain Side Menu

**Pages**:

- `LoginPage`
- `AppLayout` (protected)

**Core components**:

- `ProtectedRouteGuard`
- `SideMenu`
- `UserMenu`
- `LogoutAction`

---

## 2) Warehouses Page (Object: Warehouse)

**Purpose**: Manage warehouse definitions and bin mode.

**Stories mapped**:

- US-1.1 Define Warehouse with Bin Mode

**Page scope**:

- List warehouses
- Create/edit warehouse
- Toggle `use_bins`

**Core components**:

- `WarehouseTable`
- `WarehouseForm`
- `UseBinsToggle`

---

## 3) Items Page (Object: Item)

**Purpose**: Manage item master data and barcode mappings.

**Stories mapped**:

- US-1.2 Create and Manage Items with Barcodes
- US-2.2 Create Item On-the-Fly During Scan (reuses item form inline)

**Page scope**:

- List/search items
- Create/edit item
- Add/remove barcodes

**Core components**:

- `ItemTable`
- `ItemForm`
- `BarcodeEditor`
- `ItemQuickCreateDialog`

---

## 4) Bins Page (Object: Bin)

**Purpose**: Manage storage bins per warehouse where enabled.

**Stories mapped**:

- US-1.3 Create and Manage Bins (Conditional)

**Page scope**:

- Select warehouse
- List/create/edit bins
- Enforce `use_bins = true`

**Core components**:

- `WarehouseFilter`
- `BinTable`
- `BinForm`
- `BinsEnabledGuard`

---

## 5) Inventory Page (Object: Inventory Balance)

**Purpose**: Daily operations in one place, organized as action tabs.

**Stories mapped**:

- US-2.1 Scan and Add Stock to Warehouse
- US-3.1 Scan and Remove Stock from Warehouse
- US-3.2 Warn Owner of Stock Shortfall
- US-4.1 Transfer Stock Between Warehouses
- US-5.1 Quick Count Items and Reconcile Inventory

**Page scope**:

- `Add` tab
- `Remove` tab
- `Transfer` tab
- `Quick Count` tab

**Core components**:

- `InventoryActionTabs`
- `WarehouseSelector`
- `BinSelector`
- `BarcodeInput`
- `QuantityInput`
- `StockAvailabilityPanel`
- `OwnerOverridePrompt`
- `DeltaPreview`

---

## 6) Inventory Explorer Page (Object: Item + Balance View)

**Purpose**: Read current stock by item and location.

**Stories mapped**:

- US-6.1 View Inventory Level and Location
- US-6.3 Find Item Location by Bin

**Page scope**:

- Search item
- Show per-warehouse/bin balances
- Show item location breakdown

**Core components**:

- `InventorySearchBar`
- `ItemSummaryCard`
- `BalanceByLocationTable`
- `LocationBreakdownPanel`

---

## 7) Movements Page (Object: Movement Log)

**Purpose**: Audit and explain inventory changes.

**Stories mapped**:

- US-6.2 View Movement History for Item

**Page scope**:

- Filter by item/date/type/location/user
- Show chronological movement log

**Core components**:

- `MovementFilters`
- `MovementHistoryTable`
- `MovementTypeBadge`

---

## 8) Users & Roles Page (Object: User)

**Purpose**: Owner management of access and permissions.

**Stories mapped**:

- Role and permission requirements from user story appendix

**Page scope**:

- List users
- Assign role (`Owner` or `User`)
- Restrict owner-only actions

**Core components**:

- `UserTable`
- `RoleSelector`
- `RoleGate`

---

## 9) Exports Page (Object: Export Job)

**Purpose**: Owner export of current inventory and movement history.

**Stories mapped**:

- Data export requirements from user story appendix

**Page scope**:

- Export inventory CSV
- Export movements CSV

**Core components**:

- `ExportPanel`
- `ExportTypeSelector`
- `DownloadButton`

---

## 10) Shared Building Blocks

**Reusable components**:

- `PageHeader`
- `FormSection`
- `LoadingState`
- `ErrorState`
- `EmptyState`
- `ConfirmActionDialog`
- `ToastFeedback`

---

## 11) Minimal Delivery Sequence

1. Authentication & App Shell
2. Warehouses + Items + Bins (master data)
3. Inventory Page (Add/Remove/Transfer/Quick Count tabs)
4. Inventory Explorer + Movements
5. Users & Roles + Exports
