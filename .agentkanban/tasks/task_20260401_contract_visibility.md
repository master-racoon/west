---
title: "[CONTRACT] Inventory Visibility (Search/View)"
lane: todo
created: 2026-04-01
updated: 2026-04-01
description: Define DB schema, API endpoints, and UI contracts for inventory search and viewing
parent: task_20260401_dfd0_warehouse.md
---

## Conversation

### user

Define the contract boundaries for inventory visibility flow.

### agent

## [CONTRACT] Inventory Visibility (Search/View)

Referenced from: [DFD-0] Warehouse Inventory System Data Flow

### User Stories Covered

- **Inventory visibility (Owner)**: Search/scan an item, see quantities per warehouse
- **Where is it stored (Owner)**: See bins for each item
- **Movement history (Owner)**: View audit trail of all movements for an item

---

## DB Schema Requirements

### Tables (Drizzle)

```typescript
// warehouse-backend/src/db/schema.ts

// Existing or extend:
warehouses: {
  id: string (PK),
  name: string,
  use_bins: boolean,
  created_at: timestamp
}

items: {
  id: string (PK),
  name: string,
  description?: string,
  created_at: timestamp
}

item_barcodes: {
  id: string (PK),
  item_id: string (FK → items),
  barcode: string (UNIQUE),
  created_at: timestamp
}

bins: {
  id: string (PK),
  warehouse_id: string (FK → warehouses),
  name: string,
  created_at: timestamp
}

movements: {
  id: string (PK),
  type: enum('ADD', 'REMOVE', 'TRANSFER', 'COUNT_ADJUSTMENT', 'MANUAL_ADJUSTMENT'),
  item_id: string (FK → items),
  user_id: string (FK → users),
  source_warehouse_id?: string (FK → warehouses),
  source_bin_id?: string (FK → bins),
  dest_warehouse_id?: string (FK → warehouses),
  dest_bin_id?: string (FK → bins),
  quantity: integer,
  note?: string,
  created_at: timestamp,
  UNIQUE(user_id, created_at, item_id, source_warehouse_id, source_bin_id)
}

// Derived view or materialized view:
inventory_balances: {
  item_id: string,
  warehouse_id: string,
  bin_id?: string,
  quantity: integer
  // Computed from movements with SUM(quantity)
}
```

---

## API Boundary

### Endpoints

#### `GET /api/items/search`

**Purpose**: Find item by barcode or name

**Request**:

```typescript
Query params:
{
  q: string         // Barcode or item name (min 1 char)
  warehouse_id?: string  // Optional: filter to specific warehouse
}
```

**Response (200)**:

```typescript
{
  items: Array<{
    id: string;
    name: string;
    description?: string;
    barcodes: string[];
  }>;
}
```

**Response (400)**: Query too short or invalid

---

#### `GET /api/items/:itemId`

**Purpose**: Get full item details including inventory & history

**Path params**:

```typescript
{
  itemId: string;
}
```

**Response (200)**:

```typescript
{
  id: string
  name: string
  description?: string
  barcodes: string[]
  inventory: Array<{
    warehouse_id: string
    warehouse_name: string
    bin_id?: string
    bin_name?: string
    quantity: integer
  }>
  movements: Array<{
    id: string
    type: 'ADD' | 'REMOVE' | 'TRANSFER' | 'COUNT_ADJUSTMENT' | 'MANUAL_ADJUSTMENT'
    quantity: integer
    source_warehouse?: string
    source_bin?: string
    dest_warehouse?: string
    dest_bin?: string
    user_id: string
    note?: string
    created_at: ISO8601
  }>
}
```

**Response (404)**: Item not found

**Authorization**: Any authenticated user (User or Owner)

---

#### `GET /api/warehouses/:warehouseId/inventory`

**Purpose**: Get all items & quantities in a warehouse (optionally filtered by bin)

**Path params**:

```typescript
{
  warehouseId: string;
}
```

**Query params**:

```typescript
{
  bin_id?: string  // Optional: filter to specific bin
}
```

**Response (200)**:

```typescript
{
  warehouse_id: string;
  warehouse_name: string;
  use_bins: boolean;
  inventory: Array<{
    item_id: string;
    item_name: string;
    bin_id?: string;
    bin_name?: string;
    quantity: integer;
  }>;
}
```

**Authorization**: Any authenticated user

---

## UI Boundary

### Component: `ItemSearchBar`

**Purpose**: Quick search/barcode scan input

**Props**:

```typescript
{
  onItemFound: (item: ItemPreview) => void
  warehouse_id?: string  // Optional scope
  disabled?: boolean
}

type ItemPreview = {
  id: string
  name: string
  barcode?: string
}
```

---

### Component: `ItemDetailsView`

**Purpose**: Full item page with inventory & history

**Props**:

```typescript
{
  itemId: string
  warehouse_id?: string  // Optional scope
}

// Mock data shape returned by useItem(itemId) hook:
{
  id: string
  name: string
  description?: string
  barcodes: string[]
  inventory: Array<{
    warehouse_id: string
    warehouse_name: string
    bin_id?: string
    bin_name?: string
    quantity: number
  }>
  movements: Array<{
    id: string
    type: string
    quantity: number
    source_warehouse?: string
    source_bin?: string
    dest_warehouse?: string
    dest_bin?: string
    user: { name: string }
    note?: string
    created_at: string
  }>
}
```

---

### Component: `InventoryTable`

**Purpose**: Paginated/filterable list of items in a warehouse

**Props**:

```typescript
{
  warehouse_id: string
  bin_id?: string
  refresh_trigger?: number  // Incremented after mutations
}
```

---

## Definition of Done

- [ ] DB schema tables created/migrated
- [ ] `GET /api/items/search` endpoint implemented
- [ ] `GET /api/items/:itemId` endpoint implemented
- [ ] `GET /api/warehouses/:warehouseId/inventory` endpoint implemented
- [ ] Frontend queries generated via `npm run generate-api`
- [ ] `ItemSearchBar`, `ItemDetailsView`, `InventoryTable` components stubbed
- [ ] TanStack Query hooks (`useItemSearch`, `useItem`, `useWarehouseInventory`) created

### user
