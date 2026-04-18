import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { eq, ilike, inArray, like, or, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../authorization/middleware";
import { barcode, bin, item, movement, warehouse, users } from "../db/schema";
import { ConflictError, NotFoundError } from "../utils/errors";

const itemsRouter = new OpenAPIHono<{ Variables: { db: any; auth: any } }>();
const barcodeLookupRouter = new OpenAPIHono<{
  Variables: { db: any; auth: any };
}>();

const ErrorResponse = z.object({
  error: z.string(),
});

const ItemIdParams = z.object({
  id: z.string().uuid(),
});

const BarcodeLookupParams = z.object({
  barcode: z.string().min(1).max(200),
});

export const CreateItemRequest = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  barcodes: z.array(z.string().trim().min(1).max(200)).min(1).optional(),
});

export type CreateItemRequest = z.infer<typeof CreateItemRequest>;

export const AddBarcodeRequest = z.object({
  barcode: z.string().trim().min(1).max(200),
});

export type AddBarcodeRequest = z.infer<typeof AddBarcodeRequest>;

export const ItemResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  barcodes: z.array(z.string()),
  barcode_count: z.number().int().nonnegative(),
  created_at: z.string().datetime(),
});

export type ItemResponse = z.infer<typeof ItemResponse>;

const ListItemsResponse = z.array(ItemResponse);

const BarcodeLookupResponse = z.object({
  item_id: z.string().uuid(),
  item_name: z.string(),
});

const createItemRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Items"],
  operationId: "createItem",
  summary: "Create an item with optional barcodes",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateItemRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Item created",
      content: {
        "application/json": {
          schema: ItemResponse,
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
      description: "Barcode already exists",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
  },
});

const listItemsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Items"],
  operationId: "getItems",
  summary: "List items",
  responses: {
    200: {
      description: "Item list",
      content: {
        "application/json": {
          schema: ListItemsResponse,
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

const SearchItemsQuery = z.object({
  q: z.string().min(1).max(200),
});

const SearchItemsResponse = z.array(
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().optional(),
    barcodes: z.array(z.string()),
    total_quantity: z.number().int(),
  }),
);

const ItemBalanceResponse = z.object({
  item_id: z.string().uuid(),
  item_name: z.string(),
  warehouses: z.array(
    z.object({
      warehouse_id: z.string().uuid(),
      warehouse_name: z.string(),
      total_quantity: z.number().int(),
      bins: z.array(
        z.object({
          bin_id: z.string().uuid(),
          bin_name: z.string(),
          quantity: z.number().int(),
        }),
      ),
    }),
  ),
});

const ItemMovementsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const ItemMovementsResponse = z.object({
  total: z.number().int(),
  movements: z.array(
    z.object({
      movement_id: z.string().uuid(),
      type: z.enum([
        "ADD",
        "REMOVE",
        "TRANSFER",
        "COUNT_ADJUSTMENT",
        "MANUAL_ADJUSTMENT",
      ]),
      timestamp: z.string().datetime(),
      user_id: z.string().uuid(),
      user_name: z.string(),
      quantity: z.number().int(),
      source_warehouse_id: z.string().uuid().optional(),
      source_warehouse_name: z.string().optional(),
      dest_warehouse_id: z.string().uuid().optional(),
      dest_warehouse_name: z.string().optional(),
      source_bin_id: z.string().uuid().optional(),
      source_bin_name: z.string().optional(),
      dest_bin_id: z.string().uuid().optional(),
      dest_bin_name: z.string().optional(),
      note: z.string().optional(),
    }),
  ),
});

const searchItemsRoute = createRoute({
  method: "get",
  path: "/search",
  tags: ["Items"],
  operationId: "searchItems",
  summary: "Search items by name, barcode, or ID",
  request: {
    query: SearchItemsQuery,
  },
  responses: {
    200: {
      description: "Matching items",
      content: {
        "application/json": {
          schema: SearchItemsResponse,
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

const getItemRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Items"],
  operationId: "getItem",
  summary: "Get an item",
  request: {
    params: ItemIdParams,
  },
  responses: {
    200: {
      description: "Item details",
      content: {
        "application/json": {
          schema: ItemResponse,
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
      description: "Item not found",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
  },
});

const addBarcodeRoute = createRoute({
  method: "post",
  path: "/{id}/barcodes",
  tags: ["Items"],
  operationId: "addBarcode",
  summary: "Add a barcode to an item",
  request: {
    params: ItemIdParams,
    body: {
      content: {
        "application/json": {
          schema: AddBarcodeRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Updated item",
      content: {
        "application/json": {
          schema: ItemResponse,
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
      description: "Item not found",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
    409: {
      description: "Barcode already exists",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
  },
});

const lookupBarcodeRoute = createRoute({
  method: "get",
  path: "/lookup/{barcode}",
  tags: ["Barcodes"],
  operationId: "lookupItemByBarcode",
  summary: "Look up an item by barcode",
  request: {
    params: BarcodeLookupParams,
  },
  responses: {
    200: {
      description: "Barcode lookup result",
      content: {
        "application/json": {
          schema: BarcodeLookupResponse,
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
      description: "Barcode not found",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
  },
});

const getItemBalanceRoute = createRoute({
  method: "get",
  path: "/{id}/balance",
  tags: ["Items"],
  operationId: "getItemBalance",
  summary: "Get item inventory balance across warehouses",
  request: {
    params: ItemIdParams,
  },
  responses: {
    200: {
      description: "Item balance",
      content: {
        "application/json": {
          schema: ItemBalanceResponse,
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
      description: "Item not found",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
  },
});

const getItemMovementsRoute = createRoute({
  method: "get",
  path: "/{id}/movements",
  tags: ["Items"],
  operationId: "getItemMovements",
  summary: "Get movement history for an item",
  request: {
    params: ItemIdParams,
    query: ItemMovementsQuery,
  },
  responses: {
    200: {
      description: "Item movements",
      content: {
        "application/json": {
          schema: ItemMovementsResponse,
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
      description: "Item not found",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
  },
});

function normalizeDescription(description?: string) {
  const value = description?.trim();
  return value ? value : null;
}

function normalizeBarcodes(values: string[] | undefined) {
  return (values || []).map((value) => value.trim());
}

function assertDistinctBarcodes(values: string[]) {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      throw new ConflictError(`Barcode \"${value}\" already exists`);
    }

    seen.add(value);
  }
}

async function assertBarcodesAvailable(db: any, values: string[]) {
  if (!values.length) {
    return;
  }

  const existing = await db
    .select({
      barcode: barcode.barcode,
    })
    .from(barcode)
    .where(inArray(barcode.barcode, values))
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError(
      `Barcode \"${existing[0].barcode}\" already exists`,
    );
  }
}

async function getItemRecord(db: any, itemId: string) {
  const items = await db
    .select({
      id: item.id,
      name: item.name,
      description: item.description,
      created_at: item.created_at,
    })
    .from(item)
    .where(eq(item.id, itemId))
    .limit(1);

  if (items.length === 0) {
    throw new NotFoundError("Item not found");
  }

  const itemBarcodes = await db
    .select({
      barcode: barcode.barcode,
    })
    .from(barcode)
    .where(eq(barcode.item_id, itemId))
    .orderBy(barcode.created_at);

  return toItemResponse(
    items[0],
    itemBarcodes.map((entry: { barcode: string }) => entry.barcode),
  );
}

function toItemResponse(
  record: {
    id: string;
    name: string;
    description: string | null;
    created_at: Date;
  },
  barcodes: string[],
): ItemResponse {
  return {
    id: record.id,
    name: record.name,
    ...(record.description ? { description: record.description } : {}),
    barcodes,
    barcode_count: barcodes.length,
    created_at: record.created_at.toISOString(),
  };
}

itemsRouter.openapi(createItemRoute, async (c) => {
  requireRole(c, "owner");

  const db = c.get("db");
  const data = c.req.valid("json");
  const itemBarcodes = normalizeBarcodes(data.barcodes);

  assertDistinctBarcodes(itemBarcodes);
  await assertBarcodesAvailable(db, itemBarcodes);

  const createdItems = await db
    .insert(item)
    .values({
      name: data.name.trim(),
      description: normalizeDescription(data.description),
    })
    .returning({
      id: item.id,
      name: item.name,
      description: item.description,
      created_at: item.created_at,
    });

  if (!createdItems.length) {
    throw new Error("Failed to create item");
  }

  if (itemBarcodes.length > 0) {
    await db.insert(barcode).values(
      itemBarcodes.map((value) => ({
        item_id: createdItems[0].id,
        barcode: value,
      })),
    );
  }

  return c.json(await getItemRecord(db, createdItems[0].id), 201);
});

itemsRouter.openapi(listItemsRoute, async (c) => {
  requireAuth(c);

  const db = c.get("db");
  const itemRecords = await db
    .select({
      id: item.id,
      name: item.name,
      description: item.description,
      created_at: item.created_at,
    })
    .from(item)
    .orderBy(item.name, item.created_at);

  if (itemRecords.length === 0) {
    return c.json([]);
  }

  const itemIds = itemRecords.map((record: { id: string }) => record.id);
  const barcodeRecords = await db
    .select({
      item_id: barcode.item_id,
      barcode: barcode.barcode,
    })
    .from(barcode)
    .where(inArray(barcode.item_id, itemIds))
    .orderBy(barcode.created_at);

  const barcodesByItemId = new Map<string, string[]>();

  for (const record of barcodeRecords) {
    const values = barcodesByItemId.get(record.item_id) || [];
    values.push(record.barcode);
    barcodesByItemId.set(record.item_id, values);
  }

  return c.json(
    itemRecords.map(
      (record: {
        id: string;
        name: string;
        description: string | null;
        created_at: Date;
      }) => toItemResponse(record, barcodesByItemId.get(record.id) || []),
    ),
  );
});

itemsRouter.openapi(searchItemsRoute, async (c) => {
  requireAuth(c);

  const db = c.get("db");
  const { q } = c.req.valid("query");
  const namePattern = `%${q}%`;
  const barcodePrefix = `${q}%`;

  const itemIdSet = new Set<string>();

  // Search by name (case-insensitive substring)
  const nameResults = await db
    .select({ id: item.id })
    .from(item)
    .where(ilike(item.name, namePattern))
    .limit(10);
  for (const row of nameResults) itemIdSet.add(row.id);

  // Search by barcode (exact or prefix)
  const barcodeResults = await db
    .select({ item_id: barcode.item_id })
    .from(barcode)
    .where(or(eq(barcode.barcode, q), like(barcode.barcode, barcodePrefix)))
    .limit(10);
  for (const row of barcodeResults) itemIdSet.add(row.item_id);

  // Search by item UUID
  if (
    q.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  ) {
    itemIdSet.add(q);
  }

  if (itemIdSet.size === 0) {
    return c.json([]);
  }

  const itemIds = Array.from(itemIdSet);

  const itemRecords = await db
    .select({ id: item.id, name: item.name, description: item.description })
    .from(item)
    .where(inArray(item.id, itemIds))
    .orderBy(item.name)
    .limit(10);

  const foundIds = itemRecords.map((r: { id: string }) => r.id);

  if (foundIds.length === 0) {
    return c.json([]);
  }

  const barcodeRecords = await db
    .select({ item_id: barcode.item_id, barcode: barcode.barcode })
    .from(barcode)
    .where(inArray(barcode.item_id, foundIds))
    .orderBy(barcode.created_at);

  const barcodesByItemId = new Map<string, string[]>();
  for (const rec of barcodeRecords) {
    const arr = barcodesByItemId.get(rec.item_id) || [];
    arr.push(rec.barcode);
    barcodesByItemId.set(rec.item_id, arr);
  }

  const qtyRows = await db
    .select({
      item_id: movement.item_id,
      total_quantity: sql<number>`coalesce(
        sum(case when ${movement.dest_warehouse_id} is not null then ${movement.quantity} else 0 end) -
        sum(case when ${movement.source_warehouse_id} is not null then ${movement.quantity} else 0 end),
        0
      )::int`,
    })
    .from(movement)
    .where(inArray(movement.item_id, foundIds))
    .groupBy(movement.item_id);

  const quantityByItemId = new Map<string, number>();
  for (const row of qtyRows) {
    quantityByItemId.set(row.item_id, row.total_quantity);
  }

  return c.json(
    itemRecords.map(
      (record: { id: string; name: string; description: string | null }) => ({
        id: record.id,
        name: record.name,
        ...(record.description ? { description: record.description } : {}),
        barcodes: barcodesByItemId.get(record.id) || [],
        total_quantity: quantityByItemId.get(record.id) || 0,
      }),
    ),
  );
});

itemsRouter.openapi(getItemRoute, async (c) => {
  requireAuth(c);

  const db = c.get("db");
  const { id } = c.req.valid("param");

  return c.json(await getItemRecord(db, id));
});

itemsRouter.openapi(addBarcodeRoute, async (c) => {
  requireRole(c, "owner");

  const db = c.get("db");
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const value = data.barcode.trim();

  await getItemRecord(db, id);
  await assertBarcodesAvailable(db, [value]);

  await db.insert(barcode).values({
    item_id: id,
    barcode: value,
  });

  return c.json(await getItemRecord(db, id));
});

function serializeTimestamp(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(String(value)).toISOString();
}

itemsRouter.openapi(getItemBalanceRoute, async (c) => {
  requireAuth(c);

  const db = c.get("db");
  const { id: itemId } = c.req.valid("param");

  const itemRecords = await db
    .select({ id: item.id, name: item.name })
    .from(item)
    .where(eq(item.id, itemId))
    .limit(1);

  if (itemRecords.length === 0) {
    throw new NotFoundError("Item not found");
  }
  const itemRecord = itemRecords[0];

  const balanceResult = await db.execute(sql`
    WITH balance AS (
      SELECT dest_warehouse_id AS warehouse_id, dest_bin_id AS bin_id, item_id, quantity
      FROM movement
      WHERE dest_warehouse_id IS NOT NULL AND item_id = ${itemId}
      UNION ALL
      SELECT source_warehouse_id AS warehouse_id, source_bin_id AS bin_id, item_id, -quantity AS quantity
      FROM movement
      WHERE source_warehouse_id IS NOT NULL AND item_id = ${itemId}
    )
    SELECT warehouse_id, bin_id, SUM(quantity)::int AS quantity
    FROM balance
    GROUP BY warehouse_id, bin_id
    HAVING SUM(quantity) <> 0
  `);
  const balanceRows = Array.isArray(balanceResult)
    ? balanceResult
    : (balanceResult.rows ?? []);

  if (balanceRows.length === 0) {
    return c.json(
      { item_id: itemId, item_name: itemRecord.name, warehouses: [] },
      200,
    );
  }

  const warehouseIds = [
    ...new Set(balanceRows.map((r: any) => String(r.warehouse_id))),
  ] as string[];
  const warehouseRecords = await db
    .select({
      id: warehouse.id,
      name: warehouse.name,
      use_bins: warehouse.use_bins,
    })
    .from(warehouse)
    .where(inArray(warehouse.id, warehouseIds));
  const warehouseMap = new Map<
    string,
    { id: string; name: string; use_bins: boolean }
  >();
  for (const w of warehouseRecords) warehouseMap.set(w.id, w);

  const binIds = [
    ...new Set(
      balanceRows
        .filter((r: any) => r.bin_id)
        .map((r: any) => String(r.bin_id)),
    ),
  ] as string[];
  const binMap = new Map<string, { id: string; name: string }>();
  if (binIds.length > 0) {
    const binRecords = await db
      .select({ id: bin.id, name: bin.name })
      .from(bin)
      .where(inArray(bin.id, binIds));
    for (const b of binRecords) binMap.set(b.id, b);
  }

  const warehouseGroups = new Map<
    string,
    {
      warehouse_id: string;
      warehouse_name: string;
      total_quantity: number;
      bins: Array<{ bin_id: string; bin_name: string; quantity: number }>;
    }
  >();

  for (const row of balanceRows) {
    const wid = String(row.warehouse_id);
    const warehouseInfo = warehouseMap.get(wid);
    if (!warehouseInfo) continue;

    const qty = Number(row.quantity);
    if (!warehouseGroups.has(wid)) {
      warehouseGroups.set(wid, {
        warehouse_id: wid,
        warehouse_name: warehouseInfo.name,
        total_quantity: 0,
        bins: [],
      });
    }
    const group = warehouseGroups.get(wid)!;
    group.total_quantity += qty;

    if (warehouseInfo.use_bins && row.bin_id) {
      const bid = String(row.bin_id);
      const binInfo = binMap.get(bid);
      if (binInfo) {
        group.bins.push({ bin_id: bid, bin_name: binInfo.name, quantity: qty });
      }
    }
  }

  const warehouses = [...warehouseGroups.values()].sort((a, b) =>
    a.warehouse_name.localeCompare(b.warehouse_name),
  );

  return c.json(
    { item_id: itemId, item_name: itemRecord.name, warehouses },
    200,
  );
});

itemsRouter.openapi(getItemMovementsRoute, async (c) => {
  requireAuth(c);

  const db = c.get("db");
  const { id: itemId } = c.req.valid("param");
  const { limit, offset } = c.req.valid("query");

  const itemRecords = await db
    .select({ id: item.id })
    .from(item)
    .where(eq(item.id, itemId))
    .limit(1);

  if (itemRecords.length === 0) {
    throw new NotFoundError("Item not found");
  }

  const countResult = await db.execute(
    sql`SELECT COUNT(*)::int AS total FROM movement WHERE item_id = ${itemId}`,
  );
  const countRows = Array.isArray(countResult)
    ? countResult
    : (countResult.rows ?? []);
  const total = Number(countRows[0]?.total ?? 0);

  const movementsResult = await db.execute(sql`
    SELECT
      m.id AS movement_id,
      m.type,
      m.created_at AS timestamp,
      m.user_id,
      u.name AS user_name,
      m.quantity,
      m.source_warehouse_id,
      sw.name AS source_warehouse_name,
      m.dest_warehouse_id,
      dw.name AS dest_warehouse_name,
      m.source_bin_id,
      sb.name AS source_bin_name,
      m.dest_bin_id,
      dbbin.name AS dest_bin_name,
      m.note
    FROM ${movement} m
    INNER JOIN ${users} u ON u.id = m.user_id
    LEFT JOIN ${warehouse} sw ON sw.id = m.source_warehouse_id
    LEFT JOIN ${warehouse} dw ON dw.id = m.dest_warehouse_id
    LEFT JOIN ${bin} sb ON sb.id = m.source_bin_id
    LEFT JOIN ${bin} dbbin ON dbbin.id = m.dest_bin_id
    WHERE m.item_id = ${itemId}
    ORDER BY m.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);
  const movementRows = Array.isArray(movementsResult)
    ? movementsResult
    : (movementsResult.rows ?? []);

  return c.json(
    {
      total,
      movements: movementRows.map((row: any) => ({
        movement_id: String(row.movement_id),
        type: String(row.type) as z.infer<
          typeof ItemMovementsResponse
        >["movements"][0]["type"],
        timestamp: serializeTimestamp(row.timestamp),
        user_id: String(row.user_id),
        user_name: String(row.user_name),
        quantity: Number(row.quantity),
        ...(row.source_warehouse_id
          ? { source_warehouse_id: String(row.source_warehouse_id) }
          : {}),
        ...(row.source_warehouse_name
          ? { source_warehouse_name: String(row.source_warehouse_name) }
          : {}),
        ...(row.dest_warehouse_id
          ? { dest_warehouse_id: String(row.dest_warehouse_id) }
          : {}),
        ...(row.dest_warehouse_name
          ? { dest_warehouse_name: String(row.dest_warehouse_name) }
          : {}),
        ...(row.source_bin_id
          ? { source_bin_id: String(row.source_bin_id) }
          : {}),
        ...(row.source_bin_name
          ? { source_bin_name: String(row.source_bin_name) }
          : {}),
        ...(row.dest_bin_id ? { dest_bin_id: String(row.dest_bin_id) } : {}),
        ...(row.dest_bin_name
          ? { dest_bin_name: String(row.dest_bin_name) }
          : {}),
        ...(row.note ? { note: String(row.note) } : {}),
      })),
    },
    200,
  );
});

barcodeLookupRouter.openapi(lookupBarcodeRoute, async (c) => {
  requireAuth(c);

  const db = c.get("db");
  const { barcode: barcodeValue } = c.req.valid("param");
  const results = await db
    .select({
      item_id: item.id,
      item_name: item.name,
    })
    .from(barcode)
    .innerJoin(item, eq(barcode.item_id, item.id))
    .where(eq(barcode.barcode, barcodeValue.trim()))
    .limit(1);

  if (results.length === 0) {
    throw new NotFoundError("Barcode not found");
  }

  return c.json(results[0]);
});

export default itemsRouter;
export { barcodeLookupRouter };
