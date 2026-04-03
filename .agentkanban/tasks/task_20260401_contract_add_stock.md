---
title: "[CONTRACT] Add Stock (Receiving)"
lane: todo
created: 2026-04-01
updated: 2026-04-01
description: Define DB schema, API endpoints, and UI contracts for adding inventory
parent: task_20260401_dfd0_warehouse.md
---

## Conversation

### user

Define the contract boundaries for add stock flow.

### agent

## [CONTRACT] Add Stock (Receiving)

Referenced from: [DFD-0] Warehouse Inventory System Data Flow

### User Stories Covered

- **Add stock (User)**: Scan item and add quantity to warehouse
- **Create new item (User)**: Auto-create item when scanning unknown barcode

---

## DB Schema Requirements

### Tables (Drizzle)

Extends schema from [CONTRACT] Inventory Visibility:

```typescript
// warehouse-backend/src/db/schema.ts

movements: {
  // ... existing fields
  type: 'ADD' | 'REMOVE' | 'TRANSFER' | ... ✓
  // See Inventory Visibility for full structure
}

// Computed balance (same as visibility)
inventory_balances: {
  item_id: string,
  warehouse_id: string,
  bin_id?: string,
  quantity: integer
}
```

---

## API Boundary

### Endpoints

#### `POST /api/items/barcode/:barcode/or-create`

**Purpose**: Resolve barcode to item; create item if unknown

**Path params**:

```typescript
{
  barcode: string;
}
```

**Request body** (optional, if item unknown):

```typescript
{
  name: string           // Required if creating
  description?: string
}
```

**Response (200 - item exists)**:

```typescript
{
  id: string
  name: string
  description?: string
  created: false
}
```

**Response (201 - item created)**:

```typescript
{
  id: string
  name: string
  description?: string
  created: true
}
```

**Authorization**: User or Owner role required

---

#### `POST /api/movements/add`

**Purpose**: Record ADD movement (increase inventory)

**Request body**:

```typescript
{
  item_id: string
  warehouse_id: string
  bin_id?: string         // Required if warehouse.use_bins = true
  quantity: integer       // Must be > 0
  note?: string
}
```

**Response (201)**:

```typescript
{
  movement_id: string
  item_id: string
  type: 'ADD'
  quantity: integer
  warehouse_id: string
  bin_id?: string
  new_balance: integer
  created_at: ISO8601
}
```

**Response (400)**:

- Invalid warehouse/bin
- Negative or zero quantity
- Missing bin when required

**Response (404)**: Item not found

**Authorization**: User or Owner role required

---

## UI Boundary

### Component: `AddStockForm`

**Purpose**: Guided form for adding inventory

**Props**:

```typescript
{
  onSuccess: (movement: Movement) => void
  default_warehouse_id?: string
}
```

**User flow**:

1. Select warehouse
2. Scan/enter barcode
   - If unknown → inline item creation dialog
3. Enter quantity
4. If warehouse.use_bins → select bin
5. Optional note
6. Confirm → POST to `/api/movements/add`

**Mock data shape (returned by hooks)**:

```typescript
{
  warehouse_id: string
  warehouse_name: string
  use_bins: boolean
  item_id: string
  item_name: string
  barcode: string
  bin_id?: string
  bin_name?: string
  quantity: number
  note?: string
}
```

---

### Component: `ItemCreationDialog`

**Purpose**: Quick inline dialog for creating new item during scan

**Props**:

```typescript
{
  barcode: string
  onCreated: (item: Item) => void
  onCancel: () => void
}
```

**Fields**:

- Item name (required, min 1 char)
- Description (optional)

---

## TanStack Query Hooks

### `useAddMovement()`

Mutation hook for POST `/api/movements/add`

```typescript
{
  mutate: (data: AddMovementRequest) => void
  isPending: boolean
  error?: Error
  data?: Movement
}
```

---

## Definition of Done

- [ ] `POST /api/items/barcode/:barcode/or-create` endpoint implemented
- [ ] `POST /api/movements/add` endpoint implemented
- [ ] DB schema supports movements with null checks for bins
- [ ] Frontend queries generated
- [ ] `AddStockForm` component built
- [ ] `ItemCreationDialog` component built
- [ ] `useAddMovement()` hook created
- [ ] Validation: warehouse exists, bin exists (if required), quantity > 0

### user
