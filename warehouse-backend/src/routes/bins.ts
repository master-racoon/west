import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { bin, warehouse } from "../db/schema";
import { requireRole, requireAuth } from "../authorization/middleware";
import { ConflictError, BadRequestError, NotFoundError } from "../utils/errors";

const router = new Hono();

// Zod schemas
export const CreateBinRequest = z.object({
  warehouse_id: z.string().uuid(),
  name: z.string().min(1).max(100),
});

export type CreateBinRequest = z.infer<typeof CreateBinRequest>;

export const BinResponse = z.object({
  id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  name: z.string(),
  created_at: z.string().datetime(),
});

export type BinResponse = z.infer<typeof BinResponse>;

// POST /api/bins - Create a new bin
router.post("/", async (c) => {
  // Require owner role
  requireRole(c, "owner");

  const body = await c.req.json();

  // Validate input
  const parsed = CreateBinRequest.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestError("Invalid request");
  }

  const data = parsed.data;

  // Get database client
  const db = c.get("db");

  // Check if warehouse exists and has use_bins = true
  const warehouseRecord = await db
    .select()
    .from(warehouse)
    .where(eq(warehouse.id, data.warehouse_id))
    .limit(1);

  if (warehouseRecord.length === 0) {
    throw new NotFoundError("Warehouse not found");
  }

  if (!warehouseRecord[0].use_bins) {
    throw new BadRequestError("Bins are not enabled for this warehouse");
  }

  // Check for duplicate bin name in this warehouse (case-insensitive)
  const existing = await db
    .select()
    .from(bin)
    .where(
      and(
        eq(bin.warehouse_id, data.warehouse_id),
        // Case-insensitive comparison
        eq(db.sql`LOWER(${bin.name})`, data.name.toLowerCase()),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError(
      "Bin with this name already exists in this warehouse",
    );
  }

  // Insert bin
  const result = await db
    .insert(bin)
    .values({
      warehouse_id: data.warehouse_id,
      name: data.name,
    })
    .returning({
      id: bin.id,
      warehouse_id: bin.warehouse_id,
      name: bin.name,
      created_at: bin.created_at,
    });

  if (!result.length) {
    throw new Error("Failed to create bin");
  }

  return c.json(result[0], 201);
});

// GET /api/warehouses/:warehouse_id/bins - List bins for a warehouse
router.get("/warehouses/:warehouse_id/bins", async (c) => {
  // Require authentication
  requireAuth(c);

  const warehouseId = c.req.param("warehouse_id");

  // Validate UUID format
  if (!z.string().uuid().safeParse(warehouseId).success) {
    throw new BadRequestError("Invalid warehouse_id");
  }

  // Get database client
  const db = c.get("db");

  // Check if warehouse exists
  const warehouseRecord = await db
    .select()
    .from(warehouse)
    .where(eq(warehouse.id, warehouseId))
    .limit(1);

  if (warehouseRecord.length === 0) {
    throw new NotFoundError("Warehouse not found");
  }

  // Query bins
  const bins = await db
    .select({
      id: bin.id,
      warehouse_id: bin.warehouse_id,
      name: bin.name,
      created_at: bin.created_at,
    })
    .from(bin)
    .where(eq(bin.warehouse_id, warehouseId));

  return c.json(bins);
});

// GET /api/bins/:id - Get a single bin
router.get("/:id", async (c) => {
  // Require authentication
  requireAuth(c);

  const binId = c.req.param("id");

  // Validate UUID format
  if (!z.string().uuid().safeParse(binId).success) {
    throw new BadRequestError("Invalid bin id");
  }

  // Get database client
  const db = c.get("db");

  // Query bin
  const result = await db
    .select({
      id: bin.id,
      warehouse_id: bin.warehouse_id,
      name: bin.name,
      created_at: bin.created_at,
    })
    .from(bin)
    .where(eq(bin.id, binId))
    .limit(1);

  if (result.length === 0) {
    throw new NotFoundError("Bin not found");
  }

  return c.json(result[0]);
});

export default router;
