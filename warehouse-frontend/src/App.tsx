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
import { useAuthStore } from "./stores/authStore";

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
  const { user } = useAuthStore();

  if (user?.role === "owner") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-950 shadow-sm">
            <h1 className="text-2xl font-bold">Inventory</h1>
            <p className="mt-3 text-sm leading-6">
              Inventory movements require a personal user account. Sign out of
              the owner account and sign in with your own PIN.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
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
}

export function App() {
  return (
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
              element={<Navigate to="/dashboard/inventory/transfer" replace />}
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
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
