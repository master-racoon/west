# Warehouse

Barcode-driven inventory management system. Track items across two warehouses (A & B), record every movement, manage bins/shelves, and optimize for fast scanning workflows.

## Quick Start

```bash
# Install dependencies
cd warehouse-backend && npm install
cd ../warehouse-frontend && npm install

# Start all services (docker, backend, frontend)
make dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:8788

## Architecture

- **Backend**: Cloudflare Pages Functions + Hono API + Neon Postgres
- **Frontend**: React SPA + TanStack Query + Zustand + Cloudflare Pages
- **Auth**: BetterAuth (email/password)

See `.github/copilot-instructions.md` for detailed architecture.

## Development

```bash
make dev          # Start all services
make backend      # Backend only
make frontend     # Frontend only
make stop         # Stop all services
make clean        # Stop and clean volumes
```

## Testing

Comprehensive test suite with backend API tests (Vitest) and frontend E2E tests (Playwright). All tests run in isolated Docker environments with auto-seeded test data.

```bash
make test              # Run all tests
make test-backend      # Backend unit tests
make test-e2e          # E2E tests
```

Tests run in isolated Docker containers with their own database and automatically seeded test users. See [TESTING.md](./TESTING.md) for detailed testing guide.

## Project Structure

```
warehouse/
├── warehouse-backend/         # Hono API
│   ├── src/
│   │   ├── app.ts            # Hono app + middleware
│   │   ├── db/
│   │   │   └── schema.ts      # Drizzle ORM schema
│   │   ├── routes/            # API endpoints
│   │   ├── authorization/     # Auth middleware
│   │   └── utils/
│   ├── wrangler.toml          # Cloudflare Workers config
│   └── package.json
├── warehouse-frontend/        # React SPA
│   ├── src/
│   │   ├── pages/             # Route-level components
│   │   ├── components/        # Reusable components
│   │   ├── hooks/queries/     # TanStack Query hooks
│   │   ├── stores/            # Zustand stores
│   │   └── generated-api/     # Auto-generated client
│   └── package.json
├── FRD.md                      # Functional requirements
├── CLAUDE.md                   # AI instructions
└── docker-compose.yml          # Docker services
```

## Rapid Development Workflow

1. **Define backend schema** in `warehouse-backend/src/db/schema.ts`
2. **Generate migration**: `cd warehouse-backend && npm run db:generate`
3. **Apply migration locally**: `npm run db:migrate`
4. **Define routes** in `warehouse-backend/src/routes/`
5. **Generate API client**: `cd warehouse-frontend && npm run generate-api`
6. **Build UI** with auto-typed hooks and components
