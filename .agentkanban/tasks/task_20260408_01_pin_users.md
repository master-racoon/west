---
title: "[DEV] US-0.2 PIN-Based Multi-User Auth with Owner User Management"
lane: done
created: 2026-04-08T00:00:00Z
updated: 2026-04-13T14:41:22.884Z
description: Add a users table and 4-digit PIN login for regular users. Owner login remains env-based (APP_PASSWORD). Owner can create, list, delete users, reset their PINs, and unlock accounts via /api/users endpoints and a UsersPage in the frontend.
labels:
  - platform-auth
sortOrder: 1.5
slug: pin_users
---

## DFD Reference

**Flow**: N/A (Platform Auth Extension — non-DFD enabler)

**Depends on**: `task_20260404_00_appshell_login` (authenticated app shell must exist)

**Related Document**: [Functional Requirements § 1) Authentication & App Shell](../../../../docs/functional_requirements.md#1-authentication--app-shell)

---

## Context

Current system uses a single shared `APP_PASSWORD` env var. Sessions held in an in-memory `Map<token, { id, role }>`. There is no `users` table.

This task introduces:

1. A `users` DB table (id, name, pin_hash, failed_attempts, locked_until, role, created_at).
2. `GET /api/users/names` — public endpoint returning `[{ id, name }]` for the login dropdown.
3. `POST /api/auth/login` extended to accept both `{ password }` (owner path, unchanged) and `{ user_id, pin }` (user path, bcrypt lookup with brute-force protection).
4. Five owner-only `/api/users` endpoints for user CRUD, PIN reset, and manual unlock.
5. Drizzle migration generated and applied.
6. `LoginPage.tsx` updated: user mode shows a name `<select>` (from `GET /api/users/names`) + 4-digit PIN input; toggle switches to owner password input.
7. New `UsersPage.tsx` (owner-only) at `/dashboard/users`.
8. "Users" entry added to `SideMenu` (owner-only, first item, hidden for role `'user'`).
9. New TanStack Query hook `useUsers.ts` (including public `useUserNames()`).

**Design constraints**:

- No email, no password-reset flows — family-team app.
- PIN is 4 decimal digits (`/^\d{4}$/`). Non-unique PINs are allowed — user is identified by UUID from the dropdown, not by PIN alone.
- Owner identity is env-based only; the `users` table only holds role `'user'` rows.
- bcrypt cost factor: 10.
- Brute-force protection: lock account for 15 minutes after 5 consecutive wrong PIN attempts.

---

## Data Contracts

### 1. DB Schema Addition

**Table: `users`** — add to `warehouse-backend/src/db/schema.ts`

```typescript
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  pin_hash: text("pin_hash").notNull(), // bcrypt hash, cost 10
  failed_attempts: integer("failed_attempts").notNull().default(0),
  locked_until: timestamp("locked_until"), // NULL = not locked
  role: text("role").notNull().default("user"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});
```

No UNIQUE constraint on `pin_hash`. No plaintext pin column. PINs are non-unique — login identity comes from `user_id`.

---

### 2. Public: `GET /api/users/names`

- **Auth**: None (public) — returns only non-sensitive display data for login dropdown
- **Response** (status `200`):

```typescript
const UserNamesResponse = z.array(
  z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
);
```

- Ordered by `name` ascending.
- Used to populate the login dropdown.

---

### 3. Updated: `POST /api/auth/login`

- **Auth**: None (public)
- **Breaking change to request schema only** — owner path behaviour is completely unchanged.
- **Request Zod Schema** `LoginRequest` (union):

```typescript
const OwnerLoginRequest = z.object({
  password: z.string().min(8).max(100),
});

const UserLoginRequest = z.object({
  user_id: z.string().uuid(),
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
});

const LoginRequest = z.union([OwnerLoginRequest, UserLoginRequest]);
```

- **Dispatch logic**:
  - If `'password' in body` → owner path: compare against `APP_PASSWORD` env var, return `{ session_token, user: { id: 'owner-user', role: 'owner' } }` (existing code, no change).
  - If `'user_id' in body` → user path: fetch user by `user_id`, check lockout (`locked_until > NOW()` → `423 Locked`), bcrypt-compare `pin` against `pin_hash`. On mismatch: increment `failed_attempts`; if >= 5 set `locked_until = NOW() + 15min`; return `401`. On match: reset `failed_attempts = 0`, `locked_until = NULL`, return session.
- **Response on success** (both paths):

```typescript
const LoginResponse = z.object({
  session_token: z.string(),
  user: z.object({
    id: z.string().uuid().or(z.literal("owner-user")),
    name: z.string().optional(), // absent for owner
    role: z.enum(["owner", "user"]),
  }),
});
```

- **Response on failure**: `{ error: "Invalid credentials" }` status `401`.
- **Error cases**:
  - `user_id` not found → `401`
  - Wrong PIN → `401` (+ lockout tracking)
  - Account locked → `423` with `{ error: "Account locked. Try again later." }`
  - Malformed body (neither `password` nor `user_id`+`pin`) → `400`

---

### 4. New: `POST /api/users` (owner-only)

- **Auth**: Owner session required (middleware `requireOwner`)
- **Request Zod Schema**:

```typescript
const CreateUserRequest = z.object({
  name: z.string().min(1).max(100),
  pin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/),
});
```

- **Response** (status `201`):

```typescript
const CreateUserResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  role: z.literal("user"),
  created_at: z.string().datetime(),
});
```

- **Errors**: `400` validation, `403` non-owner.

---

### 5. New: `GET /api/users` (owner-only)

- **Auth**: Owner session required
- **Response** (status `200`):

```typescript
const ListUsersResponse = z.array(
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    role: z.literal("user"),
    failed_attempts: z.number(),
    locked_until: z.string().datetime().nullable(),
    created_at: z.string().datetime(),
  }),
);
```

---

### 6. New: `DELETE /api/users/:id` (owner-only)

- **Auth**: Owner session required
- **Response** (status `200`): `{ success: true }`
- **Errors**: `403` non-owner, `404` not found.

---

### 7. New: `PUT /api/users/:id/pin` (owner-only)

- **Auth**: Owner session required
- **Request Zod Schema**:

```typescript
const ResetPinRequest = z.object({
  pin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/),
});
```

- **Response** (status `200`): `{ success: true }` — also resets `failed_attempts = 0` and `locked_until = NULL`.
- **Errors**: `400` validation, `403` non-owner, `404` not found.

---

### 8. New: `POST /api/users/:id/unlock` (owner-only)

- **Auth**: Owner session required
- **Response** (status `200`): `{ success: true }` — resets `failed_attempts = 0`, `locked_until = NULL`.
- **Errors**: `403` non-owner, `404` not found.

---

## Vertical Slice (DB → API → UI)

### Slice 1 — DB + Migration

File: `warehouse-backend/src/db/schema.ts`

- Add `users` table as above (with `pin` unique column + `pin_hash`).
- Run `npm run db:generate` and `npm run db:migrate`.

### Slice 2 — Backend Auth Route Update

File: `warehouse-backend/src/routes/auth.ts`

- Replace `LoginRequest` Zod schema with `z.union([OwnerLoginRequest, UserLoginRequest])`.
- Add dispatch: if `'pin' in body` → query `users` table, iterate bcrypt comparisons, return session on match.
- Owner path: unchanged.

### Slice 3 — Backend `/api/users` Route

File: `warehouse-backend/src/routes/users.ts` (new file)

- `POST /` — create user (hash PIN, insert, return user without `pin_hash`).
- `GET /` — list users.
- `DELETE /:id` — delete user.
- `PUT /:id/pin` — reset PIN (rehash, update both `pin` and `pin_hash`).
- Mount at `/api/users` in `warehouse-backend/src/app.ts` behind `requireOwner` middleware.

### Slice 4 — Frontend LoginPage Update

File: `warehouse-frontend/src/pages/LoginPage.tsx`

- Add `mode` state: `'owner' | 'user'`, defaulting to `'user'`.
- Render:
  - In `'owner'` mode: existing password input + "Login" button (existing code path, unchanged).
  - In `'user'` mode:
    - `<select>` dropdown populated from `GET /api/users/names` (useQuery, public endpoint).
    - 4-digit PIN input (`type="text"` `maxLength={4}` `inputMode="numeric"`).
    - "Login" button.
- Toggle link: "Login as owner" / "Back to PIN login" below the form.
- Send `{ password }` or `{ user_id, pin }` accordingly.
- On `423`: show "Account locked. Try again later."
- Store `session_token` + `user` (id, name, role) in Zustand store.

### Slice 5 — Frontend `useUsers.ts` Hook

File: `warehouse-frontend/src/hooks/queries/useUsers.ts` (new file)

```typescript
// hooks exported:
export function useUserNames(); // GET /api/users/names (public, no auth)
export function useUsers(); // GET /api/users (owner-only)
export function useCreateUser(); // POST /api/users — returns UseMutationResult
export function useDeleteUser(); // DELETE /api/users/:id — returns UseMutationResult
export function useResetPin(); // PUT /api/users/:id/pin — returns UseMutationResult
export function useUnlockUser(); // POST /api/users/:id/unlock — returns UseMutationResult
```

- Invalidate `['users']` query key on create/delete/reset.
- Use `api` helper from `warehouse-frontend/src/lib/api.ts`.

### Slice 6 — Frontend `UsersPage.tsx`

File: `warehouse-frontend/src/pages/UsersPage.tsx` (new file)

- Route: `/dashboard/users` (owner-only; redirect to `/dashboard` if `role !== 'owner'`).
- Displays user list table: name, created_at, actions column.
- "Add User" button opens inline form (or simple modal): name input + 4-digit PIN input.
  - Validation: name non-empty, PIN exactly 4 digits.
  - On submit: `useCreateUser()` mutation; show inline error on conflict.
- Per-row "Delete" button → `confirm()` dialog → `useDeleteUser()` mutation.
- Per-row "Reset PIN" button → `prompt()` for new PIN → `useResetPin()` mutation.
- Loading and empty states.

### Slice 7 — SideMenu Update

File: `warehouse-frontend/src/components/SideMenu.tsx`

- Add "Users" entry pointing to `/dashboard/users`.
- Position: first item (before Configuration), as instructed.
- Conditionally render: only when `user.role === 'owner'`.
- Active route highlight: same as existing items.

---

## Acceptance Criteria

### Backend

1. `GET /api/users/names` → `200` array of `{ id, name }` (public, no auth).
2. `POST /api/auth/login` with `{ user_id, pin: "1234" }` (correct PIN) → `200` with session + user (name, role `'user'`).
3. `POST /api/auth/login` with `{ user_id, pin: "0000" }` (wrong PIN) → `401`; after 5 attempts → `423`.
4. `POST /api/auth/login` with `{ password: "<APP_PASSWORD>" }` → unchanged `200` owner session.
5. `POST /api/auth/login` with neither field → `400`.
6. `POST /api/users` as owner → `201`, user in DB (pin_hash not returned).
7. `POST /api/users` as non-owner → `403`.
8. `GET /api/users` as owner → `200` array of users (no `pin_hash`/`pin`).
9. `GET /api/users` as non-owner → `403`.
10. `DELETE /api/users/:id` as owner for existing user → `200 { success: true }`, row gone.
11. `DELETE /api/users/:id` for unknown id → `404`.
12. `PUT /api/users/:id/pin` with valid new PIN → `200 { success: true }`, new PIN authenticates.
13. `PUT /api/users/:id/pin` with duplicate PIN → `409`.

### Frontend

14. `LoginPage` defaults to PIN mode; dropdown populated from `GET /api/users/names`.
15. Owner toggle switches to password input.
16. PIN input accepts only 4 numeric digits (validation before submit).
17. Locked account shows "Account locked. Try again later."
18. On PIN login success, Zustand store holds `{ id, name, role: 'user' }`.
19. "Users" menu item visible for owner, hidden for role `'user'`.
20. `UsersPage` lists users; "Add User" form creates a user and refreshes list.
21. "Delete" with confirm removes user from list.
22. "Reset PIN" prompts for new PIN, updates successfully.
23. "Unlock" button appears for locked users, resets `failed_attempts`.

### E2E

24. Owner logs in (password) → navigates to Users → creates user (name="Alice", PIN="1234") → logs out → login dropdown shows "Alice" → enters PIN "1234" → dashboard renders → "Users" menu item is absent.

---

## Conversation

### user

Create a new kanban task for adding PIN-based multi-user auth to the warehouse inventory system.

### agent

Task created as `task_20260408_01_pin_users.md`. See todo file at `todo_20260408_01_pin_users.md` for actionable implementation checklist.

**Summary of design captured (updated after discussion):**

- Owner auth: unchanged env-based `APP_PASSWORD` path.
- User auth: name dropdown (from public `GET /api/users/names`) + 4-digit PIN. Login sends `{ user_id, pin }`. PINs are non-unique.
- Brute-force protection: 5 wrong PINs → account locked 15 min. Owner can manually unlock.
- Backend: `users` table (with `failed_attempts`, `locked_until`) + extended `POST /api/auth/login` + five owner-only `/api/users` endpoints (including unlock).
- Frontend: name dropdown + PIN in user mode, password in owner mode on `LoginPage`. New `UsersPage` with unlock button for locked accounts. Owner-gated "Users" side menu item. `useUsers` hook with `useUserNames()` (public).
- Supersedes `task_20260408_00_signup.md` (email/password approach).

### user
