---
title: "[DEV] Unify Dev and Test Workflow Behind Makefile"
lane: todo
created: 2026-04-16T00:00:00Z
updated: 2026-04-16T00:00:00Z
description: Make Makefile the single canonical entrypoint for local development and database-backed tests, removing ambiguous parallel workflows and aligning Docker, Vitest, and migrations behind one runnable path.
labels:
  - platform-devx
sortOrder: 11
slug: unify_dev_test_workflow
---

## DFD Reference

**Flow**: N/A (Platform Dev/Test Harness)

**Related Files**:

- `Makefile`
- `docker-compose.yml`
- `warehouse-backend/package.json`
- `warehouse-backend/vitest.config.ts`
- `warehouse-backend/src/tests/setup.ts`
- `warehouse-backend/src/tests/helpers.ts`

---

## Context

The current developer workflow has multiple overlapping ways to run the system and tests:

1. `make dev` attempts to orchestrate local services.
2. `make test` and `make test-backend` use Docker Compose profiles.
3. `warehouse-backend/package.json` exposes `npm test`, which only runs `vitest run` and does not itself provision Postgres, migrations, or the proxy.
4. Test database lifecycle is partly handled by Docker Compose and partly handled by `clearDatabase()` in test helpers.
5. The current setup creates confusion about which command is authoritative and whether a test run is truly database-backed.

The goal is to make the workflow simple and explicit:

- **One canonical way to run local development**
- **One canonical way to run backend tests with a real database**
- **One canonical way to run full test suite from the repo root**
- **Makefile is the only supported entrypoint for orchestration**

---

## Problem Statement

Current workflow ambiguity makes the system harder to trust and maintain:

- `npm test` sounds canonical, but by itself it only invokes Vitest.
- Database-backed backend tests depend on external environment and Compose wiring that are not obvious from the backend package scripts.
- `make dev` currently mixes host-run and container-run processes, increasing fragility.
- Docker Compose location and invocation should be standardized so the same repo-level command always works.
- Test cleanup semantics need to be explicit: schema/migrations handled once per run, data cleanup handled per test.

---

## Desired Outcome

After this task:

1. `make dev` is the single documented and working local startup path.
2. `make test-backend` is the single documented and working backend test path, and it always runs against the intended test database.
3. `make test` is the single documented root-level test command.
4. Backend package scripts clearly separate:
   - pure test runner (`vitest`)
   - integration harness entrypoint if needed
   - migration/setup steps
5. Compose services, env files, and Make targets point at the same database-backed workflow with no duplicate or conflicting paths.
6. The test harness clearly defines responsibilities:
   - Compose provisions infrastructure
   - migrations prepare schema
   - test setup loads env/config only
   - test helpers clear data between tests

---

## Acceptance Criteria

- There is exactly one documented repo-root command for local development, and it works from a clean checkout.
- There is exactly one documented repo-root command for backend integration tests, and it uses the test database plus migrations automatically.
- `npm test` in the backend is either clearly scoped as a low-level runner or replaced with a less misleading script name.
- `Makefile` does not rely on ambiguous relative Compose invocation or split-brain orchestration between root and package directories.
- Docker Compose test services have a clear ownership model for migrations, seeding, waiting for readiness, and test execution.
- Test isolation rules are explicit and preserved: persistent container volume is acceptable only if data is cleaned deterministically between tests or runs.
- Documentation/comments in the harness are minimal but sufficient to explain the single supported path.

---

## Proposed Implementation Shape

### 1. Makefile as the sole orchestrator

- Normalize all dev/test commands around repo-root `make` targets.
- Ensure the Compose file path is explicit and consistent.
- Remove or reduce host/container split where it creates drift.

### 2. Clarify backend script intent

- Keep a low-level Vitest script only if it is intentionally non-canonical.
- Add or rename scripts so database-backed test flow is not confused with bare unit-style execution.
- Avoid duplicated migration logic across Makefile and Compose unless one layer is explicitly authoritative.

### 3. Simplify test infrastructure lifecycle

- Decide whether migrations happen in `test-runner`, `backend-test`, or a dedicated setup step.
- Avoid running setup in multiple places unless required.
- Keep database cleanup strategy explicit:
  - schema setup once per test run
  - data cleanup before each test via helpers

### 4. Align documentation with reality

- Update inline comments and any repo docs that describe dev/test commands.
- Ensure future contributors are pointed to `make dev`, `make test-backend`, and `make test` only.

---

## Risks / Questions to Resolve During Implementation

- Whether backend development should run on the host or inside Docker; the task should choose one canonical path instead of supporting both equally.
- Whether test seeding belongs in backend boot, test runner boot, or a dedicated one-shot container.
- Whether the root `docker-compose.yml` should remain the single Compose file for both dev and test profiles.
- Whether E2E should remain part of `make test` by default or be separated behind an explicit heavier target.

---

## Conversation

### user

just make a task to fix this thing

### agent

Created a platform task to unify the dev and test harness around a single Makefile-driven path. The task is scoped to remove ambiguous parallel workflows, make database-backed backend tests explicit, and standardize Compose plus migration responsibilities behind one canonical repo-root entrypoint.

### user
