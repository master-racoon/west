import { Context } from "hono";
import { ForbiddenError, UnauthorizedError } from "../utils/errors";

export interface AuthUser {
  id: string;
  email: string;
  role: "owner" | "user";
}

export function getAuth(c: Context): AuthUser | null {
  const auth = c.get("auth");
  if (!auth || !auth.user) {
    return null;
  }
  return auth.user;
}

export function requireAuth(c: Context): AuthUser {
  const auth = getAuth(c);
  if (!auth) {
    throw new UnauthorizedError("Authentication required");
  }
  return auth;
}

export function requireRole(c: Context, role: string): AuthUser {
  const auth = requireAuth(c);
  if (auth.role !== role) {
    throw new ForbiddenError(`${role} role required`);
  }
  return auth;
}
