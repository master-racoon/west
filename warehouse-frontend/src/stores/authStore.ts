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
  userUser: AuthUser | null;
  userToken: string | null;
  setUser: (user: AuthUser) => void;
  setToken: (token: string) => void;
  clearUser: () => void;
  setUserSession: (token: string, user: AuthUser) => void;
  clearUserSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      userUser: null,
      userToken: null,
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      clearUser: () => set({ user: null, token: null }),
      setUserSession: (token, user) =>
        set({ userToken: token, userUser: user }),
      clearUserSession: () => set({ userToken: null, userUser: null }),
    }),
    { name: "auth" },
  ),
);
