import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { and, eq, sql } from "drizzle-orm";
import { requireAuth } from "../authorization/middleware";
import { barcode, bin, item, movement, warehouse } from "../db/schema";
import { BadRequestError, NotFoundError } from "../utils/errors";

const inventoryRouter = new OpenAPIHono<{ Variables: { db: any; auth: any } }>();

const ErrorResponse = z.object({
  error: z.string(),
});

export const AddStockRequest = z.object({
  warehouse_id: z.string().uuid(),
  barcode_or_item_id: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(1),
  bin_id: z.string().uuid().optional(),
});

export const AddStockResponse = z.object({
  movement_id: z.string().uuid(),
  item_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  bin_id: z.string().uuid().optional(),
  quantity: z.number().int().positive(),
  balance_after: z.number().int(),
});

const InventoryBalanceQuery = z.object({
  warehouse_id: z.string().uuid().optional(),
  bin_id: z.string().uuid().optional(),
  item_id: z.string().uuid().optional(),
});

const InventoryBalanceRow = z.object({
  warehouse_id: z.string().uuid(),
  bin_id: z.string().uuid().optional(),
  item_id: z.string().uuid(),
  quantity: z.number().int(),
});

const InventoryBalanceResponse = z.array(InventoryBalanceRow);

const addStockRoute = createRoute({
  method: "post",
  path: "/add",
  tags: ["Inventory"],
  operationId: "addStock",
  summary: "Add stock to a warehouse",
  request: {
    body: {
      content: {
        "application/json": {
          schema: AddStockRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Stock movement created",
      content: {
        "application/json": {
          schema: AddStockResponse,
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
      description: "Authentication required",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
    404: {
      description: "Resource not found",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
  },
});

const getBalanceRoute = createRoute({
  method: "get",
  path: "/balance",
  tags: ["Inventory"],
  operationId: "getInventoryBalance",
  summary: "Get inventory balances",
  request: {
    query: InventoryBalanceQuery,
  },
  responses: {
    200: {
      description: "Inventory balances",
      content: {
        "application/json": {
          schema: InventoryBalanceResponse,
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
  },
});

async function getWarehouseRecord(db: any, warehouseId: string) {
  const records = await db
    .select({
      id: warehouse.id,
      name: warehouse.name,
      use_bins: warehouse.use_bins,
    })
    .from(warehouse)
    .where(eq(warehouse.id, warehouseId))
    .limit(1);

  if (!records.length) {
    throw new NotFoundError("Warehouse not found");
  }

  return records[0];
}

async function resolveItemId(db: any, barcodeOrItemId: string) {
  const barcodeValue = barcodeOrItemId.trim();
  const barcodeMatch = await db
    .select({
      item_id: item.id,
    })
    .from(barcode)
    .innerJoin(item, eq(barcode.item_id, item.id))
    .where(eq(barcode.barcode, barcodeValue))
    .limit(1);

  if (barcodeMatch.length > 0) {
    return barcodeMatch[0].item_id;
  }

  const itemMatch = await db
    .select({
      id: item.id,
    })
    .from(item)
    .where(eq(item.id, barcodeValue))
    .limit(1);

  if (!itemMatch.length) {
    throw new NotFoundError("Item not found");
  }

  return itemMatch[0].id;
}

async function getBinRecord(db: any, warehouseId: string, binId: string) {
  const records = await db
    .select({
      id: bin.id,
    })
    .from(bin)
    .where(and(eq(bin.id, binId), eq(bin.warehouse_id, warehouseId)))
    .limit(1);

  if (!records.length) {
    throw new NotFoundError("Bin not found");
  }

  return records[0];
}

async function getBalanceRows(
  db: any,
  filters: {
    warehouse_id?: string;
    bin_id?: string;
    item_id?: string;
  },
) {
  const whereClauses = [];

  if (filters.warehouse_id) {
    whereClauses.push(sql`inventory_balance.warehouse_id = ${filters.warehouse_id}`);
  }

  if (filters.bin_id) {
    whereClauses.push(sql`inventory_balance.bin_id = ${filters.bin_id}`);
  }

  if (filters.item_id) {
    whereClauses.push(sql`inventory_balance.item_id = ${filters.item_id}`);
  }

  const whereSql = whereClauses.length
    ? sql`WHERE ${sql.join(whereClauses, sql` AND `)}`
    : sql``;

  const result = await db.execute(sql`
    SELECT
      inventory_balance.warehouse_id,
      inventory_balance.bin_id,
      inventory_balance.item_id,
      SUM(inventory_balance.quantity)::int AS quantity
    FROM (
      SELECT
        ${movement.dest_warehouse_id} AS warehouse_id,
        ${movement.dest_bin_id} AS bin_id,
        ${movement.item_id} AS item_id,
        ${movement.quantity} AS quantity
      FROM ${movement}
      WHERE ${movement.dest_warehouse_id} IS NOT NULL

      UNION ALL

      SELECT
        ${movement.source_warehouse_id} AS warehouse_id,
        ${movement.source_bin_id} AS bin_id,
        ${movement.item_id} AS item_id,
        (${movement.quantity} * -1) AS quantity
      FROM ${movement}
      WHERE ${movement.source_warehouse_id} IS NOT NULL
    ) AS inventory_balance
    ${whereSql}
    GROUP BY inventory_balance.warehouse_id, inventory_balance.bin_id, inventory_balance.item_id
    HAVING SUM(inventory_balance.quantity) <> 0
    ORDER BY inventory_balance.warehouse_id, inventory_balance.bin_id, inventory_balance.item_id
  `);

  const rows = Array.isArray(result) ? result : (result.rows ?? []);

  return rows.map((row: any) => ({
    warehouse_id: String(row.warehouse_id),
    ...(row.bin_id ? { bin_id: String(row.bin_id) } : {}),
    item_id: String(row.item_id),
    quantity: Number(row.quantity),
  }));
}

async function getBalanceAfter(
  db: any,
  filters: {
    warehouse_id: string;
    bin_id?: string;
    item_id: string;
  },
) {
  const rows = await getBalanceRows(db, filters);
  return rows[0]?.quantity ?? 0;
}

inventoryRouter.openapi(addStockRoute, async (c) => {
  const auth = requireAuth(c);
  const db = c.get("db");
  const data = c.req.valid("json");
  const warehouseRecord = await getWarehouseRecord(db, data.warehouse_id);
  const itemId = await resolveItemId(db, data.barcode_or_item_id);

  if (warehouseRecord.use_bins && !data.bin_id) {
    throw new BadRequestError("Bin required for this warehouse");
  }

  if (!warehouseRecord.use_bins && data.bin_id) {
    throw new BadRequestError("Bins are not enabled for this warehouse");
  }

  if (data.bin_id) {
    await getBinRecord(db, warehouseRecord.id, data.bin_id);
  }

  const created = await db
    .insert(movement)
    .values({
      type: "ADD",
      user_id: auth.id,
      item_id: itemId,
      dest_warehouse_id: warehouseRecord.id,
      ...(data.bin_id ? { dest_bin_id: data.bin_id } : {}),
      quantity: data.quantity,
    })
    .returning({
      id: movement.id,
    });

  if (!created.length) {
    throw new Error("Failed to create movement");
  }

  const balanceAfter = await getBalanceAfter(db, {
    warehouse_id: warehouseRecord.id,
    ...(data.bin_id ? { bin_id: data.bin_id } : {}),
    item_id: itemId,
  });

  return c.json(
    {
      movement_id: created[0].id,
      item_id: itemId,
      warehouse_id: warehouseRecord.id,
      ...(data.bin_id ? { bin_id: data.bin_id } : {}),
      quantity: data.quantity,
      balance_after: balanceAfter,
    },
    201,
  );
});

inventoryRouter.openapi(getBalanceRoute, async (c) => {
  requireAuth(c);

  const db = c.get("db");
  const filters = c.req.valid("query");
  const rows = await getBalanceRows(db, filters);

  return c.json(rows, 200);
});

export default inventoryRouter;