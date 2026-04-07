import { Hono } from "hono";
import { z } from "zod";
import { sessions } from "../authorization/middleware";

const router = new Hono<{ Bindings: { APP_PASSWORD?: string } }>();

// Zod schemas
export const LoginRequest = z.object({
  password: z.string().min(8).max(100),
});

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

  const { password } = parsed.data;
  const appPassword = c.env?.APP_PASSWORD;

  if (!appPassword || password !== appPassword) {
    return c.json({ error: "Invalid password" }, 401);
  }

  const token = crypto.randomUUID();
  const user = { id: "owner-user", role: "owner" as const };
  sessions.set(token, user);

  return c.json({ session_token: token, user });
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
