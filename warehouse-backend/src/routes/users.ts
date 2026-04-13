import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import { getSession } from "../authorization/middleware";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../utils/errors";

const router = new OpenAPIHono<{ Variables: { db: any } }>();

const ErrorResponse = z.object({
  error: z.string(),
});

const UserIdParams = z.object({
  id: z.string().uuid(),
});

const CreateUserRequest = z.object({
  name: z.string().min(1).max(100),
  pin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/),
});

const UpdatePinRequest = z.object({
  pin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/),
});

const UserNameResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

const UserResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  role: z.string(),
  created_at: z.string().datetime(),
});

const UserListResponse = z.array(
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    role: z.string(),
    failed_attempts: z.number().int(),
    locked_until: z.string().datetime().nullable(),
    created_at: z.string().datetime(),
  }),
);

const SuccessResponse = z.object({
  success: z.boolean(),
});

// Helper: require owner session or return 403
function requireOwnerSession(c: any) {
  const session = getSession(c);
  if (!session) {
    throw new UnauthorizedError("Unauthorized");
  }
  if (session.role !== "owner") {
    throw new ForbiddenError("Forbidden");
  }
  return session;
}

const getUserNamesRoute = createRoute({
  method: "get",
  path: "/names",
  tags: ["Users"],
  operationId: "getUserNames",
  summary: "List user names",
  responses: {
    200: {
      description: "User names",
      content: {
        "application/json": {
          schema: z.array(UserNameResponse),
        },
      },
    },
  },
});

const createUserRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Users"],
  operationId: "createUser",
  summary: "Create a user",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateUserRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "User created",
      content: {
        "application/json": {
          schema: UserResponse,
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
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
  },
});

const getUsersRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Users"],
  operationId: "getUsers",
  summary: "List users",
  responses: {
    200: {
      description: "Users",
      content: {
        "application/json": {
          schema: UserListResponse,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
  },
});

const deleteUserRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Users"],
  operationId: "deleteUser",
  summary: "Delete a user",
  request: {
    params: UserIdParams,
  },
  responses: {
    200: {
      description: "User deleted",
      content: {
        "application/json": {
          schema: SuccessResponse,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
    404: {
      description: "Not found",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
  },
});

const updateUserPinRoute = createRoute({
  method: "put",
  path: "/{id}/pin",
  tags: ["Users"],
  operationId: "updateUserPin",
  summary: "Update a user's PIN",
  request: {
    params: UserIdParams,
    body: {
      content: {
        "application/json": {
          schema: UpdatePinRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "PIN updated",
      content: {
        "application/json": {
          schema: SuccessResponse,
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
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
    404: {
      description: "Not found",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
  },
});

const unlockUserRoute = createRoute({
  method: "post",
  path: "/{id}/unlock",
  tags: ["Users"],
  operationId: "unlockUser",
  summary: "Unlock a user",
  request: {
    params: UserIdParams,
  },
  responses: {
    200: {
      description: "User unlocked",
      content: {
        "application/json": {
          schema: SuccessResponse,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
    404: {
      description: "Not found",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
  },
});

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

// GET /api/users/names — PUBLIC, no auth
router.openapi(getUserNamesRoute, async (c) => {
  const db = c.get("db");
  const result = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .orderBy(users.name);
  return c.json(result, 200);
});

// All routes below require owner auth
// POST /api/users
router.openapi(createUserRoute, async (c) => {
  requireOwnerSession(c);

  const payload = c.req.valid("json");

  const db = c.get("db");
  const pin_hash = await hash(payload.pin, 10);
  const [user] = await db
    .insert(users)
    .values({ name: payload.name.trim(), pin_hash })
    .returning({
      id: users.id,
      name: users.name,
      role: users.role,
      created_at: users.created_at,
    });

  return c.json({ ...user, created_at: user.created_at.toISOString() }, 201);
});

// GET /api/users
router.openapi(getUsersRoute, async (c) => {
  requireOwnerSession(c);

  const db = c.get("db");
  const result = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      failed_attempts: users.failed_attempts,
      locked_until: users.locked_until,
      created_at: users.created_at,
    })
    .from(users)
    .orderBy(users.name);
  return c.json(
    result.map(
      (user: {
        id: string;
        name: string;
        role: string;
        failed_attempts: number;
        locked_until: Date | null;
        created_at: Date;
      }) => ({
        ...user,
        locked_until: toIsoString(user.locked_until),
        created_at: user.created_at.toISOString(),
      }),
    ),
    200,
  );
});

// DELETE /api/users/:id
router.openapi(deleteUserRoute, async (c) => {
  requireOwnerSession(c);

  const db = c.get("db");
  const { id } = c.req.valid("param");
  const [deleted] = await db
    .delete(users)
    .where(eq(users.id, id))
    .returning({ id: users.id });
  if (!deleted) {
    throw new NotFoundError("Not found");
  }
  return c.json({ success: true }, 200);
});

// PUT /api/users/:id/pin
router.openapi(updateUserPinRoute, async (c) => {
  requireOwnerSession(c);

  const { id } = c.req.valid("param");
  const payload = c.req.valid("json");

  const db = c.get("db");
  const pin_hash = await hash(payload.pin, 10);
  const [updated] = await db
    .update(users)
    .set({ pin_hash, failed_attempts: 0, locked_until: null })
    .where(eq(users.id, id))
    .returning({ id: users.id });
  if (!updated) {
    throw new NotFoundError("Not found");
  }
  return c.json({ success: true }, 200);
});

// POST /api/users/:id/unlock
router.openapi(unlockUserRoute, async (c) => {
  requireOwnerSession(c);

  const db = c.get("db");
  const { id } = c.req.valid("param");
  const [updated] = await db
    .update(users)
    .set({ failed_attempts: 0, locked_until: null })
    .where(eq(users.id, id))
    .returning({ id: users.id });
  if (!updated) {
    throw new NotFoundError("Not found");
  }
  return c.json({ success: true }, 200);
});

export default router;
