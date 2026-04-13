import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { eq, and, sql } from "drizzle-orm";
import { bin, warehouse } from "../db/schema";
import { requireRole, requireAuth } from "../authorization/middleware";
import { ConflictError, BadRequestError, NotFoundError } from "../utils/errors";

const binsRouter = new OpenAPIHono<{ Variables: { db: any; auth: any } }>();
const warehouseBinsRouter = new OpenAPIHono<{
  Variables: { db: any; auth: any };
}>();

const ErrorResponse = z.object({
  error: z.string(),
});

const IdParams = z.object({
  id: z.string().uuid(),
});

const WarehouseIdParams = z.object({
  warehouse_id: z.string().uuid(),
});

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

const ListBinsResponse = z.array(BinResponse);

const createBinRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Bins"],
  operationId: "createBin",
  summary: "Create a bin",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateBinRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Bin created",
      content: {
        "application/json": {
          schema: BinResponse,
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
      description: "Bin already exists",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
  },
});

const listBinsByWarehouseRoute = createRoute({
  method: "get",
  path: "/{warehouse_id}/bins",
  tags: ["Bins"],
  operationId: "getBinsByWarehouse",
  summary: "List bins for a warehouse",
  request: {
    params: WarehouseIdParams,
  },
  responses: {
    200: {
      description: "Bins for the warehouse",
      content: {
        "application/json": {
          schema: ListBinsResponse,
        },
      },
    },
    401: {
      description: "Authentication required",
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
  },
});

const getBinRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Bins"],
  operationId: "getBin",
  summary: "Get a bin",
  request: {
    params: IdParams,
  },
  responses: {
    200: {
      description: "Bin details",
      content: {
        "application/json": {
          schema: BinResponse,
        },
      },
    },
    401: {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
    404: {
      description: "Bin not found",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
  },
});

function toBinResponse(record: {
  id: string;
  warehouse_id: string;
  name: string;
  created_at: Date;
}): BinResponse {
  return {
    id: record.id,
    warehouse_id: record.warehouse_id,
    name: record.name,
    created_at: record.created_at.toISOString(),
  };
}

// POST /api/bins - Create a new bin
binsRouter.openapi(createBinRoute, async (c) => {
  // Require owner role
  requireRole(c, "owner");

  const data = c.req.valid("json");

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
        eq(sql`LOWER(${bin.name})`, data.name.toLowerCase()),
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

  return c.json(toBinResponse(result[0]), 201);
});

// GET /api/warehouses/:warehouse_id/bins - List bins for a warehouse
warehouseBinsRouter.openapi(listBinsByWarehouseRoute, async (c) => {
  // Require authentication
  requireAuth(c);

  const { warehouse_id: warehouseId } = c.req.valid("param");

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

  return c.json(bins.map(toBinResponse), 200);
});

// GET /api/bins/:id - Get a single bin
binsRouter.openapi(getBinRoute, async (c) => {
  // Require authentication
  requireAuth(c);

  const { id: binId } = c.req.valid("param");

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

  return c.json(toBinResponse(result[0]), 200);
});

export { warehouseBinsRouter };
export default binsRouter;
