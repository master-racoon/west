import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { and, eq, ne, sql } from "drizzle-orm";
import { bin, warehouse } from "../db/schema";
import { requireRole } from "../authorization/middleware";
import { ConflictError, BadRequestError, NotFoundError } from "../utils/errors";

const router = new OpenAPIHono<{ Variables: { db: any; auth: any } }>();

const ErrorResponse = z.object({
  error: z.string(),
});

const WarehouseIdParams = z.object({
  id: z.string().uuid(),
});

// Zod schemas
export const CreateWarehouseRequest = z.object({
  name: z.string().min(1).max(100),
  use_bins: z.boolean().default(false),
});

export type CreateWarehouseRequest = z.infer<typeof CreateWarehouseRequest>;

export const UpdateWarehouseRequest = CreateWarehouseRequest;

export type UpdateWarehouseRequest = z.infer<typeof UpdateWarehouseRequest>;

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

const updateWarehouseRoute = createRoute({
  method: "put",
  path: "/{id}",
  tags: ["Warehouses"],
  operationId: "updateWarehouse",
  summary: "Update a warehouse",
  request: {
    params: WarehouseIdParams,
    body: {
      content: {
        "application/json": {
          schema: UpdateWarehouseRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Warehouse updated",
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
    404: {
      description: "Warehouse not found",
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

// PUT /api/warehouses/:id - Update an existing warehouse
router.openapi(updateWarehouseRoute, async (c) => {
  requireRole(c, "owner");

  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const normalizedName = data.name.trim().toLowerCase();

  if (!normalizedName) {
    throw new BadRequestError("Invalid request");
  }

  const db = c.get("db");

  const existingWarehouse = await db
    .select({ id: warehouse.id })
    .from(warehouse)
    .where(eq(warehouse.id, id))
    .limit(1);

  if (!existingWarehouse.length) {
    throw new NotFoundError("Warehouse not found");
  }

  const duplicate = await db
    .select({ id: warehouse.id })
    .from(warehouse)
    .where(
      and(
        eq(sql`LOWER(${warehouse.name})`, normalizedName),
        ne(warehouse.id, id),
      ),
    )
    .limit(1);

  if (duplicate.length > 0) {
    throw new ConflictError("Warehouse with this name already exists");
  }

  if (!data.use_bins) {
    const existingBin = await db
      .select({ id: bin.id })
      .from(bin)
      .where(eq(bin.warehouse_id, id))
      .limit(1);

    if (existingBin.length > 0) {
      throw new BadRequestError(
        "Cannot disable bins while bins still exist for this warehouse",
      );
    }
  }

  const result = await db
    .update(warehouse)
    .set({
      name: data.name.trim(),
      use_bins: data.use_bins,
      updated_at: new Date(),
    })
    .where(eq(warehouse.id, id))
    .returning({
      id: warehouse.id,
      name: warehouse.name,
      use_bins: warehouse.use_bins,
      created_at: warehouse.created_at,
    });

  if (!result.length) {
    throw new NotFoundError("Warehouse not found");
  }

  return c.json(toWarehouseResponse(result[0]), 200);
});

export default router;
