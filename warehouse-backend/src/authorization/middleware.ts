import { Context } from "hono";
import { eq } from "drizzle-orm";
import { session } from "../db/schema";
import { ForbiddenError, UnauthorizedError } from "../utils/errors";

export interface AuthUser {
  id: string;
  email?: string;
  role: "owner" | "user";
}

export type SessionUser = {
  id: string;
  role: "owner" | "user";
  name?: string;
};

export function extractToken(c: Context): string | null {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

export async function getSessionFromDb(
  db: any,
  token: string,
): Promise<SessionUser | null> {
  const rows = await db
    .select()
    .from(session)
    .where(eq(session.token, token))
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.user_id ?? "owner-user",
    role: row.role as "owner" | "user",
    ...(row.name ? { name: row.name } : {}),
  };
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
