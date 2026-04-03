---
title: "[CONTRACT] Data Export (CSV)"
lane: todo
created: 2026-04-01
updated: 2026-04-01
description: Define API endpoints and contracts for exporting inventory and movement data
parent: task_20260401_dfd0_warehouse.md
---

## Conversation

### user

Define the contract boundaries for data export flow.

### agent

## [CONTRACT] Data Export (CSV)

Referenced from: [DFD-0] Warehouse Inventory System Data Flow

### User Stories Covered

- **Export inventory data (Owner)**: Download current snapshot as CSV
- **Export movement history (Owner)**: Download audit log as CSV

---

## DB Schema Requirements

No new schema; uses existing movements and inventory_balances (derived).

---

## API Boundary

### Endpoints

#### `GET /api/exports/inventory`

**Purpose**: Export current inventory snapshot as CSV

**Query params** (optional):

```typescript
{
  warehouse_id?: string  // Filter to specific warehouse
  format: 'csv'          // Currently only CSV supported
}
```

**Response (200)**:

- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename="inventory_<timestamp>.csv"`

**CSV format**:

```
Item ID,Item Name,Warehouse,Bin,Quantity,Last Updated
item-123,Widget A,Warehouse A,,42,2026-04-01T10:30:00Z
item-456,Gadget B,Warehouse B,Shelf-A,15,2026-03-31T15:22:00Z
...
```

**Authorization**: Owner role only

---

#### `GET /api/exports/movements`

**Purpose**: Export movement history as CSV

**Query params** (optional):

```typescript
{
  item_id?: string              // Filter to specific item
  warehouse_id?: string         // Filter to specific warehouse
  date_from?: ISO8601 string    // e.g., "2026-03-01"
  date_to?: ISO8601 string      // e.g., "2026-03-31"
  format: 'csv'                 // Currently only CSV
}
```

**Response (200)**:

- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename="movements_<timestamp>.csv"`

**CSV format**:

```
Movement ID,Timestamp,Type,Item ID,Item Name,User,Qty,Source Warehouse,Source Bin,Dest Warehouse,Dest Bin,Note
mvmt-1001,2026-04-01T10:30:00Z,ADD,item-123,Widget A,john@family.local,50,Warehouse A,,,,Receiving order #123
mvmt-1002,2026-04-01T11:15:00Z,REMOVE,item-456,Gadget B,jane@family.local,5,Warehouse B,Shelf-A,,,,Customer refund
mvmt-1003,2026-04-01T12:00:00Z,TRANSFER,item-123,Widget A,john@family.local,10,Warehouse A,,Warehouse B,Shelf-C,Replenishment
...
```

**Authorization**: Owner role only

---

## UI Boundary

### Component: `DataExportPanel`

**Purpose**: Provide download buttons and filter options for exports

**Props**:

```typescript
{
  warehouse_id?: string
  item_id?: string
}
```

**Features**:

- Button: "Download Inventory Snapshot (CSV)"
- Button: "Download Movement History (CSV)"
- Filter options:
  - Warehouse (dropdown)
  - Item (search/select)
  - Date range (from/to pickers)
- Status: "Preparing export..." during download

**User flow**:

1. Owner navigates to Admin > Data Export
2. Optionally selects filters
3. Clicks "Download Inventory" or "Download Movements"
4. Browser downloads CSV file

---

## TanStack Query Hooks

### `useExportInventory(filters?)`

Mutation hook for triggering inventory export

```typescript
{
  mutate: (filters?: ExportFilters) => void
  isPending: boolean
  data?: Blob  // CSV file blob
  error?: Error
}
```

### `useExportMovements(filters?)`

Mutation hook for triggering movements export

```typescript
{
  mutate: (filters?: ExportFilters) => void
  isPending: boolean
  data?: Blob  // CSV file blob
  error?: Error
}
```

---

## Definition of Done

- [ ] `GET /api/exports/inventory` endpoint implemented
- [ ] `GET /api/exports/movements` endpoint implemented
- [ ] CSV generation logic (e.g., papaparse or native CSV builder)
- [ ] Proper CSV content headers & escaping for special chars
- [ ] Authorization: Owner role only
- [ ] Optional filters: warehouse_id, item_id, date_from, date_to
- [ ] Frontend queries generated
- [ ] `DataExportPanel` component built with filter UI
- [ ] Download functionality (trigger blob download in browser)
- [ ] `useExportInventory()` and `useExportMovements()` hooks created

### user
