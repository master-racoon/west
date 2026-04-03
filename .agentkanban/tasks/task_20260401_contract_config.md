---
title: "[CONTRACT] Configuration Management (Admin)"
lane: todo
created: 2026-04-01
updated: 2026-04-01
description: Define DB schema, API endpoints, and UI contracts for warehouse and item management
parent: task_20260401_dfd0_warehouse.md
---

## Conversation

### user

Define the contract boundaries for configuration management flow.

### agent

## [CONTRACT] Configuration Management (Admin)

Referenced from: [DFD-0] Warehouse Inventory System Data Flow

### User Stories Covered

- **Owner configures warehouse bins (Owner)**: Enable/disable bin usage per warehouse
- **Owner manages warehouses (Owner)**: Create, edit warehouse names
- **Owner manages items (Owner)**: Create, edit, delete items (careful: immutable if in movements)
- **Owner manages bins (Owner)**: Create, rename, delete bins

---

## DB Schema Requirements

### Tables (Drizzle)

```typescript
warehouses: {
  id: string (PK),
  name: string,
  use_bins: boolean,
  created_at: timestamp,
  updated_at: timestamp
}

items: {
  id: string (PK),
  name: string,
  description?: string,
  created_at: timestamp,
  updated_at: timestamp
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
  created_at: timestamp,
  updated_at: timestamp
}
```

---

## API Boundary

### Endpoints

#### `GET /api/warehouses`

**Purpose**: List all warehouses

**Response (200)**:

```typescript
{
  warehouses: Array<{
    id: string;
    name: string;
    use_bins: boolean;
    bin_count: integer;
    total_items: integer; // Items with quantity > 0
    created_at: ISO8601;
  }>;
}
```

**Authorization**: Owner role only

---

#### `POST /api/warehouses`

**Purpose**: Create new warehouse

**Request body**:

```typescript
{
  name: string; // min 1, max 255
  use_bins: boolean; // default: false
}
```

**Response (201)**:

```typescript
{
  id: string;
  name: string;
  use_bins: boolean;
  created_at: ISO8601;
}
```

**Authorization**: Owner role only

---

#### `PATCH /api/warehouses/:warehouseId`

**Purpose**: Update warehouse config

**Path params**: `warehouseId: string`

**Request body**:

```typescript
{
  name?: string
  use_bins?: boolean  // CAUTION: switching from true→false requires all bins to be empty
}
```

**Response (200)**:

```typescript
{
  id: string;
  name: string;
  use_bins: boolean;
}
```

**Response (409)**: Cannot disable bins if items exist in bins

**Authorization**: Owner role only

---

#### `GET /api/warehouses/:warehouseId/bins`

**Purpose**: List bins for a warehouse

**Response (200)**:

```typescript
{
  warehouse_id: string;
  bins: Array<{
    id: string;
    name: string;
    item_count: integer; // Items with qty > 0 in this bin
    created_at: ISO8601;
  }>;
}
```

**Authorization**: Owner role only

---

#### `POST /api/warehouses/:warehouseId/bins`

**Purpose**: Create bin in warehouse

**Request body**:

```typescript
{
  name: string; // min 1, max 255
}
```

**Response (201)**:

```typescript
{
  id: string;
  warehouse_id: string;
  name: string;
  created_at: ISO8601;
}
```

**Response (400)**: Warehouse does not have bins enabled

**Authorization**: Owner role only

---

#### `PATCH /api/bins/:binId`

**Purpose**: Rename bin

**Request body**:

```typescript
{
  name: string;
}
```

**Response (200)**:

```typescript
{
  id: string;
  warehouse_id: string;
  name: string;
}
```

**Authorization**: Owner role only

---

#### `DELETE /api/bins/:binId`

**Purpose**: Delete bin

**Preconditions**: Bin must be empty (no items with qty > 0)

**Response (204)**: Success

**Response (409)**: Bin not empty

**Authorization**: Owner role only

---

#### `GET /api/items/admin`

**Purpose**: List all items for admin management

**Response (200)**:

```typescript
{
  items: Array<{
    id: string;
    name: string;
    description?: string;
    barcodes: string[];
    total_quantity: integer;
    warehouse_splits: Array<{
      warehouse_id: string;
      quantity: integer;
      bins: Array<{ bin_id: string; qty: integer }>;
    }>;
    created_at: ISO8601;
  }>;
}
```

**Authorization**: Owner role only

---

#### `POST /api/items`

**Purpose**: Create new item

**Request body**:

```typescript
{
  name: string           // min 1, max 255
  description?: string
  barcodes?: string[]    // Optional initial barcodes
}
```

**Response (201)**:

```typescript
{
  id: string
  name: string
  description?: string
  barcodes: string[]
  created_at: ISO8601
}
```

**Authorization**: Owner role only

---

#### `PATCH /api/items/:itemId`

**Purpose**: Update item details

**Request body**:

```typescript
{
  name?: string
  description?: string
}
```

**Response (200)**:

```typescript
{
  id: string
  name: string
  description?: string
  barcodes: string[]
}
```

**Authorization**: Owner role only

---

#### `POST /api/items/:itemId/barcodes`

**Purpose**: Add barcode to item

**Request body**:

```typescript
{
  barcode: string; // must be unique
}
```

**Response (201)**:

```typescript
{
  barcode_id: string;
  item_id: string;
  barcode: string;
  created_at: ISO8601;
}
```

**Response (409)**: Barcode already exists

**Authorization**: Owner role only

---

#### `DELETE /api/items/:itemId/barcodes/:barcodeId`

**Purpose**: Remove barcode from item

**Response (204)**: Success

**Response (404)**: Barcode or item not found

**Authorization**: Owner role only

---

## UI Boundary

### Pages & Components

#### `AdminDash` (Page)

**Purpose**: Navigation hub for all admin functions

**Sections**:

- Warehouse management
- Item management
- Bin management
- User management (future)

---

#### `WarehouseAdmin`

**Purpose**: Create, list, edit warehouses

**Props**:

```typescript
{
  onUpdate: () => void
}
```

**Features**:

- List warehouses with item counts
- Create new warehouse (form modal)
- Edit warehouse name
- Toggle use_bins (with warning if disabling)

---

#### `ItemAdmin`

**Purpose**: Create, list, edit items and barcodes

**Props**:

```typescript
{
  onUpdate: () => void
}
```

**Features**:

- Searchable/paginated item list
- Create new item (form modal)
- Edit item details (inline or modal)
- Add/remove barcodes
- View current inventory per item

---

#### `BinAdmin`

**Purpose**: Create, list, edit, delete bins

**Props**:

```typescript
{
  warehouse_id: string
  onUpdate: () => void
}
```

**Features**:

- List bins in warehouse
- Create bin (form modal)
- Rename bin (inline or modal)
- Delete bin (with empty check warning)

---

## TanStack Query Hooks (Admin)

```typescript
useWarehouses(); // GET /api/warehouses
useCreateWarehouse(); // POST /api/warehouses
useUpdateWarehouse(id); // PATCH /api/warehouses/:id
useWarehouseBins(warehouseId); // GET /api/warehouses/:id/bins
useCreateBin(warehouseId); // POST /api/warehouses/:id/bins
useUpdateBin(binId); // PATCH /api/bins/:id
useDeleteBin(binId); // DELETE /api/bins/:id
useItemsAdmin(); // GET /api/items/admin
useCreateItem(); // POST /api/items
useUpdateItem(id); // PATCH /api/items/:id
useAddBarcode(itemId); // POST /api/items/:id/barcodes
useDeleteBarcode(itemId, barcodeId); // DELETE /api/items/:id/barcodes/:bid
```

---

## Definition of Done

- [ ] All warehouse endpoints implemented
- [ ] All item endpoints implemented
- [ ] All bin endpoints implemented
- [ ] Authorization checks: Owner role required
- [ ] Validation: warehouse/item/bin names non-empty; barcode unique
- [ ] Validation: Cannot disable bins if occupied; cannot delete non-empty bins
- [ ] Frontend queries generated
- [ ] `AdminDash` page built
- [ ] `WarehouseAdmin`, `ItemAdmin`, `BinAdmin` components built
- [ ] All TanStack Query hooks created

### user
