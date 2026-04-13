import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { eq, sql } from "drizzle-orm";
import { warehouse } from "../db/schema";
import { requireRole } from "../authorization/middleware";
import { ConflictError, BadRequestError } from "../utils/errors";

const router = new OpenAPIHono<{ Variables: { db: any; auth: any } }>();

const ErrorResponse = z.object({
  error: z.string(),
});

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

const ListWarehousesResponse = z.array(WarehouseResponse);

const createWarehouseRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Warehouses"],
  operationId: "createWarehouse",
  summary: "Create a warehouse",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateWarehouseRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Warehouse created",
      content: {
        "application/json": {
          schema: WarehouseResponse,
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
    403: {
      description: "Owner role required",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
    409: {
      description: "Warehouse already exists",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
  },
});

const listWarehousesRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Warehouses"],
  operationId: "getWarehouses",
  summary: "List warehouses",
  responses: {
    200: {
      description: "Warehouse list",
      content: {
        "application/json": {
          schema: ListWarehousesResponse,
        },
      },
    },
  },
});

function toWarehouseResponse(record: {
  id: string;
  name: string;
  use_bins: boolean;
  created_at: Date;
}): WarehouseResponse {
  return {
    id: record.id,
    name: record.name,
    use_bins: record.use_bins,
    created_at: record.created_at.toISOString(),
  };
}

// POST /api/warehouses - Create a new warehouse
router.openapi(createWarehouseRoute, async (c) => {
  // Require owner role
  requireRole(c, "owner");

  const data = c.req.valid("json");
  const normalizedName = data.name.trim().toLowerCase();
  if (!normalizedName) {
    throw new BadRequestError("Invalid request");
  }

  // Get database client
  const db = c.get("db");

  // Check for duplicate warehouse name (case-insensitive)
  const existing = await db
    .select()
    .from(warehouse)
    .where(eq(sql`LOWER(${warehouse.name})`, normalizedName))
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError("Warehouse with this name already exists");
  }

  // Insert warehouse
  const result = await db
    .insert(warehouse)
    .values({
      name: data.name.trim(),
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

  return c.json(toWarehouseResponse(result[0]), 201);
});

// GET /api/warehouses - List all warehouses
router.openapi(listWarehousesRoute, async (c) => {
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

  return c.json(warehouses.map(toWarehouseResponse));
});

export default router;
