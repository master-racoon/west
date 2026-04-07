---
title: "TODO - US-0.1 Access Password-Protected App Shell with Domain Side Menu"
lane: doing
created: 2026-04-07T00:00:00Z
updated: 2026-04-07T00:00:00Z
---

# Iteration 1: Backend Auth Scaffold + Zod Schemas

## Backend Auth Routes (warehouse-backend/src/routes/auth.ts)

**New file — auth routes skeleton**

### Zod Schemas

- [ ] `LoginRequest`: `{ password: string }` — min 8 chars, max 100
- [ ] `LoginResponse`: `{ session_token: string, user: { id: string (UUID), role: 'owner' | 'user' } }`
- [ ] `LogoutRequest`: (empty object)
- [ ] `LogoutResponse`: `{ success: boolean }`
- [ ] `SessionResponse`:
  - Authenticated: `{ authenticated: true, user: { id: string, role: 'owner' | 'user' } }`
  - Anonymous: `{ authenticated: false }`

### Route Definitions (using `createRoute` pattern)

- [ ] **POST /api/auth/login**
  - Auth: None (public)
  - Request: `LoginRequest`
  - Response 200: `LoginResponse`
  - Tags: ["Auth"]
- [ ] **GET /api/auth/session**
  - Auth: None (public endpoint checks session from cookie/header)
  - Response 200: `SessionResponse`
  - Tags: ["Auth"]
- [ ] **POST /api/auth/logout**
  - Auth: None (session extracted if present)
  - Request: `LogoutRequest`
  - Response 200: `LogoutResponse`
  - Tags: ["Auth"]

### Router Setup

- [ ] Create OpenAPIHono router
- [ ] Register all three routes using `.openapi()` pattern
- [ ] Export default router

### Handler Implementations (Step 2)

- [ ] POST /login: Extract password → hash check → create session → return 200 + token
- [ ] GET /session: Extract token from header/cookie → validate → return user or unauthenticated
- [ ] POST /logout: Extract token → invalidate → return success

---

# Iteration 2: Auth Middleware & Session Storage

## Backend Authorization Middleware Updates

**File: warehouse-backend/src/authorization/middleware.ts**

- [ ] Add `getSession(c)` function — extract session token from `Authorization: Bearer <token>` or `session_token` cookie
- [ ] Add `setSessionCookie(c, token, expiresAt)` — helper to set httpOnly session cookie
- [ ] Add middleware to attach session to context variables for protected routes

---

# Iteration 3: Frontend Session Hook

## useAuth Hook

**File: warehouse-frontend/src/hooks/useAuth.ts** (new file)

- [ ] Query `GET /api/auth/session` on mount + on app focus
- [ ] Return: `{ user: { id, role } | null, isLoading: boolean, isAuthenticated: boolean, logout: () => Promise<void> }`
- [ ] Store session in Zustand store (see `useAuthStore` below)

**File: warehouse-frontend/src/stores/authStore.ts** (new file)

- [ ] Zustand store with `{ user, setUser, clearUser }`
- [ ] Persist to localStorage

---

# Iteration 4: Frontend Auth Components

## LoginPage

**File: warehouse-frontend/src/pages/LoginPage.tsx** (new file)

- [ ] Single password input field
- [ ] "Login" button
- [ ] Show loading spinner on submit
- [ ] Error message display (red text)
- [ ] POST to `/api/auth/login` on form submit
- [ ] On success: store token + redirect to `/dashboard`
- [ ] On failure: display "Invalid password. Try again."
- [ ] Enter key support (keyboard submit)
- [ ] No session? Auto-show this page

## ProtectedRouteGuard

**File: warehouse-frontend/src/components/ProtectedRouteGuard.tsx** (new file)

- [ ] Wrapper component checking `useAuth()`
- [ ] If loading: show spinner
- [ ] If not authenticated: redirect to `/login`
- [ ] If authenticated: render children
- [ ] Use in route setup to wrap protected routes

## AppLayout

**File: warehouse-frontend/src/pages/AppLayout.tsx** (new file)

- [ ] Protected layout (wrapped in ProtectedRouteGuard)
- [ ] Left sidebar: `<SideMenu />`
- [ ] Top-right: `<UserMenu />`
- [ ] Main content: `<Outlet />` (nested routing)
- [ ] Flex layout: sidebar 250px fixed, content grows

## SideMenu

**File: warehouse-frontend/src/components/SideMenu.tsx** (new file)

- [ ] Navigation list (6 items):
  1. Configuration → `/dashboard/configuration`
  2. Add Stock → `/dashboard/add`
  3. Remove Stock → `/dashboard/remove`
  4. Transfer Stock → `/dashboard/transfer`
  5. Quick Count → `/dashboard/quickcount`
  6. Inventory Visibility → `/dashboard/inventory`
- [ ] Active link highlighting (bold or bg color)
- [ ] Use `useLocation()` to detect current route

## UserMenu

**File: warehouse-frontend/src/components/UserMenu.tsx** (new file)

- [ ] Display in top-right corner of AppLayout
- [ ] Show user ID or role label
- [ ] Dropdown with single "Logout" option
- [ ] Click → show confirm dialog: "Are you sure you want to logout?"
- [ ] Confirm → call `logout()` from useAuth
- [ ] After logout: redirect to `/login`

---

# Iteration 5: Routing Setup

## App Router

**File: warehouse-frontend/src/App.tsx** (update)

- [ ] Replace current simple render with React Router setup
- [ ] Routes:
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

- [ ] `login.test.ts`:
  - Happy path: valid password → 200 + session_token + user
  - Error: invalid password → 401 + error message
  - Edge: empty password → 400
  - Edge: password < 8 chars → 400
- [ ] `session.test.ts`:
  - Valid token → 200 + authenticated: true + user
  - Missing token → 200 + authenticated: false
  - Invalid token → 200 + authenticated: false (no error thrown)
- [ ] `logout.test.ts`:
  - Valid token → 200 + success: true
  - Token invalidated → next session check returns authenticated: false

## E2E Tests

**File: warehouse-frontend/e2e/auth.spec.ts** (new file)

- [ ] Happy path: Visit `/login` → enter password → click login → appears at `/dashboard` with menu visible
- [ ] Error path: Wrong password → error displayed → can retry
- [ ] Session recovery: Login → refresh page → still authenticated
- [ ] Logout: Click logout → confirm → redirected to `/login` + session cleared

---

# Acceptance Criteria Checklist

## Protected Route Access

- [ ] Unauthenticated user navigating to `/dashboard/*` redirects to `/login`
- [ ] Login page is accessible at `/login` without authentication
- [ ] After successful login, user can access `/dashboard` routes

## LoginPage Behavior

- [ ] Displays password input field
- [ ] Displays "Login" button
- [ ] Shows loading spinner during request
- [ ] On success: redirects to `/dashboard`
- [ ] On failure: displays "Invalid password. Try again."
- [ ] Enter key submits form

## AppLayout (Protected)

- [ ] Displays when authenticated
- [ ] Left sidebar contains SideMenu
- [ ] Main content area renders child routes
- [ ] Top-right corner contains UserMenu with logout

## SideMenu Navigation

- [ ] Menu displays 6 items in correct order
- [ ] Active route is highlighted
- [ ] Clicking menu item routes to corresponding path
- [ ] All routes are placeholder "Coming Soon" pages

## UserMenu & Logout

- [ ] Top-right displays user ID or role label
- [ ] Dropdown contains "Logout" option
- [ ] Logout shows confirmation dialog
- [ ] Confirming logout calls API, clears session, redirects to `/login`
- [ ] Canceling dialog closes without action

## Session Persistence

- [ ] Session token stored in httpOnly cookie
- [ ] Page refresh verifies token via `GET /api/auth/session`
- [ ] Valid token: user remains logged in
- [ ] Invalid token: redirected to `/login`
