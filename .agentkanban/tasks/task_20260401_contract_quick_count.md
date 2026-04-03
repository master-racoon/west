---
title: "[CONTRACT] Quick Count (Physical Inventory Adjustment)"
lane: todo
created: 2026-04-01
updated: 2026-04-01
description: Define DB schema, API endpoints, and UI contracts for physical count adjustments
parent: task_20260401_dfd0_warehouse.md
---

## Conversation

### user

Define the contract boundaries for quick count flow.

### agent

## [CONTRACT] Quick Count (Physical Inventory Adjustment)

Referenced from: [DFD-0] Warehouse Inventory System Data Flow

### User Stories Covered

- **Quick count (User)**: Scan item, enter observed quantity, auto-adjust inventory

---

## DB Schema Requirements

### Tables (Drizzle)

```typescript
movements: {
  // ... existing fields
  type: 'COUNT_ADJUSTMENT' | ... ✓
  // Records the delta (actual – recorded)
  // quantity field may be positive (correction) or negative (correction)
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

#### `POST /api/movements/count-adjustment`

**Purpose**: Record COUNT_ADJUSTMENT movement when physical count differs from recorded

**Request body**:

```typescript
{
  item_id: string
  warehouse_id: string
  bin_id?: string          // Required if warehouse.use_bins = true
  observed_quantity: integer  // What user physically counted (≥ 0)
  note?: string
}
```

**Backend logic**:

1. Compute recorded_quantity from SUM of previous movements
2. delta = observed_quantity – recorded_quantity
3. Create movement with quantity = delta
4. Update balance

**Response (201)**:

```typescript
{
  movement_id: string
  item_id: string
  type: 'COUNT_ADJUSTMENT'
  recorded_quantity: integer
  observed_quantity: integer
  delta: integer            // + or - based on adjustment
  warehouse_id: string
  bin_id?: string
  new_balance: integer
  created_at: ISO8601
}
```

**Response (400)**:

- Negative observed_quantity
- Missing bin when warehouse.use_bins = true

**Response (404)**: Item or warehouse not found

**Authorization**: User or Owner role required

---

## UI Boundary

### Component: `QuickCountForm`

**Purpose**: Rapid form for physical inventory adjustment

**Props**:

```typescript
{
  onSuccess: (movement: Movement) => void
  default_warehouse_id?: string
}
```

**User flow**:

1. Select warehouse (or pre-filled)
   - If warehouse.use_bins → select bin
2. Scan/enter item barcode → resolve & show recorded qty
3. Enter observed quantity (physically counted on shelf)
4. Optional note (e.g., "Found old stock in corner")
5. Confirm → POST to `/api/movements/count-adjustment`
   - Show delta summary: "Was 50, now 47 (delta: -3)"

**Mock data shape for hooks**:

```typescript
{
  item_id: string
  item_name: string
  warehouse_id: string
  warehouse_name: string
  bin_id?: string
  bin_name?: string
  recorded_quantity: number
  observed_quantity: number
  delta: number
  new_balance: number
  note?: string
}
```

---

### Component: `CountAdjustmentSummary`

**Purpose**: Display before/after snapshot of adjustment

**Props**:

```typescript
{
  item_name: string
  recorded_qty: number
  observed_qty: number
  delta: number
  warehouse: string
  bin?: string
}
```

---

## TanStack Query Hooks

### `useCountAdjustment()`

Mutation hook for POST `/api/movements/count-adjustment`

```typescript
{
  mutate: (data: CountAdjustmentRequest) => void
  isPending: boolean
  error?: Error
  data?: Movement
}
```

---

## Definition of Done

- [ ] `POST /api/movements/count-adjustment` endpoint implemented
- [ ] Backend computes recorded_quantity from movements history
- [ ] Backend computes delta = observed – recorded
- [ ] Frontend queries generated
- [ ] `QuickCountForm` component built
- [ ] `CountAdjustmentSummary` component built
- [ ] `useCountAdjustment()` hook created
- [ ] Validation: observed_quantity ≥ 0, warehouse/bin exist

### user
