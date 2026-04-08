---
title: "[DEV] US-0.1 Access Password-Protected App Shell with Domain Side Menu"
lane: doing
created: 2026-04-07T00:00:00Z
updated: 2026-04-08T11:26:43.976Z
description: Platform scaffold—authenticated app layout with persistent side menu for domain features
labels:
  - platform-auth
sortOrder: 1
slug: appshell_login
---

## DFD Reference

**Flow**: N/A (Platform Scaffold — non-DFD flow)

**Related Document**: [Functional Requirements § 1) Authentication & App Shell](../../docs/functional_requirements.md#1-authentication--app-shell)

**Data Contracts** (Auth Endpoints):

- `POST /api/auth/login`
  - Request: `{ password: string (min 8 chars) }`
  - Response (success): `{ session_token: string, user: { id: UUID, role: 'owner' | 'user' } }`
  - Response (error): `{ error: string }`
- `POST /api/auth/logout`
  - Request: `{}` (session from cookie/header)
  - Response: `{ success: boolean }`
- `GET /api/auth/session`
  - Response (authenticated): `{ authenticated: true, user: { id: UUID, role: 'owner' | 'user' } }`
  - Response (anonymous): `{ authenticated: false }`

---

## Vertical Slice (Auth Backend → Protected Layout → Navigation)

### 1. Backend Auth Routes (Scaffold)

`warehouse-backend/src/routes/auth.ts` (new file)

**POST /api/auth/login**

- **Auth**: None (public endpoint)
- **Request Schema**: Zod schema `LoginRequest`
  - `password`: string, min 8 chars
- **Response Schema**: `LoginResponse`
  - `session_token`: string (JWT or session ID)
  - `user`: `{ id: UUID, role: 'owner' | 'user' }`
- **Implementation**:
  - Accept single password (simplified auth for small team)
  - Generate session token (store in session/JWT)
  - Return user with role

**POST /api/auth/logout**

- **Auth**: Session required
- **Response**: `{ success: boolean }`
- **Implementation**: Invalidate session/token

**GET /api/auth/session**

- **Auth**: None (public check)
- **Response**:
  - If authenticated: `{ authenticated: true, user: { id, role } }`
  - If anonymous: `{ authenticated: false }`

---

### 2. Frontend: Protected Layout & Navigation

#### Pages

**`warehouse-frontend/src/pages/LoginPage.tsx`** (new file)

- Password input field
- "Login" button
- Error message display (invalid password)
- Loading state during auth request
- Redirect to `/dashboard` on success

**`warehouse-frontend/src/pages/AppLayout.tsx`** (new file)

- Protected route guard (redirect to `/login` if not authenticated)
- Persistent left sidebar (SideMenu)
- Main content area (children route outlet)
- Top-right user menu with logout action

#### Components

**`warehouse-frontend/src/components/ProtectedRouteGuard.tsx`** (new file)

- Check session via `GET /api/auth/session`
- If `authenticated: false`, redirect to `/login`
- If `authenticated: true`, render protected content
- Show loading state while checking session

**`warehouse-frontend/src/components/SideMenu.tsx`** (new file)

**Purpose**: Domain feature navigation per [Functional Requirements](../../docs/functional_requirements.md#1-authentication--app-shell)

**Menu Items** (in order):

1. **Configuration** → `/dashboard/configuration` (placeholder route for future Warehouses/Items/Bins pages)
2. **Add Stock** → `/dashboard/add` (placeholder for Flow-1)
3. **Remove Stock** → `/dashboard/remove` (placeholder for Flow-2)
4. **Transfer Stock** → `/dashboard/transfer` (placeholder for Flow-3)
5. **Quick Count** → `/dashboard/quickcount` (placeholder for Flow-4)
6. **Inventory Visibility** → `/dashboard/inventory` (placeholder for read views)

**Features**:

- Active link highlighting (current page indicator)
- Responsive collapse (optional mobile support)
- Static menu (no permissions gating at this stage)

**`warehouse-frontend/src/components/UserMenu.tsx`** (new file)

- Display logged-in user ID / role
- Dropdown with logout action
- Positioned top-right of AppLayout

**`warehouse-frontend/src/components/LogoutAction.tsx`** (new file)

- Single action: "Logout"
- POST to `/api/auth/logout`
- Redirect to `/login` on success
- Confirm dialog: "Are you sure?"

#### Hooks

**`warehouse-frontend/src/hooks/useAuth.ts`** (new file)

- `useAuth()` hook returning `{ user, loading, isAuthenticated, logout() }`
- Query `GET /api/auth/session` on mount
- Refetch on app focus (optional)

---

## Acceptance Criteria

### Main Layout & Navigation

1. **Protected Route Access**
   - ✓ Unauthenticated user navigating to `/dashboard/*` redirects to `/login`
   - ✓ Login page is accessible at `/login` without authentication
   - ✓ After successful login, user can access `/dashboard` routes

2. **LoginPage Behavior**
   - ✓ Displays password input field (single field, no username)
   - ✓ Displays "Login" button
   - ✓ On submit, sends POST to `/api/auth/login` with entered password
   - ✓ Shows loading spinner during auth request
   - ✓ On success, stores session token and redirects to `/dashboard`
   - ✓ On failure (invalid password), displays error message: "Invalid password. Try again."
   - ✓ Keyboard support: Enter key submits form

3. **AppLayout (Protected)**
   - ✓ Displays when authenticated
   - ✓ Left sidebar contains SideMenu (persistent, non-collapsible for MVP)
   - ✓ Main content area renders child routes (route outlet)
   - ✓ Top-right corner contains UserMenu with logout option

4. **SideMenu Navigation**
   - ✓ Menu displays 6 items in order: Configuration, Add Stock, Remove Stock, Transfer Stock, Quick Count, Inventory Visibility
   - ✓ Active route is highlighted (bold or color change)
   - ✓ Clicking menu item routes to corresponding `/dashboard/*` path
   - ✓ All routes are placeholder "Coming Soon" pages (except Configuration if Flow-5 UI already exists)

5. **UserMenu & Logout**
   - ✓ Top-right displays user ID or role label
   - ✓ Dropdown menu contains "Logout" option
   - ✓ Clicking "Logout" shows confirmation dialog
   - ✓ Confirming logout sends POST to `/api/auth/logout`, clears session, redirects to `/login`
   - ✓ Canceling dialog closes without action

6. **Session Persistence**
   - ✓ Session token stored in httpOnly cookie (or localStorage if cookie-less)
   - ✓ On page refresh, `GET /api/auth/session` verifies token
   - ✓ If valid, user remains logged in; if invalid, redirected to `/login`

### Testing Requirements

**Happy Path**:

- User opens `/login` → enters password → clicks login → redirected to `/dashboard` with menu visible

**Error Path**:

- User enters wrong password → sees error message → can retry

**Logout Flow**:

- User clicks logout → confirms → redirected to `/login` with session cleared

**Session Recovery**:

- User logs in, refreshes page → remains authenticated (session restored from cookie/token)

---

## Notes

- This is a **platform scaffold task** and does not implement domain features.
- Domain pages (Configuration, Add Stock, etc.) are placeholders and expanded in later tasks.
- Auth implementation can be simplified (single password for small team) but must support multi-user roles for future tasks.
- Session token strategy (cookie vs. JWT) determined by backend setup + auth middleware (see `warehouse-backend/src/authorization/middleware.ts`).
