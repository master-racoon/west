# Agent Kanban Memory

## Project: Warehouse Inventory Management System

A barcode-driven inventory webapp for a small family team to track stock across two warehouses (A & B), with optional bin/shelf management and full audit trail.

## Grooming Completed: 2026-04-01

### Structure: DFD-0 → CONTRACT → DEV → QA

**Total Tasks Created: 22**

- 1x DFD-0 (Data Flow Diagram)
- 7x CONTRACT (Boundary Definitions)
- 12x DEV (Vertical Slice Implementations)
- 1x QA (Test Plan)

### Task Inventory

#### DFD-0 Phase

- **task_20260401_dfd0_warehouse.md** - Complete system data flow mapping

#### CONTRACT Phase (Boundaries)

- **task_20260401_contract_visibility.md** - Search/view inventory, item details
- **task_20260401_contract_add_stock.md** - Add inventory (receiving)
- **task_20260401_contract_remove_stock.md** - Remove inventory with balance checks
- **task_20260401_contract_transfer_stock.md** - Transfer between warehouses
- **task_20260401_contract_quick_count.md** - Physical count adjustments
- **task_20260401_contract_config.md** - Admin CRUD for warehouses, items, bins
- **task_20260401_contract_export.md** - CSV data export

#### DEV Phase (Vertical Slices)

1. **task_20260401_dev_search_items.md** - Item search by barcode/name
2. **task_20260401_dev_item_details.md** - Item detail view with history
3. **task_20260401_dev_create_item.md** - Resolve/create items from barcode
4. **task_20260401_dev_add_movement.md** - ADD movement recording
5. **task_20260401_dev_remove_movement.md** - REMOVE movement with validation
6. **task_20260401_dev_transfer_movement.md** - TRANSFER movement
7. **task_20260401_dev_count_adjustment.md** - COUNT_ADJUSTMENT movement
8. **task_20260401_dev_warehouse_crud.md** - Warehouse management (owner)
9. **task_20260401_dev_item_crud.md** - Item/barcode management (owner)
10. **task_20260401_dev_bin_crud.md** - Bin/shelf management (owner)
11. **task_20260401_dev_export_inventory.md** - CSV inventory export
12. **task_20260401_dev_export_movements.md** - CSV movement audit log export

#### QA Phase

- **task_20260401_qa_warehouse.md** - 27 test scenarios (17 happy path + 10 error paths)

---

## Key Architectural Patterns

### Backend (Hono + Neon Postgres)

- Contract-first: Zod schemas → `/openapi.json` → frontend client generation
- Movements: Append-only audit log; balance always computed via SUM aggregation
- Authorization: Zod middleware, role-based checks via `requireRole(c, "owner")`
- No N+1: JOIN-based queries with aggregation

### Frontend (React SPA + TanStack Query)

- One query hook per domain (`useItem`, `useItems`, `useWarehouseInventory`)
- One mutation hook per command (`useAddMovement`, `useRemoveMovement`, etc.)
- Optimistic updates on forms
- Invalidation on mutations to keep cache fresh

### Database Layout

```
warehouses (id, name, use_bins)
items (id, name, description)
item_barcodes (id, item_id, barcode UNIQUE)
bins (id, warehouse_id, name)
movements (id, type, item_id, user_id, source_warehouse_id, source_bin_id, dest_warehouse_id, dest_bin_id, qty, note, timestamp)
```

Movement types: `ADD`, `REMOVE`, `TRANSFER`, `COUNT_ADJUSTMENT`, `MANUAL_ADJUSTMENT`

### Key Business Rules

1. Bins only exist if `warehouse.use_bins = true`
2. Movements are immutable (append-only)
3. Negative inventory allowed if Owner overrides
4. Balance = SUM(movements) per (item, warehouse, bin)
5. Barcodes are unique; one item can have many

---

## Next Steps

1. **Developer Pickup**: Agents start with DEV phase tasks in dependency order
   - Core visibility (search + item detail)
   - Core movements (add → remove → transfer → count)
   - Admin (warehouses → items → bins)
   - Exports

2. **Test-First**: Write test cases from QA task before implementation

3. **Deployment**:
   - Backend: Cloudflare Pages Functions (wrangler deploy)
   - Frontend: Cloudflare Pages (npm run build → deploy)
   - DB Migrations: `npm run db:generate && npm run db:migrate`
   - Frontend Client: `npm run generate-api` after backend changes

4. **Signoff**: Family team user acceptance testing (barcode scanning, end-to-end flows)

---

## Important Notes

- **Idempotency**: Movements tagged by (user, timestamp, item, source, qty) for duplicate prevention
- **CSV Export**: Use Papa Parse or native CSV builder; proper escaping required
- **Role Model**: Two roles: Owner (admin, override) + User (operations only)
- **Audit Trail**: Every movement is immutable; history never deleted
- **Scalability**: Two warehouses initially; design for adding more later

---

## Reference Materials

- **UserStories.md**: Raw requirements (7 epics, 12 user stories, 12 functional requirements)
- **.github/copilot-instructions.md**: Full architectural patterns & pitfalls
- **FRD.md** (if exists): Product functional design
