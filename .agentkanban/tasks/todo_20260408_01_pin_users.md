# todo_20260408_01_pin_users — PIN-Based Multi-User Auth

# Iteration 1

## Slice 1 — DB Schema & Migration

- [x] Add `users` table to `warehouse-backend/src/db/schema.ts`:
  - `id` uuid PK defaultRandom
  - `name` text NOT NULL
  - `pin_hash` text NOT NULL (bcrypt hash, cost 10)
  - `failed_attempts` integer NOT NULL DEFAULT 0
  - `locked_until` timestamp (nullable)
  - `role` text NOT NULL DEFAULT `'user'`
  - `created_at` timestamp defaultNow NOT NULL
  - No UNIQUE constraint on any column
- [ ] Run `npm run db:generate` in `warehouse-backend/`
- [ ] Run `npm run db:migrate` in `warehouse-backend/`
- [x] Verify migration SQL is created in `warehouse-backend/drizzle/`

## Slice 2 — Backend: Update `POST /api/auth/login`

- [x] In `warehouse-backend/src/routes/auth.ts`, replace `LoginRequest` with a `z.union([OwnerLoginRequest, UserLoginRequest])` schema
  - `OwnerLoginRequest`: `{ password: string min-8 max-100 }`
  - `UserLoginRequest`: `{ user_id: string uuid, pin: string /^\d{4}$/ }`
- [x] Add dispatch: if `'user_id' in body` → fetch user by `user_id`; if not found → `401`
- [x] Check lockout: if `locked_until > NOW()` → return `423 { error: "Account locked. Try again later." }`
- [x] bcrypt-compare `pin` against `pin_hash`; on mismatch: increment `failed_attempts`; if >= 5 set `locked_until = NOW() + 15min`; return `401`
- [x] On PIN match: reset `failed_attempts = 0`, `locked_until = NULL`; return session with `{ id, name, role: 'user' }`
- [x] Owner path (`'password' in body`) remains completely unchanged
- [x] Add `GET /api/users/names` public route (no auth): return `[{ id, name }]` ordered by name asc

## Slice 3 — Backend: New `/api/users` Route

- [x] Create `warehouse-backend/src/routes/users.ts`
- [x] `GET /names` (public, no auth) — return `[{ id, name }]` ordered by name (move from auth.ts or put here, mount before auth middleware)
- [x] `POST /` — validate `CreateUserRequest` (name + 4-digit pin), bcrypt-hash pin (cost 10), insert row, return user (no `pin_hash`)
- [x] `GET /` — return all users (id, name, role, failed_attempts, locked_until, created_at — no `pin_hash`)
- [x] `DELETE /:id` — delete user by UUID; `404` if not found
- [x] `PUT /:id/pin` — validate new 4-digit PIN, bcrypt-hash, update `pin_hash`; also reset `failed_attempts = 0`, `locked_until = NULL`; `404` if not found
- [x] `POST /:id/unlock` — reset `failed_attempts = 0`, `locked_until = NULL`; `404` if not found
- [x] Apply `requireOwner` middleware to all routes EXCEPT `GET /names`
- [x] Mount `/api/users` router in `warehouse-backend/src/app.ts`

## Slice 4 — Frontend: Update `LoginPage.tsx`

- [x] Add `mode: 'user' | 'owner'` state (default `'user'`)
- [ ] In `'user'` mode:
  - [x] `<select>` dropdown populated from `useUserNames()` (public GET /api/users/names); show "Select your name" as placeholder option
  - [x] 4-digit PIN input (`type="text"`, `maxLength={4}`, `inputMode="numeric"`)
  - [x] Validate: user selected + PIN exactly `/^\d{4}$/` before submit
  - [x] Send `{ user_id, pin }` to `POST /api/auth/login`
  - [x] On `423`: show "Account locked. Try again later."
  - [x] On `401`: show "Invalid PIN. Try again."
- [x] In `'owner'` mode: existing password input unchanged; on `401` show "Invalid password. Try again."
- [x] Toggle link below form: "Login as owner" / "Back to PIN login"
- [x] On success: store `session_token` + full `user` object (id, name, role) in Zustand store

## Slice 5 — Frontend: `useUsers.ts` Hook

- [x] Create `warehouse-frontend/src/hooks/queries/useUsers.ts`
- [x] `useUserNames()` — `useQuery(['userNames'], GET /api/users/names)` — no auth header (public)
- [x] `useUsers()` — `useQuery(['users'], GET /api/users)` with auth header
- [x] `useCreateUser()` — `useMutation(POST /api/users)`, on success invalidate `['users']`
- [x] `useDeleteUser()` — `useMutation(DELETE /api/users/:id)`, on success invalidate `['users']`
- [x] `useResetPin()` — `useMutation(PUT /api/users/:id/pin)`, on success invalidate `['users']`
- [x] `useUnlockUser()` — `useMutation(POST /api/users/:id/unlock)`, on success invalidate `['users']`

## Slice 6 — Frontend: `UsersPage.tsx`

- [x] Create `warehouse-frontend/src/pages/UsersPage.tsx`
- [x] Redirect to `/dashboard` if current user role is not `'owner'`
- [x] Display user list table: columns — Name, Created, Status (locked/active), Actions
- [ ] "Add User" button shows inline form: name input + PIN input (4 numeric digits)
  - [x] Client-side validation: name non-empty, PIN exactly `/^\d{4}$/`
  - [x] On success: close form, list refreshes via `useUsers`
- [x] "Delete" button per row → `window.confirm()` → `useDeleteUser()` mutation
- [x] "Reset PIN" button per row → `window.prompt('New 4-digit PIN:')` → validate → `useResetPin()` mutation
- [x] "Unlock" button per row — only shown when `locked_until` is in the future → `useUnlockUser()` mutation
- [x] Loading state while fetching; empty state message when no users
- [x] Register route `/dashboard/users` in `warehouse-frontend/src/App.tsx`

## Slice 7 — Frontend: SideMenu Update

- [x] In `warehouse-frontend/src/components/SideMenu.tsx`, read `user.role` from auth store
- [x] Add "Users" menu item pointing to `/dashboard/users` as the first item in the list
- [x] Conditionally render "Users" only when `user?.role === 'owner'`
- [x] Verify active-link highlighting applies to the Users route

## Testing

- [x] Write backend integration tests in `warehouse-backend/src/tests/` covering:
  - [x] `GET /api/users/names` — returns array without auth
  - [x] `POST /api/auth/login` with `{ user_id, pin }` — success, wrong PIN `401`, 5 wrong PINs → `423`, correct PIN after unlock→ `200`
  - [x] `POST /api/auth/login` with `{ password }` — owner success, wrong password `401`
  - [x] `POST /api/users` — create success, non-owner `403`
  - [x] `GET /api/users` — owner gets list, non-owner `403`
  - [x] `DELETE /api/users/:id` — success, not found `404`, non-owner `403`
  - [x] `PUT /api/users/:id/pin` — success resets lockout, not found `404`, non-owner `403`
  - [x] `POST /api/users/:id/unlock` — success, not found `404`, non-owner `403`
- [x] Write E2E test in `warehouse-frontend/e2e/`:
  - [x] Owner logs in (password) → opens Users page → creates user "Alice" PIN "1234" → logs out
  - [x] Login page shows dropdown with "Alice" → select Alice → enter PIN "1234" → dashboard renders → "Users" menu item is absent
