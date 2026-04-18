import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { eq, ilike, inArray, or } from "drizzle-orm";
import { requireAuth, requireRole } from "../authorization/middleware";
import { barcode, item } from "../db/schema";
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
  }),
);

const searchItemsRoute = createRoute({
  method: "get",
  path: "/search",
  tags: ["Items"],
  operationId: "searchItems",
  summary: "Search items by name or description",
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
  const pattern = `%${q}%`;

  const results = await db
    .select({
      id: item.id,
      name: item.name,
      description: item.description,
    })
    .from(item)
    .where(or(ilike(item.name, pattern), ilike(item.description, pattern)))
    .orderBy(item.name)
    .limit(20);

  return c.json(
    results.map(
      (record: { id: string; name: string; description: string | null }) => ({
        id: record.id,
        name: record.name,
        ...(record.description ? { description: record.description } : {}),
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
