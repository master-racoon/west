---
title: "[DEV] US-0.2 PIN-Based Multi-User Auth with Owner User Management"
lane: done
created: 2026-04-08T00:00:00Z
updated: 2026-04-18T09:03:38.055Z
description: Add a users table and 4-digit PIN login for personal user accounts. Owner login remains env-based (APP_PASSWORD) for.
labels:
  - platform-auth
sortOrder: 1
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
3. `POST /api/auth/login` extended to accept both `{ password }` (owner admin path) and `{ user_id, pin }` (personal user path, bcrypt lookup with brute-force protection).
4. Five owner-only `/api/users` endpoints for user CRUD, PIN reset, and manual unlock.
5. Drizzle migration generated and applied.
6. `LoginPage.tsx` updated: user mode shows a name `<select>` (from `GET /api/users/names`) + 4-digit PIN input; toggle switches to owner password input.
7. New `UsersPage.tsx` (owner-only) at `/dashboard/users`.
8. "Users" entry added to `SideMenu` (owner-only, first item, hidden for role `'user'`).
9. New TanStack Query hook `useUsers.ts` (including public `useUserNames()`).
10. Shared owner login explicitly treated as an administration-only identity, not a stock-movement identity.

**Design constraints**:

- No email, no password-reset flows — family-team app.
- PIN is 4 decimal digits (`/^\d{4}$/`). Non-unique PINs are allowed — user is identified by UUID from the dropdown, not by PIN alone.
- Owner identity is env-based only; the `users` table only holds role `'user'` rows.
- Shared owner login is for administration only. It can manage users and configuration, but it must not be used for add/remove/transfer/count inventory actions.
- Every inventory movement must be attributable to a personal PIN-backed user row (`users.id` UUID). If an owner also needs to move stock, they must sign in with their own personal user account.
- When the shared owner account is blocked from a movement flow, the message must be explicit: `Inventory movements require a personal user account. Sign out of the owner account and sign in with your own PIN.`
- bcrypt cost factor: 10.
- Brute-force protection: lock account for 15 minutes after 5 consecutive wrong PIN attempts.

**Downstream policy impact**:

- Existing and future movement routes/pages must treat `role === 'owner'` as admin-only and reject movement writes with the explicit message above.
- This auth ticket establishes the identity model; movement-task tickets must enforce the restriction in both backend authorization and frontend navigation/UX.

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
  - If `'password' in body` → owner path: compare against `APP_PASSWORD` env var, return `{ session_token, user: { id: 'owner-user', role: 'owner' } }`. This shared owner identity is administration-only and must not be accepted by movement flows.
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

- **Response on failure**:
  - Owner wrong password → `401` with `{ error: "Incorrect owner password." }`
  - Wrong PIN / stale `user_id` → `401` with `{ error: "Incorrect PIN." }`
- **Error cases**:
  - `user_id` not found → `401` with `{ error: "Incorrect PIN." }`
  - Wrong PIN → `401` with `{ error: "Incorrect PIN." }` (+ lockout tracking)
  - Account locked → `423` with `{ error: "Account locked. Ask an owner to unlock it or try again in 15 minutes." }`
  - Malformed body (neither `password` nor `user_id`+`pin`) → `400` with `{ error: "Choose owner password login or user PIN login." }`

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

- Add `users` table exactly as above. Do not add a plaintext `pin` column or any uniqueness constraint on PIN data.
- Run `npm run db:generate` and `npm run db:migrate`.

### Slice 2 — Backend Auth Route Update

File: `warehouse-backend/src/routes/auth.ts`

- Replace `LoginRequest` Zod schema with `z.union([OwnerLoginRequest, UserLoginRequest])`.
- Add dispatch: if `'user_id' in body` → query `users` by `user_id`, compare the submitted PIN against that row's `pin_hash`, then apply lockout rules.
- Owner path remains env-password based, but the returned owner session must be treated as admin-only by downstream movement flows.

### Slice 3 — Backend `/api/users` Route

File: `warehouse-backend/src/routes/users.ts` (new file)

- `POST /` — create user (hash PIN, insert, return user without `pin_hash`).
- `GET /` — list users.
- `DELETE /:id` — delete user.
- `PUT /:id/pin` — reset PIN (rehash and update `pin_hash`; also clear lockout state).
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
- Owner mode includes helper copy that it is for administration only; stock movements require a personal PIN-backed user account.
- Send `{ password }` or `{ user_id, pin }` accordingly.
- On `423`: show "Account locked. Ask an owner to unlock it or try again in 15 minutes."
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
  - On submit: `useCreateUser()` mutation; show inline validation/server error message.
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
13. `PUT /api/users/:id/pin` with the same PIN as another user remains allowed because PIN uniqueness is not enforced.
14. Any movement-writing route that receives the shared owner session is rejected with `403` and `{ error: "Inventory movements require a personal user account. Sign out of the owner account and sign in with your own PIN." }`.

### Frontend

15. `LoginPage` defaults to PIN mode; dropdown populated from `GET /api/users/names`.
16. Owner toggle switches to password input.
17. Owner mode explicitly says the shared owner login is for administration only and that stock movements require a personal user account.
18. PIN input accepts only 4 numeric digits (validation before submit).
19. Locked account shows "Account locked. Ask an owner to unlock it or try again in 15 minutes."
20. On PIN login success, Zustand store holds `{ id, name, role: 'user' }`.
21. "Users" menu item visible for owner, hidden for role `'user'`.
22. `UsersPage` lists users; "Add User" form creates a user and refreshes list.
23. "Delete" with confirm removes user from list.
24. "Reset PIN" prompts for new PIN, updates successfully.
25. "Unlock" button appears for locked users, resets `failed_attempts`.
26. Movement entry points elsewhere in the UI must not treat the shared owner session as an operator identity; if shown at all, they must surface the same explicit admin-only message.

### E2E

27. Owner logs in (password) → login UI shows admin-only helper text → navigates to Users → creates user (name="Alice", PIN="1234") → logs out → login dropdown shows "Alice" → enters PIN "1234" → dashboard renders → "Users" menu item is absent.
28. Shared owner session attempting to enter a movement flow is blocked with `Inventory movements require a personal user account. Sign out of the owner account and sign in with your own PIN.`

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

I want some changes: the error from the internal message to be clearer, and basically the owner cannot make movements, it needs to be a user with a personal account, not a shared owner account

### agent

Updated the rest of this ticket to reflect those two changes.

- The shared owner login is now explicitly administration-only throughout the description, constraints, auth contract, and acceptance criteria. The ticket now states that inventory movements must always come from a personal PIN-backed user account, never the shared owner account.
- I added the explicit downstream rule and error text for movement flows: `Inventory movements require a personal user account. Sign out of the owner account and sign in with your own PIN.`
- I also clarified the auth error wording in the contract and UI notes so the messages are specific instead of generic.
- While touching the ticket, I cleaned up a few internal contradictions so it consistently says PINs are non-unique and only `pin_hash` is stored.

This keeps the auth task aligned with personal accountability for stock movements while preserving the shared owner login for administration.

### user

Implement the Kanban task at /Users/ulf/Documents/GitHub/west/.agentkanban/tasks/task_20260408_01_pin_users.md using the checklist in /Users/ulf/Documents/GitHub/west/.agentkanban/tasks/todo_20260408_01_pin_users.md.

### agent

Implemented the remaining auth and movement-accountability work for this ticket.

- Backend: tightened auth error wording, returned `423` on the fifth wrong PIN attempt, and blocked the shared owner session from all movement-writing inventory routes with the explicit personal-account error.
- Frontend: switched `LoginPage` to the shared `useUserNames()` query, added the administration-only owner helper copy, and blocked owner sessions from the inventory workspace with the same explicit message while keeping owner-only user management intact.
- Tests: added backend integration coverage for PIN auth and `/api/users` management plus a Playwright spec for owner user-creation, PIN login, and the owner movement block.
- Checklist: marked the implemented slices complete; command-execution items remain for local verification where available.

### user
