---
title: "TODO - US-0.1 Access Password-Protected App Shell with Domain Side Menu"
lane: done
created: 2026-04-07T00:00:00Z
updated: 2026-04-18T00:00:00Z
---

# Iteration 1: Backend Auth Scaffold + Zod Schemas

## Backend Auth Routes (warehouse-backend/src/routes/auth.ts)

**New file — auth routes skeleton**

### Zod Schemas

- [x] `LoginRequest`: `{ password: string }` — min 8 chars, max 100
- [x] `LoginResponse`: `{ session_token: string, user: { id: string (UUID), role: 'owner' | 'user' } }`
- [x] `LogoutRequest`: (empty object)
- [x] `LogoutResponse`: `{ success: boolean }`
- [x] `SessionResponse`:
  - Authenticated: `{ authenticated: true, user: { id: string, role: 'owner' | 'user' } }`
  - Anonymous: `{ authenticated: false }`

### Route Definitions (using `createRoute` pattern)

- [x] **POST /api/auth/login**
  - Auth: None (public)
  - Request: `LoginRequest`
  - Response 200: `LoginResponse`
  - Tags: ["Auth"]
- [x] **GET /api/auth/session**
  - Auth: None (public endpoint checks session from cookie/header)
  - Response 200: `SessionResponse`
  - Tags: ["Auth"]
- [x] **POST /api/auth/logout**
  - Auth: None (session extracted if present)
  - Request: `LogoutRequest`
  - Response 200: `LogoutResponse`
  - Tags: ["Auth"]

### Router Setup

- [x] Create OpenAPIHono router
- [x] Register all three routes using `.openapi()` pattern
- [x] Export default router

### Handler Implementations (Step 2)

- [x] POST /login: Extract password → hash check → create session → return 200 + token
- [x] GET /session: Extract token from header/cookie → validate → return user or unauthenticated
- [x] POST /logout: Extract token → invalidate → return success

---

# Iteration 2: Auth Middleware & Session Storage

## Backend Authorization Middleware Updates

**File: warehouse-backend/src/authorization/middleware.ts**

- [x] Add `getSession(c)` function — extract session token from `Authorization: Bearer <token>` or `session_token` cookie
- [x] Add `setSessionCookie(c, token, expiresAt)` — helper to set httpOnly session cookie
- [x] Add middleware to attach session to context variables for protected routes

---

# Iteration 3: Frontend Session Hook

## useAuth Hook

**File: warehouse-frontend/src/hooks/useAuth.ts** (new file)

- [x] Query `GET /api/auth/session` on mount + on app focus
- [x] Return: `{ user: { id, role } | null, isLoading: boolean, isAuthenticated: boolean, logout: () => Promise<void> }`
- [x] Store session in Zustand store (see `useAuthStore` below)

**File: warehouse-frontend/src/stores/authStore.ts** (new file)

- [x] Zustand store with `{ user, setUser, clearUser }`
- [x] Persist to localStorage

---

# Iteration 4: Frontend Auth Components

## LoginPage

**File: warehouse-frontend/src/pages/LoginPage.tsx** (new file)

- [x] Single password input field
- [x] "Login" button
- [x] Show loading spinner on submit
- [x] Error message display (red text)
- [x] POST to `/api/auth/login` on form submit
- [x] On success: store token + redirect to `/dashboard`
- [x] On failure: display "Invalid password. Try again."
- [x] Enter key support (keyboard submit)
- [x] No session? Auto-show this page

## ProtectedRouteGuard

**File: warehouse-frontend/src/components/ProtectedRouteGuard.tsx** (new file)

- [x] Wrapper component checking `useAuth()`
- [x] If loading: show spinner
- [x] If not authenticated: redirect to `/login`
- [x] If authenticated: render children
- [x] Use in route setup to wrap protected routes

## AppLayout

**File: warehouse-frontend/src/pages/AppLayout.tsx** (new file)

- [x] Protected layout (wrapped in ProtectedRouteGuard)
- [x] Left sidebar: `<SideMenu />`
- [x] Top-right: `<UserMenu />`
- [x] Main content: `<Outlet />` (nested routing)
- [x] Flex layout: sidebar 250px fixed, content grows

## SideMenu

**File: warehouse-frontend/src/components/SideMenu.tsx** (new file)

- [x] Navigation list (6 items):
  1. Configuration → `/dashboard/configuration`
  2. Add Stock → `/dashboard/add`
  3. Remove Stock → `/dashboard/remove`
  4. Transfer Stock → `/dashboard/transfer`
  5. Quick Count → `/dashboard/quickcount`
  6. Inventory Visibility → `/dashboard/inventory`
- [x] Active link highlighting (bold or bg color)
- [x] Use `useLocation()` to detect current route

## UserMenu

**File: warehouse-frontend/src/components/UserMenu.tsx** (new file)

- [x] Display in top-right corner of AppLayout
- [x] Show user ID or role label
- [x] Dropdown with single "Logout" option
- [x] Click → show confirm dialog: "Are you sure you want to logout?"
- [x] Confirm → call `logout()` from useAuth
- [x] After logout: redirect to `/login`

---

# Iteration 5: Routing Setup

## App Router

**File: warehouse-frontend/src/App.tsx** (update)

- [x] Replace current simple render with React Router setup
- [x] Routes:
  - `/login` → `<LoginPage />`
  - `/dashboard` → `<AppLayout />` (protected)
    - `/dashboard/configuration` → "Coming Soon" placeholder
    - `/dashboard/add` → "Coming Soon" placeholder
    - `/dashboard/remove` → "Coming Soon" placeholder
    - `/dashboard/transfer` → "Coming Soon" placeholder
    - `/dashboard/quickcount` → "Coming Soon" placeholder
    - `/dashboard/inventory` → "Coming Soon" placeholder
  - `/` → redirect to `/dashboard` or `/login` based on auth

---

# Iteration 6: Testing

## Backend Integration Tests

**File: warehouse-backend/src/auth/tests/** (new folder structure)

- [x] `login.test.ts`:
  - Happy path: valid password → 200 + session_token + user
  - Error: invalid password → 401 + error message
  - Edge: empty password → 400
  - Edge: password < 8 chars → 400
- [x] `session.test.ts`:
  - Valid token → 200 + authenticated: true + user
  - Missing token → 200 + authenticated: false
  - Invalid token → 200 + authenticated: false (no error thrown)
- [x] `logout.test.ts`:
  - Valid token → 200 + success: true
  - Token invalidated → next session check returns authenticated: false

## E2E Tests

**File: warehouse-frontend/e2e/auth.spec.ts** (new file)

- [x] Happy path: Visit `/login` → enter password → click login → appears at `/dashboard` with menu visible
- [x] Error path: Wrong password → error displayed → can retry
- [x] Session recovery: Login → refresh page → still authenticated
- [x] Logout: Click logout → confirm → redirected to `/login` + session cleared

---

# Acceptance Criteria Checklist

## Protected Route Access

- [x] Unauthenticated user navigating to `/dashboard/*` redirects to `/login`
- [x] Login page is accessible at `/login` without authentication
- [x] After successful login, user can access `/dashboard` routes

## LoginPage Behavior

- [x] Displays password input field
- [x] Displays "Login" button
- [x] Shows loading spinner during request
- [x] On success: redirects to `/dashboard`
- [x] On failure: displays "Invalid password. Try again."
- [x] Enter key submits form

## AppLayout (Protected)

- [x] Displays when authenticated
- [x] Left sidebar contains SideMenu
- [x] Main content area renders child routes
- [x] Top-right corner contains UserMenu with logout

## SideMenu Navigation

- [x] Menu displays 6 items in correct order
- [x] Active route is highlighted
- [x] Clicking menu item routes to corresponding path
- [x] All routes are placeholder "Coming Soon" pages

## UserMenu & Logout

- [x] Top-right displays user ID or role label
- [x] Dropdown contains "Logout" option
- [x] Logout shows confirmation dialog
- [x] Confirming logout calls API, clears session, redirects to `/login`
- [x] Canceling dialog closes without action

## Session Persistence

- [x] Session token stored in httpOnly cookie
- [x] Page refresh verifies token via `GET /api/auth/session`
- [x] Valid token: user remains logged in
- [x] Invalid token: redirected to `/login`
