---
title: "[DEV] US-3.2 Warn Owner of Stock Shortfall"
lane: backlog
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T00:00:00Z
description: "Owner receives notification and approves removals that would cause negative stock"
labels:
  - flow-2-remove-stock
---

## DFD Reference

**Flow**: [Flow-2: Remove Stock (Consumption/Sale)](../../docs/dfd_level0.md#flow-2-remove-stock) (warning path)

**Data Contract** (from dfd_level0.md):

- Warning response: `{ warning: string, owner_approval_required: boolean }`
- Owner approval: Decision to approve or reject removal via dashboard/notification

---

## Vertical Slice (DB → API → UI)

### 1. Database Schema

`warehouse-backend/src/db/schema.ts`

**Optional: `removal_approval` table** (if async workflow needed):

- `id` (UUID, PK)
- `movement_id` (UUID, FK → movement.id, nullable)
- `user_id` (UUID, FK → user.id, the requester)
- `item_id` (UUID, FK → item.id)
- `warehouse_id` (UUID, FK → warehouse.id)
- `quantity_requested` (INT)
- `current_balance` (INT)
- `status` (ENUM: 'pending', 'approved', 'rejected')
- `approved_by_owner` (UUID, FK → user.id, nullable)
- `created_at` (TIMESTAMP)
- `decided_at` (TIMESTAMP, nullable)

**Note**: If using synchronous approval (modal during RemoveStock page), this table is not needed. If using async approval (owner dashboard), table is required.

---

### 2. API Routes

`warehouse-backend/src/routes/inventory.ts` (update)

**GET /api/inventory/removal-approvals** (if async workflow)

- **Auth**: Owner role required
- **Response**: Array of pending removal requests
  - `{ id, item_id, item_name, warehouse_id, warehouse_name, quantity_requested, current_balance, requested_by, created_at }`
- **Handler**: Query removal_approval table where status = 'pending'

**POST /api/inventory/removal-approvals/:id/approve** (if async workflow)

- **Auth**: Owner role required
- **Request**: Empty or `{ comment?: string }`
- **Response**: `{ approval_id, status: 'approved' }`
- **Handler**:
  1. Fetch removal_approval record
  2. If already decided, return 400 (already processed)
  3. Mark status = 'approved'
  4. Create movement with owner_override = true
  5. Update removal_approval.approved_by_owner
  6. Return success

**POST /api/inventory/removal-approvals/:id/reject** (if async workflow)

- **Auth**: Owner role required
- **Response**: `{ approval_id, status: 'rejected' }`
- **Handler**:
  1. Fetch removal_approval record
  2. If already decided, return 400
  3. Mark status = 'rejected'
  4. Return success (do NOT create movement)

---

### 3. Frontend

#### Option A: Synchronous Modal (Simpler)

**Component**: `warehouse-frontend/src/components/InsufficientStockModal.tsx`

- **Props**:
  - `item_name`, `warehouse_name`, `current_balance`, `requested_quantity`, `shortfall`
  - `onApprove`, `onReject` callbacks
- **Layout**:
  - Title: "Insufficient Stock — Owner Approval Required"
  - Message: "Item [X] in [Warehouse]: have [Y], requested [Z] (shortfall: [S])"
  - Buttons: "Request Approval", "Cancel"
- **Behavior**:
  - User clicks "Request Approval"
  - Modal calls `onApprove()` → parent component calls `removeStock(owner_override=true)`
  - On success: toast "Removal approved and completed"
  - On failure (403): toast "Owner approval failed"

**Update**: `warehouse-frontend/src/pages/RemoveStock.tsx`

- On 402 error, show InsufficientStockModal
- Modal's `onApprove` → retry mutation with owner_override=true
- Assume owner is logged in and can approve immediately

#### Option B: Asynchronous Dashboard (Complex)

**Hook**: `warehouse-frontend/src/hooks/queries/useRemovalApprovals.ts`

```typescript
export function useRemovalApprovals() {
  return useQuery({
    queryKey: ["removal-approvals", "pending"],
    queryFn: () => client.inventory.getRemovalApprovals(),
  });
}

export function useApproveRemoval() {
  return useMutation({
    mutationFn: (approvalId: string) =>
      client.inventory.approveRemoval({ approvalId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["removal-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["inventory", "balance"] });
    },
  });
}
```

**Component**: `warehouse-frontend/src/pages/RemovalApprovals.tsx` (new owner-only page)

- **Layout**:
  - Table of pending removals (item, warehouse, quantity, requester, timestamp)
  - For each row: "Approve" and "Reject" buttons
- **Actions**:
  - Approve → call `approveRemoval(id)` → movement created, balance updated
  - Reject → call `rejectRemoval(id)` → removal cancelled, user notified
  - Toast on success

**Update**: `warehouse-frontend/src/pages/RemoveStock.tsx`

- On 402 error, show modal: "Removal requires owner approval. Request sent."
- Modal has "OK" button to dismiss
- Optionally send notification to owner (push/email — out of scope for MVP)

---

## Testing

### Happy Path (Synchronous)

- [ ] Frontend: Insufficient stock modal appears
- [ ] Frontend: User clicks "Request Approval" (assumes owner is logged in)
- [ ] Backend: `POST /api/inventory/remove` with owner_override=true processes
- [ ] Frontend: Toast "Removal approved and completed"

### Happy Path (Asynchronous)

- [ ] Backend: Insufficient removal request → 402 returned, approval record created (status=pending)
- [ ] Frontend: Removal awaiting approval modal shown
- [ ] Owner navigates to RemovalApprovals page
- [ ] Owner sees pending removal request
- [ ] Owner clicks Approve → `POST /api/inventory/removal-approvals/:id/approve`
- [ ] Backend: Movement created with override flag, approval.status = 'approved'
- [ ] Frontend: RemovalApprovals list refreshed, approval no longer shown

### Error Paths

- [ ] Frontend: Owner clicks Request Approval but remove fails → error toast
- [ ] Backend: Attempt to approve non-existent approval → 404
- [ ] Backend: Attempt to approve twice → 400 (already processed)
- [ ] Owner: Reject removal → approval.status = 'rejected', no movement created

---

## Implementation Notes

- **MVP Recommendation**: Use synchronous modal (simplest). Async dashboard is future enhancement.
- If synchronous: owner must be logged in on same page to approve
- If asynchronous: requires notification system (push/email) — can be placeholder for now
- After schema: `npm run db:generate` → `db:migrate` → `generate-api`

## Conversation

### user
