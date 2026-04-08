import { Hono } from "hono";
import { z } from "zod";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import { getSession } from "../authorization/middleware";

const router = new Hono<{ Variables: { db: any } }>();

// Helper: require owner session or return 403
function requireOwnerSession(c: any) {
  const session = getSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  if (session.role !== "owner") return c.json({ error: "Forbidden" }, 403);
  return null;
}

// GET /api/users/names — PUBLIC, no auth
router.get("/names", async (c) => {
  const db = c.get("db");
  const result = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .orderBy(users.name);
  return c.json(result);
});

// All routes below require owner auth
// POST /api/users
router.post("/", async (c) => {
  const err = requireOwnerSession(c);
  if (err) return err;

  const body = await c.req.json();
  const schema = z.object({
    name: z.string().min(1).max(100),
    pin: z
      .string()
      .length(4)
      .regex(/^\d{4}$/),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid request" }, 400);

  const db = c.get("db");
  const pin_hash = await hash(parsed.data.pin, 10);
  const [user] = await db
    .insert(users)
    .values({ name: parsed.data.name, pin_hash })
    .returning({
      id: users.id,
      name: users.name,
      role: users.role,
      created_at: users.created_at,
    });

  return c.json(user, 201);
});

// GET /api/users
router.get("/", async (c) => {
  const err = requireOwnerSession(c);
  if (err) return err;

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
  return c.json(result);
});

// DELETE /api/users/:id
router.delete("/:id", async (c) => {
  const err = requireOwnerSession(c);
  if (err) return err;

  const db = c.get("db");
  const id = c.req.param("id");
  const [deleted] = await db
    .delete(users)
    .where(eq(users.id, id))
    .returning({ id: users.id });
  if (!deleted) return c.json({ error: "Not found" }, 404);
  return c.json({ success: true });
});

// PUT /api/users/:id/pin
router.put("/:id/pin", async (c) => {
  const err = requireOwnerSession(c);
  if (err) return err;

  const body = await c.req.json();
  const schema = z.object({
    pin: z
      .string()
      .length(4)
      .regex(/^\d{4}$/),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid request" }, 400);

  const db = c.get("db");
  const id = c.req.param("id");
  const pin_hash = await hash(parsed.data.pin, 10);
  const [updated] = await db
    .update(users)
    .set({ pin_hash, failed_attempts: 0, locked_until: null })
    .where(eq(users.id, id))
    .returning({ id: users.id });
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json({ success: true });
});

// POST /api/users/:id/unlock
router.post("/:id/unlock", async (c) => {
  const err = requireOwnerSession(c);
  if (err) return err;

  const db = c.get("db");
  const id = c.req.param("id");
  const [updated] = await db
    .update(users)
    .set({ failed_attempts: 0, locked_until: null })
    .where(eq(users.id, id))
    .returning({ id: users.id });
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json({ success: true });
});

export default router;
