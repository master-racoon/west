import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { warehouse } from "../db/schema";
import { requireRole } from "../authorization/middleware";
import { ConflictError, BadRequestError } from "../utils/errors";

const router = new Hono();

// Zod schemas
export const CreateWarehouseRequest = z.object({
  name: z.string().min(1).max(100),
  use_bins: z.boolean().default(false),
});

export type CreateWarehouseRequest = z.infer<typeof CreateWarehouseRequest>;

export const WarehouseResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  use_bins: z.boolean(),
  created_at: z.string().datetime(),
});

export type WarehouseResponse = z.infer<typeof WarehouseResponse>;

// POST /api/warehouses - Create a new warehouse
router.post("/", async (c) => {
  // Require owner role
  requireRole(c, "owner");

  const body = await c.req.json();

  // Validate input
  const parsed = CreateWarehouseRequest.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestError("Invalid request");
  }

  const data = parsed.data;
  const normalizedName = data.name.toLowerCase();

  // Get database client
  const db = c.get("db");

  // Check for duplicate warehouse name (case-insensitive)
  const existing = await db
    .select()
    .from(warehouse)
    .where(eq(warehouse.name, normalizedName))
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError("Warehouse with this name already exists");
  }

  // Insert warehouse
  const result = await db
    .insert(warehouse)
    .values({
      name: normalizedName,
      use_bins: data.use_bins,
    })
    .returning({
      id: warehouse.id,
      name: warehouse.name,
      use_bins: warehouse.use_bins,
      created_at: warehouse.created_at,
    });

  if (!result.length) {
    throw new Error("Failed to create warehouse");
  }

  return c.json(result[0], 201);
});

// GET /api/warehouses - List all warehouses
router.get("/", async (c) => {
  const db = c.get("db");

  const warehouses = await db
    .select({
      id: warehouse.id,
      name: warehouse.name,
      use_bins: warehouse.use_bins,
      created_at: warehouse.created_at,
    })
    .from(warehouse)
    .orderBy(warehouse.created_at);

  return c.json(warehouses);
});

export default router;
