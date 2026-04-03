---
title: "[CONTRACT] Transfer Stock (Between Warehouses)"
lane: todo
created: 2026-04-01
updated: 2026-04-01
description: Define DB schema, API endpoints, and UI contracts for transferring inventory between warehouses
parent: task_20260401_dfd0_warehouse.md
---

## Conversation

### user

Define the contract boundaries for transfer stock flow.

### agent

## [CONTRACT] Transfer Stock (Between Warehouses)

Referenced from: [DFD-0] Warehouse Inventory System Data Flow

### User Stories Covered

- **Transfer between warehouses (User)**: Move quantity from warehouse A to B
- **Optional bins (User)**: Specify bin in each warehouse if enabled

---

## DB Schema Requirements

### Tables (Drizzle)

Extends schema from prior contracts:

```typescript
movements: {
  // ... existing fields
  type: 'TRANSFER' | ... ✓
  // TRANSFER has both source and dest warehouse/bin
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

#### `POST /api/movements/transfer`

**Purpose**: Record TRANSFER movement (move stock between warehouses/bins)

**Request body**:

```typescript
{
  item_id: string
  quantity: integer            // Must be > 0
  source_warehouse_id: string
  source_bin_id?: string       // Required if source warehouse.use_bins = true
  dest_warehouse_id: string
  dest_bin_id?: string         // Required if dest warehouse.use_bins = true
  note?: string
}
```

**Validation**:

- source_warehouse_id ≠ dest_warehouse_id (or allow same warehouse but different bin?)
- Sufficient balance in source warehouse/bin
- If source.use_bins OR dest.use_bins: must provide corresponding bin_id
- All referenced warehouses & bins must exist

**Response (201)**:

```typescript
{
  movement_id: string
  item_id: string
  type: 'TRANSFER'
  quantity: integer
  source_warehouse_id: string
  source_bin_id?: string
  dest_warehouse_id: string
  dest_bin_id?: string
  source_new_balance: integer
  dest_new_balance: integer
  created_at: ISO8601
}
```

**Response (400)**:

- Same source/dest
- Insufficient balance in source
- Missing bin when required
- Negative or zero quantity

**Response (404)**: Item, source warehouse, or dest warehouse not found

**Authorization**: User or Owner role required

---

## UI Boundary

### Component: `TransferStockForm`

**Purpose**: Multi-step form for transferring inventory

**Props**:

```typescript
{
  onSuccess: (movement: Movement) => void
}
```

**User flow**:

1. Scan/enter item barcode → resolve to item
2. Enter quantity to transfer
3. Select source warehouse
   - If source.use_bins → select source bin
4. Select destination warehouse (dropdown all warehouses)
   - If dest.use_bins → select dest bin
5. Optional transfer note
6. Confirm → POST to `/api/movements/transfer`

**Mock data shape for hooks**:

```typescript
{
  item_id: string
  item_name: string
  quantity: number
  source_warehouse_id: string
  source_warehouse_name: string
  source_bin_id?: string
  source_bin_name?: string
  source_balance: number
  dest_warehouse_id: string
  dest_warehouse_name: string
  dest_bin_id?: string
  dest_bin_name?: string
  note?: string
}
```

---

### Component: `WarehouseSelector`

**Purpose**: Reusable dropdown + bin selector for picking location

**Props**:

```typescript
{
  label: string
  warehouses: Warehouse[]
  selected_warehouse_id?: string
  on_warehouse_change: (id: string) => void
  selected_bin_id?: string
  on_bin_change: (id: string) => void
}
```

---

## TanStack Query Hooks

### `useTransferMovement()`

Mutation hook for POST `/api/movements/transfer`

```typescript
{
  mutate: (data: TransferMovementRequest) => void
  isPending: boolean
  error?: Error
  data?: Movement
}
```

### `useWarehouses()`

Query hook to fetch all warehouses (for dropdowns)

```typescript
{
  data: Warehouse[]
  isLoading: boolean
  error?: Error
}
```

---

## Definition of Done

- [ ] `POST /api/movements/transfer` endpoint implemented
- [ ] Validation: source ≠ dest, sufficient balance, bins match warehouse config
- [ ] Frontend queries generated
- [ ] `TransferStockForm` component built with multi-step flow
- [ ] `WarehouseSelector` component built and reusable
- [ ] `useTransferMovement()` and `useWarehouses()` hooks created
- [ ] Transfer updates both source and dest balances atomically

### user
