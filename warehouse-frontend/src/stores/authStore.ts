import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: string;
  name?: string;
  role: "owner" | "user";
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  setUser: (user: AuthUser) => void;
  setToken: (token: string) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      clearUser: () => set({ user: null, token: null }),
    }),
    { name: "auth" },
  ),
);
