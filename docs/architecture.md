# Architecture Reference

This document explains how local development, tests, and deployment fit together in the `west` workspace, with a focus on environment files and config files.

## 1) System Shape

- **Backend**: `warehouse-backend/` runs a Hono API on Cloudflare Pages Functions (`wrangler pages dev`).
- **Frontend**: `warehouse-frontend/` runs a Vite React app and calls backend routes through `/api` proxying.
- **Database (local dev)**: Postgres in Docker + local Neon HTTP proxy.
- **Database (prod)**: Neon connection string provided as Cloudflare secret/binding.

## 2) Runtime Flow (Local Dev)

`make dev` (from repo root) orchestrates:

1. Start `warehouse-backend/docker-compose.yml` (Postgres + Neon proxy)
2. Start backend (`warehouse-backend` → `npm run dev` → Wrangler on `:8788`)
3. Start frontend (`warehouse-frontend` → `npm run dev` → Vite on `:5173`)

Request path in browser:

- Browser -> `http://localhost:5173`
- Frontend API call -> `/api/...`
- Vite proxy (`warehouse-frontend/vite.config.ts`) forwards `/api` to `http://localhost:8788`
- Backend route handlers use Drizzle + Neon serverless client
- Neon HTTP client goes through local proxy (`db.localtest.me:4444`) -> Postgres container (`:5432`)

## 3) Environment Files: What Uses What

## Backend env files

| File                                  | Used by                              | Purpose                                                                |
| ------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------- |
| `warehouse-backend/.dev.vars`         | `wrangler pages dev` (`npm run dev`) | Runtime env for backend in local development (Workers-style bindings). |
| `warehouse-backend/.dev.vars.example` | Humans / setup                       | Template for creating `.dev.vars` in new environments.                 |
| `warehouse-backend/.env.local`        | `npm run db:migrate`                 | Direct Postgres URL for migrations (postgres wire protocol).           |
| `warehouse-backend/.env`              | Optional/manual use                  | General local env file; not the primary source for Wrangler runtime.   |

### Why two DB URLs in dev?

- **Backend runtime** (`.dev.vars`): uses Neon-style HTTP proxy URL (`db.localtest.me:4444`) because app DB access uses `@neondatabase/serverless`.
- **Migrations** (`.env.local`): uses direct Postgres URL (`localhost:5432`) because migration script uses `postgres` driver.

## Test-related env files

Root `docker-compose.yml` references:

- `warehouse-backend/.env.test`
- `warehouse-backend/.dev.vars.test`

These are intended for test/e2e container runs (`make test`, `make test-e2e`). If missing, test profile startup will fail until they are created.

## 4) Config Files and Responsibilities

## Orchestration

- `Makefile`
  - `make dev`: local app stack (backend docker + backend dev server + frontend dev server)
  - `make test`, `make test-backend`, `make test-e2e`: containerized test stack
  - `make deploy*`: deploy entry points

- `warehouse-backend/docker-compose.yml`
  - Local development data services
  - `postgres` (dev DB)
  - `neon-proxy` (local Neon HTTP bridge)

- `docker-compose.yml` (repo root)
  - Isolated test/e2e topology via profiles
  - `postgres-test`, `neon-proxy-test`, `backend-test`, `frontend-test`, runners

## Backend runtime/build

- `warehouse-backend/wrangler.toml`
  - Cloudflare Pages Functions config
  - Compatibility flags, bindings, vars, limits

- `warehouse-backend/wrangler.scheduler.toml`
  - Separate scheduled worker config (cron-based)

- `warehouse-backend/drizzle.config.ts`
  - Drizzle migration generation config

- `warehouse-backend/src/db/migrate.ts`
  - Migration executor; reads env file argument (defaults to `.env.local`)

- `warehouse-backend/package.json`
  - `dev`, `build`, `deploy`, `db:*`, `test` scripts

## Frontend runtime/build

- `warehouse-frontend/vite.config.ts`
  - Dev server on `:5173`
  - `/api` proxy target -> `http://localhost:8788`
  - Build chunking strategy

- `warehouse-frontend/package.json`
  - `dev`, `build`, `generate-api`, `test:e2e`

## 5) Command-to-Config Mapping

| Command                                      | Reads env/config from                                                                                                                                            |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `make dev`                                   | Root `Makefile`, then `warehouse-backend/docker-compose.yml`, backend `package.json` + `wrangler.toml` + `.dev.vars`, frontend `package.json` + `vite.config.ts` |
| `cd warehouse-backend && npm run dev`        | `wrangler.toml` + `.dev.vars`                                                                                                                                    |
| `cd warehouse-backend && npm run db:migrate` | `src/db/migrate.ts` + `.env.local`                                                                                                                               |
| `make test` / `make test-e2e`                | Root `docker-compose.yml` profiles + test env files (`.env.test`, `.dev.vars.test`)                                                                              |
| `cd warehouse-backend && npm run deploy`     | `wrangler.toml` + Cloudflare secrets/vars                                                                                                                        |

## 6) Practical Setup Checklist

1. Create backend runtime env from template:
   - copy `.dev.vars.example` -> `.dev.vars`
2. Ensure migration env exists:
   - `.env.local` with direct Postgres URL
3. Start stack:
   - `make dev`
4. Run migrations when schema changes:
   - `cd warehouse-backend && npm run db:generate && npm run db:migrate`
5. For containerized tests, ensure test env files exist:
   - `.env.test` and `.dev.vars.test`

## 7) Notes

- In route handlers, use `c.env.*` (Workers bindings model), not `process.env`.
- Keep migration connectivity and runtime connectivity separate (direct Postgres vs Neon HTTP proxy).
- If `/api` calls fail from frontend, verify Vite proxy target in `warehouse-frontend/vite.config.ts` and backend server on `:8788`.
