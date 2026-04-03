---
title: "[CONTRACT] Remove Stock (Consumption/Sale)"
lane: todo
created: 2026-04-01
updated: 2026-04-01
description: Define DB schema, API endpoints, and UI contracts for removing inventory with negative stock validation
parent: task_20260401_dfd0_warehouse.md
---

## Conversation

### user

Define the contract boundaries for remove stock flow.

### agent

## [CONTRACT] Remove Stock (Consumption/Sale)

Referenced from: [DFD-0] Warehouse Inventory System Data Flow

### User Stories Covered

- **Remove stock (User)**: Scan item and remove quantity
- **Warn on negative (Owner)**: System prevents negative unless owner overrides

---

## DB Schema Requirements

### Tables (Drizzle)

Extends schema from prior contracts:

```typescript
movements: {
  // ... existing fields
  type: 'REMOVE' | ... ✓
  override_reason?: string  // For owner overrides
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

#### `POST /api/movements/remove`

**Purpose**: Record REMOVE movement (decrease inventory)

**Request body**:

```typescript
{
  item_id: string
  warehouse_id: string
  bin_id?: string         // Required if warehouse.use_bins = true
  quantity: integer       // Must be > 0
  note?: string
  force_negative?: boolean // Owner only; skips balance check
  override_reason?: string // Required if force_negative = true
}
```

**Response (201)**:

```typescript
{
  movement_id: string
  item_id: string
  type: 'REMOVE'
  quantity: integer
  warehouse_id: string
  bin_id?: string
  new_balance: integer
  created_at: ISO8601
  warned_negative?: boolean  // true if balance went negative
}
```

**Response (400):**

- Insufficient balance (if force_negative = false)
- Missing bin when warehouse.use_bins = true
- Negative or zero quantity
- force_negative without owner role
- force_negative without override_reason

**Response (403)**: User role cannot use force_negative

**Response (404)**: Item or warehouse not found

**Authorization**: User or Owner role. Only Owner can use force_negative flag.

---

## UI Boundary

### Component: `RemoveStockForm`

**Purpose**: Form for removing inventory with validation feedback

**Props**:

```typescript
{
  onSuccess: (movement: Movement) => void
  user_role: 'user' | 'owner'
  default_warehouse_id?: string
}
```

**User flow (regular user)**:

1. Select warehouse
2. Scan/enter barcode → resolve to item
3. Enter quantity to remove
4. If warehouse.use_bins → select bin
5. Optional note
6. Click Remove
   - If balance sufficient → confirm & POST
   - If balance insufficient → show error (cannot proceed)

**User flow (owner)**:

1. Same as above through step 5
2. Click Remove
   - If balance insufficient → show warning + "Force Remove?" button
   - If forced: require override reason
   - POST with force_negative=true + override_reason

**Mock data shape for hooks**:

```typescript
{
  item_id: string
  item_name: string
  warehouse_id: string
  warehouse_name: string
  bin_id?: string
  bin_name?: string
  quantity: number
  current_balance: number
  will_go_negative: boolean
  note?: string
  override_reason?: string
}
```

---

### Component: `NegativeStockWarning`

**Purpose**: Modal alert for insufficient balance (owner only)

**Props**:

```typescript
{
  item_name: string
  current_balance: number
  requested_qty: number
  deficit: number
  on_confirm: () => void
  on_cancel: () => void
}
```

---

## TanStack Query Hooks

### `useRemoveMovement()`

Mutation hook for POST `/api/movements/remove`

```typescript
{
  mutate: (data: RemoveMovementRequest) => void
  isPending: boolean
  error?: Error
  data?: Movement
}
```

### `useInventoryBalance(item_id, warehouse_id, bin_id?)`

Query hook to check current balance before attempting removal

```typescript
{
  data: { quantity: number }
  isLoading: boolean
  error?: Error
}
```

---

## Definition of Done

- [ ] `POST /api/movements/remove` endpoint implemented
- [ ] Balance validation: compute current quantity from movements sum
- [ ] Authorization: force_negative only for Owner role
- [ ] Request validation: quantity > 0, warehouse/bin exist
- [ ] Frontend queries generated
- [ ] `RemoveStockForm` component built with dual user/owner flows
- [ ] `NegativeStockWarning` modal component built
- [ ] `useRemoveMovement()` and `useInventoryBalance()` hooks created
- [ ] UI disables Remove button if insufficient balance (unless Owner)

### user
