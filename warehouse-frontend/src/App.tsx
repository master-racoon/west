import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { AppLayout } from "./pages/AppLayout";
import { ProtectedRouteGuard } from "./components/ProtectedRouteGuard";
import { UsersPage } from "./pages/UsersPage";
import { WarehouseCreate } from "./pages/WarehouseCreate";
import { useAuthStore } from "./stores/authStore";

function ComingSoon({ label }: { label: string }) {
  return <div>{label} — Coming Soon</div>;
}

function DashboardIndexRedirect() {
  const { user } = useAuthStore();

  return (
    <Navigate
      to={
        user?.role === "owner" ? "/dashboard/configuration" : "/dashboard/add"
      }
      replace
    />
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
            <Route path="add" element={<ComingSoon label="Add Stock" />} />
            <Route
              path="remove"
              element={<ComingSoon label="Remove Stock" />}
            />
            <Route
              path="transfer"
              element={<ComingSoon label="Transfer Stock" />}
            />
            <Route
              path="quickcount"
              element={<ComingSoon label="Quick Count" />}
            />
            <Route
              path="inventory"
              element={<ComingSoon label="Inventory Visibility" />}
            />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
