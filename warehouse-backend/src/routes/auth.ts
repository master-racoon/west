import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { compare } from "bcryptjs";
import { sessions } from "../authorization/middleware";
import { users } from "../db/schema";

const router = new Hono<{
  Bindings: { APP_PASSWORD?: string; DATABASE_URL?: string };
  Variables: { db: any };
}>();

// Zod schemas
const OwnerLoginRequest = z.object({
  password: z.string().min(8).max(100),
});

const UserLoginRequest = z.object({
  user_id: z.string().uuid(),
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
});

const LoginRequest = z.union([OwnerLoginRequest, UserLoginRequest]);

export const LoginResponse = z.object({
  session_token: z.string(),
  user: z.object({
    id: z.string(),
    role: z.enum(["owner", "user"]),
  }),
});

export const SessionResponse = z.union([
  z.object({
    authenticated: z.literal(true),
    user: z.object({ id: z.string(), role: z.enum(["owner", "user"]) }),
  }),
  z.object({ authenticated: z.literal(false) }),
]);

export const LogoutResponse = z.object({
  success: z.boolean(),
});

// POST /api/auth/login (public)
router.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = LoginRequest.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request" }, 400);
  }

  // Owner password login
  if ("password" in parsed.data) {
    const appPassword = c.env?.APP_PASSWORD;
    if (!appPassword || parsed.data.password !== appPassword) {
      return c.json({ error: "Invalid password" }, 401);
    }
    const token = crypto.randomUUID();
    const user = { id: "owner-user", role: "owner" as const, name: "Owner" };
    sessions.set(token, user);
    return c.json({
      session_token: token,
      user: { id: "owner-user", name: "Owner", role: "owner" },
    });
  }

  // User PIN login
  const db = c.get("db");
  const { user_id, pin } = parsed.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, user_id))
    .limit(1);
  if (!user) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  if (user.locked_until && user.locked_until > new Date()) {
    return c.json({ error: "Account locked. Try again later." }, 423);
  }

  const match = await compare(pin, user.pin_hash);
  if (!match) {
    const newAttempts = user.failed_attempts + 1;
    const updatePayload: Record<string, unknown> = {
      failed_attempts: newAttempts,
    };
    if (newAttempts >= 5) {
      updatePayload.locked_until = new Date(Date.now() + 15 * 60 * 1000);
    }
    await db.update(users).set(updatePayload).where(eq(users.id, user_id));
    return c.json({ error: "Invalid credentials" }, 401);
  }

  await db
    .update(users)
    .set({ failed_attempts: 0, locked_until: null })
    .where(eq(users.id, user_id));
  const token = crypto.randomUUID();
  const sessionUser = { id: user.id, role: "user" as const, name: user.name };
  sessions.set(token, sessionUser);
  return c.json({
    session_token: token,
    user: { id: user.id, name: user.name, role: "user" },
  });
});

// GET /api/auth/session (public)
router.get("/session", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ authenticated: false });
  }

  const token = authHeader.slice(7);
  const user = sessions.get(token);

  if (!user) {
    return c.json({ authenticated: false });
  }

  return c.json({ authenticated: true, user });
});

// POST /api/auth/logout
router.post("/logout", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    sessions.delete(token);
  }
  return c.json({ success: true });
});

export default router;
