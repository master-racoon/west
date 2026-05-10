import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
} from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { AppLayout } from "./pages/AppLayout";
import { ProtectedRouteGuard } from "./components/ProtectedRouteGuard";
import { UsersPage } from "./pages/UsersPage";
import { WarehouseCreate } from "./pages/WarehouseCreate";
import { ProductsPage } from "./pages/ProductsPage";
import { AddStockPage } from "./pages/AddStock";
import { RemoveStockPage } from "./pages/RemoveStock";
import { TransferStockPage } from "./pages/TransferStock";
import { QuickCountPage } from "./pages/QuickCount";
import { InventorySearchPage } from "./pages/InventorySearch";
import { ItemDetailPage } from "./pages/ItemDetail";
import { CurrentBalancePage } from "./pages/CurrentBalance";
import { CreateMovementPage } from "./pages/CreateMovement";
import { BulkUploadProductsPage } from "./pages/BulkUploadProducts";
import { BulkUploadBalancePage } from "./pages/BulkUploadBalance";
import { useAuthStore } from "./stores/authStore";
import { useUserNames } from "./hooks/queries/useUsers";
import { Toaster } from "sonner";

function DashboardIndexRedirect() {
  const { user } = useAuthStore();

  return (
    <Navigate
      to={
        user?.role === "owner"
          ? "/dashboard/configuration"
          : "/dashboard/products"
      }
      replace
    />
  );
}

function InventoryPage() {
  const { user, userUser, setUserSession, clearUserSession } = useAuthStore();
  const { data: userNames } = useUserNames();
  const [userId, setUserId] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (user?.role === "owner" && userUser == null) {
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setIsLoading(true);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL ?? ""}/api/auth/login`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, pin }),
          },
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body.error || "Login failed");
          return;
        }
        const token: string = body.session_token;
        const loggedInUser = body.user;
        localStorage.setItem("user_session_token", token);
        setUserSession(token, loggedInUser);
      } catch {
        setError("Network error");
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-950 shadow-sm">
            <h1 className="text-2xl font-bold">
              Inventory — Owner PIN Required
            </h1>
            <p className="mt-3 text-sm leading-6">
              Enter your personal user PIN to make inventory movements. Your
              owner session remains active.
            </p>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">User</label>
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  required
                  className="block w-full rounded border border-amber-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select user…</option>
                  {(userNames ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">PIN</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  required
                  className="block w-full rounded border border-amber-300 bg-white px-3 py-2 text-sm tracking-widest"
                />
              </div>
              {error && <p className="text-red-700 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={isLoading}
                className="rounded bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-900 disabled:opacity-50"
              >
                {isLoading ? "Signing in…" : "Continue as User"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const inventoryContent = (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto py-6 sm:px-6 lg:px-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
          <p className="mt-2 text-sm text-gray-600">
            Work with stock movements from the inventory workspace.
          </p>
        </div>

        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-6" aria-label="Inventory tabs">
            <NavLink
              to="add"
              className={({ isActive }) =>
                `border-b-2 px-1 pb-3 text-sm font-medium ${
                  isActive
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`
              }
            >
              Add
            </NavLink>
            <NavLink
              to="remove"
              className={({ isActive }) =>
                `border-b-2 px-1 pb-3 text-sm font-medium ${
                  isActive
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`
              }
            >
              Remove
            </NavLink>
            <NavLink
              to="transfer"
              className={({ isActive }) =>
                `border-b-2 px-1 pb-3 text-sm font-medium ${
                  isActive
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`
              }
            >
              Transfer
            </NavLink>
            <NavLink
              to="quickcount"
              className={({ isActive }) =>
                `border-b-2 px-1 pb-3 text-sm font-medium ${
                  isActive
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`
              }
            >
              Quick Count
            </NavLink>
          </nav>
        </div>

        <Routes>
          <Route index element={<Navigate to="add" replace />} />
          <Route path="add" element={<AddStockPage embedded />} />
          <Route path="remove" element={<RemoveStockPage embedded />} />
          <Route path="transfer" element={<TransferStockPage embedded />} />
          <Route path="quickcount" element={<QuickCountPage embedded />} />
        </Routes>
      </div>
    </div>
  );

  if (user?.role === "owner" && userUser != null) {
    return (
      <>
        <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-sm text-amber-900 flex items-center gap-2">
          Acting as: {userUser.name} —{" "}
          <button
            onClick={() => {
              clearUserSession();
              localStorage.removeItem("user_session_token");
            }}
            className="underline hover:text-amber-700"
          >
            Switch user
          </button>
        </div>
        {inventoryContent}
      </>
    );
  }

  return inventoryContent;
}

export function App() {
  return (
    <>
      <Toaster richColors position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRouteGuard />}>
            <Route path="/dashboard" element={<AppLayout />}>
              <Route index element={<DashboardIndexRedirect />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="configuration" element={<WarehouseCreate />} />
              <Route path="products" element={<ProductsPage />} />
              <Route
                path="add"
                element={<Navigate to="/dashboard/inventory/add" replace />}
              />
              <Route
                path="remove"
                element={<Navigate to="/dashboard/inventory/remove" replace />}
              />
              <Route
                path="transfer"
                element={
                  <Navigate to="/dashboard/inventory/transfer" replace />
                }
              />
              <Route
                path="quickcount"
                element={
                  <Navigate to="/dashboard/inventory/quickcount" replace />
                }
              />
              <Route path="inventory/*" element={<InventoryPage />} />
              <Route
                path="inventory-visibility"
                element={<InventorySearchPage />}
              />
              <Route
                path="inventory-visibility/:id"
                element={<ItemDetailPage />}
              />
              <Route path="current-balance" element={<CurrentBalancePage />} />
              <Route path="create-movement" element={<CreateMovementPage />} />
              <Route
                path="bulk-upload-products"
                element={<BulkUploadProductsPage />}
              />
              <Route
                path="bulk-upload-balance"
                element={<BulkUploadBalancePage />}
              />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}
