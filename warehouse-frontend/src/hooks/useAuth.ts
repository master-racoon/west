import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

async function fetchSession() {
  const token = localStorage.getItem("session_token");
  const response = await fetch("/api/auth/session", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error("Failed to fetch session");
  return response.json() as Promise<
    | { authenticated: true; user: { id: string; role: "owner" | "user" } }
    | { authenticated: false }
  >;
}

export function useAuth() {
  const { user, setUser, clearUser } = useAuthStore();
  const navigate = useNavigate();

  const { isLoading } = useQuery({
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
    staleTime: 5 * 60 * 1000,
  });

  const logout = async () => {
    const token = localStorage.getItem("session_token");
    await fetch("/api/auth/logout", {
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
  };
}
