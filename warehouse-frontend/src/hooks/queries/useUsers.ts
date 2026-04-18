import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export interface UserName {
  id: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
  role: string;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
}

async function getHeaders(): Promise<Record<string, string>> {
  const token = localStorage.getItem("session_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// PUBLIC — no auth
export function useUserNames() {
  return useQuery<UserName[]>({
    queryKey: ["userNames"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/users/names`);
      if (!res.ok) throw new Error("Failed to fetch user names");
      return res.json();
    },
  });
}

// Owner-only
export function useUsers() {
  return useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/users`, {
        headers: await getHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; pin: string }) => {
      const res = await fetch(`${API_BASE}/api/users`, {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to create user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["userNames"] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        headers: await getHeaders(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to delete user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["userNames"] });
    },
  });
}

export function useResetPin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, pin }: { id: string; pin: string }) => {
      const res = await fetch(`/api/users/${id}/pin`, {
        method: "PUT",
        headers: await getHeaders(),
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to reset PIN");
      }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUnlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}/unlock`, {
        method: "POST",
        headers: await getHeaders(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to unlock user");
      }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}
