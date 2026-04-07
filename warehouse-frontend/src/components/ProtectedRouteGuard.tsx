import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function ProtectedRouteGuard() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <div style={{ padding: "32px" }}>Loading…</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
