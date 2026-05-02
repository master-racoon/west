import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { compare } from "bcryptjs";
import { type SessionUser } from "../authorization/middleware";
import { users, session } from "../db/schema";

const router = new OpenAPIHono<{
  Bindings: { APP_PASSWORD?: string; DATABASE_URL?: string };
  Variables: { db: any };
}>();

const ErrorResponse = z.object({
  error: z.string(),
});

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
    name: z.string().optional(),
    role: z.enum(["owner", "user"]),
  }),
});

export const SessionResponse = z.union([
  z.object({
    authenticated: z.literal(true),
    user: z.object({
      id: z.string(),
      name: z.string().optional(),
      role: z.enum(["owner", "user"]),
    }),
  }),
  z.object({ authenticated: z.literal(false) }),
]);

export const LogoutResponse = z.object({
  success: z.boolean(),
});

function toSessionResponseUser(user: SessionUser): {
  id: string;
  name?: string;
  role: "owner" | "user";
} {
  return {
    id: user.id,
    role: user.role,
    ...(user.name ? { name: user.name } : {}),
  };
}

const loginRoute = createRoute({
  method: "post",
  path: "/login",
  tags: ["Auth"],
  operationId: "login",
  summary: "Create a session",
  request: {
    body: {
      content: {
        "application/json": {
          schema: LoginRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Authenticated",
      content: {
        "application/json": {
          schema: LoginResponse,
        },
      },
    },
    400: {
      description: "Invalid request",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
    401: {
      description: "Invalid credentials",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
    423: {
      description: "Account locked",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
  },
});

const getSessionRoute = createRoute({
  method: "get",
  path: "/session",
  tags: ["Auth"],
  operationId: "getSession",
  summary: "Read the current session",
  responses: {
    200: {
      description: "Current session",
      content: {
        "application/json": {
          schema: SessionResponse,
        },
      },
    },
  },
});

const logoutRoute = createRoute({
  method: "post",
  path: "/logout",
  tags: ["Auth"],
  operationId: "logout",
  summary: "Clear the current session",
  responses: {
    200: {
      description: "Logged out",
      content: {
        "application/json": {
          schema: LogoutResponse,
        },
      },
    },
  },
});

// POST /api/auth/login (public)
router.openapi(loginRoute, async (c) => {
  const parsed = c.req.valid("json");

  // Owner password login
  if ("password" in parsed) {
    const appPassword = c.env?.APP_PASSWORD;
    if (!appPassword || parsed.password !== appPassword) {
      return c.json({ error: "Incorrect owner password." }, 401);
    }
    const token = crypto.randomUUID();
    const user: SessionUser = {
      id: "owner-user",
      role: "owner",
    };
    const db = c.get("db");
    await db.insert(session).values({ token, user_id: null, role: "owner" });
    return c.json(
      {
        session_token: token,
        user: toSessionResponseUser(user),
      },
      200,
    );
  }

  // User PIN login
  const db = c.get("db");
  const { user_id, pin } = parsed;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, user_id))
    .limit(1);
  if (!user) {
    return c.json({ error: "Incorrect PIN." }, 401);
  }

  if (user.locked_until && user.locked_until > new Date()) {
    return c.json(
      {
        error:
          "Account locked. Ask an owner to unlock it or try again in 15 minutes.",
      },
      423,
    );
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

    if (newAttempts >= 5) {
      return c.json(
        {
          error:
            "Account locked. Ask an owner to unlock it or try again in 15 minutes.",
        },
        423,
      );
    }

    return c.json({ error: "Incorrect PIN." }, 401);
  }

  await db
    .update(users)
    .set({ failed_attempts: 0, locked_until: null })
    .where(eq(users.id, user_id));
  const token = crypto.randomUUID();
  const sessionUser: SessionUser = {
    id: user.id,
    role: "user",
    name: user.name,
  };
  await db
    .insert(session)
    .values({ token, user_id: user.id, role: "user", name: user.name });
  return c.json(
    {
      session_token: token,
      user: toSessionResponseUser(sessionUser),
    },
    200,
  );
});

// GET /api/auth/session (public)
router.openapi(getSessionRoute, async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ authenticated: false }, 200);
  }

  const token = authHeader.slice(7);
  const db = c.get("db");
  const rows = await db
    .select()
    .from(session)
    .where(eq(session.token, token))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ authenticated: false }, 200);
  }

  const row = rows[0];
  const user = {
    id: row.user_id ?? "owner-user",
    role: row.role as "owner" | "user",
    ...(row.name ? { name: row.name } : {}),
  };
  return c.json(
    { authenticated: true, user: toSessionResponseUser(user) },
    200,
  );
});

// POST /api/auth/logout
router.openapi(logoutRoute, async (c) => {
  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const db = c.get("db");
    await db.delete(session).where(eq(session.token, token));
  }
  return c.json({ success: true }, 200);
});

export default router;
