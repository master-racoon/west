# Kanban Memory — Warehouse Inventory System

## Project Overview

**Warehouse Inventory System**: A barcode-driven inventory web app for a family team to track items across warehouses with optional bin/shelf organization.

**Tech Stack**:

- Backend: Hono API (Cloudflare Pages Functions)
- Frontend: React SPA (Vite + TanStack Query)
- Database: Postgres (Drizzle ORM)
- Auth: BetterAuth with role-based access (Owner, User)

## DFD Reference

Primary artifact: `docs/dfd_level0.md`

**5 Core Flows**:

1. **Flow-1: Add Stock (Receiving)** — Users add inventory
2. **Flow-2: Remove Stock (Consumption)** — Users remove inventory with owner override for negative stock
3. **Flow-3: Transfer Stock** — Users move items between warehouses
4. **Flow-4: Quick Count** — Users reconcile physical counts
5. **Flow-5: Configuration** — Owner manages warehouses, items, bins

## Phase 2 Tasks Created

All tasks in backlog lane. Ordered by DFD dependency:

| Task                 | Title                              | DFD Flow | Dependencies |
| -------------------- | ---------------------------------- | -------- | ------------ |
| `task_20260404_01_*` | Define Warehouse with Bin Mode     | Flow-5   | Base task    |
| `task_20260404_02_*` | Create and Manage Items + Barcodes | Flow-5   | #1           |
| `task_20260404_03_*` | Create and Manage Bins             | Flow-5   | #1           |
| `task_20260404_04_*` | Scan and Add Stock                 | Flow-1   | #1,2,3       |
| `task_20260404_05_*` | Create Item On-the-Fly             | Flow-1   | #4           |
| `task_20260404_06_*` | Scan and Remove Stock              | Flow-2   | #4           |
| `task_20260404_07_*` | Warn Owner of Shortfall            | Flow-2   | #6           |
| `task_20260404_08_*` | Transfer Stock                     | Flow-3   | #4           |
| `task_20260404_09_*` | Quick Count & Reconcile            | Flow-4   | #4           |
| `task_20260404_10_*` | Inventory Visibility (Read)        | All      | #4,6         |

## Key Architecture Decisions

### Database

- **Movement Log**: Immutable append-only log of every inventory change (ADD, REMOVE, TRANSFER, COUNT_ADJUSTMENT)
- **Inventory Balance**: Computed view (SUM of movements) — not a separate mutable table
- **Bin-Optional**: Warehouses have `use_bins` flag; bins only enforced if true
- **Schema Evolution**: Use Drizzle generate → migrate workflow

### API Design

- **Contract-First**: Zod schemas in routes → OpenAPI → frontend code gen
- **Boundary Contracts**: Each flow specifies request/response data types in dfd_level0.md
- **Role-Based Access**: Owner can override constraints; User performs operations only
- **Error Classes**: Use `AppError` subclasses (ForbiddenError, NotFoundError, etc.)

### Frontend

- **Server State**: TanStack Query hooks in `src/hooks/queries/` (one per domain)
- **Mutations**: Always invalidate query keys after successful mutation
- **Client State**: Zustand for auth/user session (persisted to localStorage)
- **Component Structure**: Pages fetch data → components receive props

### Testing Strategy

- **Backend**: Vitest integration tests vs Dockerized Postgres (port 5433)
- **E2E**: Playwright in `warehouse-frontend/e2e/`
- **Test Helpers**: `clearDatabase()`, `signupUser(role)` in `warehouse-backend/src/tests/helpers.ts`

## Workflow Commands

Standard Kanban verbs:

- `@kanban /task <name>` — select task to work on
- `plan` (`p`) — discuss and plan with DFD + requirements
- `todo` (`t`) — create actionable checklist
- `implement` (`i`) — write code per plan and checklist

Examples: `p t i` = plan, then todo, then implement in one turn.

## Dev Workflow (Reference)

```bash
# Setup
make dev            # Docker (Postgres) + backend (:8788) + frontend (:5173)

# After backend route/schema change
cd warehouse-frontend && npm run generate-api

# Database migrations
npm run db:generate    # From schema.ts changes
npm run db:migrate     # Apply to local
npm run db:migrate:prod # Apply to production

# Testing
make test           # Vitest + Playwright (Docker)
make test-e2e       # Playwright only
```

## Common Patterns

### Backend Route

```typescript
// warehouse-backend/src/routes/items.ts
import { createRoute } from "@hono/zod-openapi";

export const createItemRoute = createRoute({
  method: "post",
  path: "/items",
  request: {
    body: { content: { "application/json": { schema: CreateItemRequest } } },
  },
  response: {
    201: { content: { "application/json": { schema: ItemResponse } } },
  },
  tags: ["Items"],
});

router.openapi(createItemRoute, async (c) => {
  const { name, description, barcodes } = c.req.valid("json");
  // Validate, insert, return 201
});
```

### Frontend Hook

```typescript
// warehouse-frontend/src/hooks/queries/useItems.ts
export function useCreateItem() {
  return useMutation({
    mutationFn: (data) => client.items.createItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });
}
```

## Known Constraints / Future Work

- **Async Owner Approval**: Task #7 (RemovalApprovals) has sync + async options; MVP uses sync modal
- **Export Data**: Not in Phase 2; future enhancement
- **Multi-user Sync**: Real-time updates not in Phase 2; polling via Query cache
- **Notifications**: Owner alerts (removals, system events) placeholder for future

---

**Last updated**: 2026-04-04 — All 10 Phase 2 tasks created, ready for implementation ordering.
