import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { AppLayout } from "./pages/AppLayout";
import { ProtectedRouteGuard } from "./components/ProtectedRouteGuard";
import { UsersPage } from "./pages/UsersPage";

function ComingSoon({ label }: { label: string }) {
  return <div>{label} — Coming Soon</div>;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRouteGuard />}>
          <Route path="/dashboard" element={<AppLayout />}>
            <Route
              index
              element={<Navigate to="/dashboard/configuration" replace />}
            />
            <Route path="users" element={<UsersPage />} />
            <Route
              path="configuration"
              element={<ComingSoon label="Configuration" />}
            />
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
