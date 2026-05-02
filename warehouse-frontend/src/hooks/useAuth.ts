import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function fetchSession() {
  const token = localStorage.getItem("session_token");
  const response = await fetch(`${API_BASE}/api/auth/session`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error("Failed to fetch session");
  return response.json() as Promise<
    | {
        authenticated: true;
        user: { id: string; name?: string; role: "owner" | "user" };
      }
    | { authenticated: false }
  >;
}

export function useAuth() {
  const { user, setUser, clearUser } = useAuthStore();
  const navigate = useNavigate();

  const { isLoading, refetch } = useQuery({
    queryKey: ["auth", "session"],
    queryFn: async () => {
      const data = await fetchSession();
      if (data.authenticated) {
        setUser(data.user);
      } else {
        clearUser();
      }
      return data;
    },
    staleTime: 1 * 60 * 1000, // Reduced from 5 min to 1 min for production resilience
    refetchInterval: 2 * 60 * 1000, // Background refetch every 2 minutes
  });

  const logout = async () => {
    const token = localStorage.getItem("session_token");
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    localStorage.removeItem("session_token");
    clearUser();
    navigate("/login");
  };

  return {
    user,
    isLoading,
    isAuthenticated: user !== null,
    logout,
    refetchSession: refetch, // Expose for manual validation
  };
}
