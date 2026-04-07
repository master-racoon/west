// In-memory session store (persists within a Worker instance).
// For production use Cloudflare KV instead.

export interface SessionUser {
  id: string;
  role: "owner" | "user";
}

const sessions = new Map<string, SessionUser>();

export function storeSession(token: string, user: SessionUser): void {
  sessions.set(token, user);
}

export function lookupSession(token: string): SessionUser | null {
  return sessions.get(token) ?? null;
}

export function deleteSession(token: string): void {
  sessions.delete(token);
}
