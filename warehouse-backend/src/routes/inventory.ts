import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { and, eq, ilike, sql } from "drizzle-orm";
import { requireAuth } from "../authorization/middleware";
import {
  barcode,
  bin,
  item,
  itemSku,
  movement,
  removalApproval,
  session,
  warehouse,
} from "../db/schema";
import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../utils/errors";

const inventoryRouter = new OpenAPIHono<{
  Variables: { db: any; auth: any };
}>();

const ErrorResponse = z.object({
  error: z.string(),
});

const PERSONAL_USER_ACCOUNT_REQUIRED_MESSAGE =
  "Inventory movements require a personal user account. Sign out of the owner account and sign in with your own PIN.";

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

export const RemoveStockRequest = z.object({
  warehouse_id: z.string().uuid(),
  item_id: z.string().uuid(),
  quantity: z.number().int().min(1),
  bin_id: z.string().uuid().optional(),
  owner_override: z.boolean().optional().default(false),
  request_owner_approval: z.boolean().optional().default(false),
});

export const RemoveStockResponse = z.object({
  success: z.literal(true),
  movement_id: z.string().uuid(),
  item_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  bin_id: z.string().uuid().optional(),
  quantity_removed: z.number().int().positive(),
  balance_after: z.number().int(),
  owner_override_applied: z.boolean(),
});

export const TransferStockRequest = z.object({
  item_id: z.string().uuid(),
  quantity: z.number().int().min(1),
  source_warehouse_id: z.string().uuid(),
  dest_warehouse_id: z.string().uuid(),
  source_bin_id: z.string().uuid().optional(),
  dest_bin_id: z.string().uuid().optional(),
});

export const TransferStockResponse = z.object({
  movement_id: z.string().uuid(),
  item_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  source_warehouse_id: z.string().uuid(),
  dest_warehouse_id: z.string().uuid(),
  source_balance_after: z.number().int(),
  dest_balance_after: z.number().int(),
});

export const CountAdjustRequest = z.object({
  warehouse_id: z.string().uuid(),
  bin_id: z.string().uuid().optional(),
  item_id: z.string().uuid(),
  observed_quantity: z.number().int().min(0),
});

export const CountAdjustResponse = z.object({
  movement_id: z.string().uuid(),
  item_id: z.string().uuid(),
  previous_balance: z.number().int(),
  new_balance: z.number().int(),
  delta: z.number().int(),
  movement_type: z.literal("COUNT_ADJUSTMENT"),
});

export const CreateManualMovementRequest = z.object({
  item_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  bin_id: z.string().uuid().optional(),
  quantity: z
    .number()
    .int()
    .refine((n) => n !== 0, {
      message: "Quantity must be non-zero",
    }),
  note: z.string().max(500).optional(),
});

export const CreateManualMovementResponse = z.object({
  movement_id: z.string().uuid(),
  type: z.literal("MANUAL_ADJUSTMENT"),
  item_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  bin_id: z.string().uuid().optional(),
  quantity: z.number().int(),
  note: z.string().optional(),
  created_at: z.string().datetime(),
});

export const RemoveStockWarningResponse = z.object({
  success: z.literal(false),
  warning: z.string(),
  owner_approval_required: z.literal(true),
  approval_requested: z.boolean(),
  approval_id: z.string().uuid().optional(),
  approval_status: z.literal("pending").optional(),
  current_balance: z.number().int(),
  requested_quantity: z.number().int().positive(),
  shortfall: z.number().int().positive(),
});

const RemovalApprovalStatus = z.enum(["pending", "approved", "rejected"]);

const RemovalApprovalSummary = z.object({
  id: z.string().uuid(),
  item_id: z.string().uuid(),
  item_name: z.string(),
  warehouse_id: z.string().uuid(),
  warehouse_name: z.string(),
  bin_id: z.string().uuid().optional(),
  bin_name: z.string().optional(),
  quantity_requested: z.number().int().positive(),
  current_balance: z.number().int(),
  shortfall: z.number().int().min(0),
  status: RemovalApprovalStatus,
  requested_by_user_id: z.string().uuid(),
  requested_by_name: z.string(),
  approved_by_owner_id: z.string().uuid().optional(),
  approved_by_owner_name: z.string().optional(),
  movement_id: z.string().uuid().optional(),
  created_at: z.string().datetime(),
  decided_at: z.string().datetime().optional(),
});

const RemovalApprovalListResponse = z.array(RemovalApprovalSummary);

const RemovalApprovalDecisionResponse = z.object({
  approval_id: z.string().uuid(),
  status: RemovalApprovalStatus,
  movement_id: z.string().uuid().optional(),
  decided_at: z.string().datetime(),
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

const CurrentBalanceQuery = z.object({
  warehouse_id: z.string().uuid().optional(),
  sku: z.string().optional(),
});

const BinBalanceItem = z.object({
  bin_id: z.string().uuid(),
  bin_name: z.string(),
  quantity: z.number().int(),
});

const WarehouseBalanceItem = z.object({
  warehouse_id: z.string().uuid(),
  warehouse_name: z.string(),
  quantity: z.number().int(),
  bins: z.array(BinBalanceItem),
});

const CurrentBalanceRecord = z.object({
  item_id: z.string().uuid(),
  item_name: z.string(),
  skus: z.array(z.string()),
  total_quantity: z.number().int(),
  warehouses: z.array(WarehouseBalanceItem),
});

const CurrentBalanceResponse = z.array(CurrentBalanceRecord);

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
    403: {
      description: "Personal user account required",
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

const removeStockRoute = createRoute({
  method: "post",
  path: "/remove",
  tags: ["Inventory"],
  operationId: "removeStock",
  summary: "Remove stock from a warehouse",
  request: {
    body: {
      content: {
        "application/json": {
          schema: RemoveStockRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Stock movement created",
      content: {
        "application/json": {
          schema: RemoveStockResponse,
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
    403: {
      description: "Owner override required",
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
    422: {
      description: "Insufficient stock requires owner approval",
      content: {
        "application/json": {
          schema: RemoveStockWarningResponse,
        },
      },
    },
  },
});

const transferStockRoute = createRoute({
  method: "post",
  path: "/transfer",
  tags: ["Inventory"],
  operationId: "transferStock",
  summary: "Transfer stock between warehouses",
  request: {
    body: {
      content: {
        "application/json": {
          schema: TransferStockRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Transfer movement created",
      content: {
        "application/json": {
          schema: TransferStockResponse,
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
    403: {
      description: "Personal user account required",
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
    422: {
      description: "Insufficient stock",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
  },
});

const countAdjustRoute = createRoute({
  method: "post",
  path: "/count-adjust",
  tags: ["Inventory"],
  operationId: "countAdjust",
  summary: "Adjust inventory to a physical count",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CountAdjustRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Count adjustment movement created",
      content: {
        "application/json": {
          schema: CountAdjustResponse,
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
    403: {
      description: "Personal user account required",
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

const createManualMovementRoute = createRoute({
  method: "post",
  path: "/movements",
  tags: ["Inventory"],
  operationId: "createManualMovement",
  summary: "Create a manual adjustment movement (owner only)",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateManualMovementRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Manual adjustment movement created",
      content: {
        "application/json": {
          schema: CreateManualMovementResponse,
        },
      },
    },
    400: {
      description: "Invalid request",
      content: { "application/json": { schema: ErrorResponse } },
    },
    401: {
      description: "Authentication required",
      content: { "application/json": { schema: ErrorResponse } },
    },
    403: {
      description: "Owner role required",
      content: { "application/json": { schema: ErrorResponse } },
    },
    404: {
      description: "Resource not found",
      content: { "application/json": { schema: ErrorResponse } },
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

const getCurrentBalanceRoute = createRoute({
  method: "get",
  path: "/current-balance",
  tags: ["Inventory"],
  operationId: "getCurrentBalance",
  summary: "Get current stock levels per item grouped by warehouse and bin",
  request: {
    query: CurrentBalanceQuery,
  },
  responses: {
    200: {
      description: "Current stock levels per item",
      content: {
        "application/json": {
          schema: CurrentBalanceResponse,
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

const getCurrentBalanceCsvRoute = createRoute({
  method: "get",
  path: "/current-balance.csv",
  tags: ["Inventory"],
  operationId: "downloadCurrentBalanceCsv",
  summary: "Download current stock levels as CSV",
  request: {
    query: CurrentBalanceQuery,
  },
  responses: {
    200: {
      description: "CSV file",
      content: {
        "text/csv": {
          schema: z.string(),
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

const getRemovalApprovalsRoute = createRoute({
  method: "get",
  path: "/removal-approvals",
  tags: ["Inventory"],
  operationId: "getRemovalApprovals",
  summary: "List shortfall removal approvals visible to the current user",
  responses: {
    200: {
      description: "Visible removal approvals",
      content: {
        "application/json": {
          schema: RemovalApprovalListResponse,
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

const approveRemovalApprovalRoute = createRoute({
  method: "post",
  path: "/removal-approvals/{id}/approve",
  tags: ["Inventory"],
  operationId: "approveRemovalApproval",
  summary: "Approve a shortfall removal request",
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "Removal approval processed",
      content: {
        "application/json": {
          schema: RemovalApprovalDecisionResponse,
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
    403: {
      description: "Owner role required",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
    404: {
      description: "Approval not found",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
    409: {
      description: "Approval already processed",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
  },
});

const rejectRemovalApprovalRoute = createRoute({
  method: "post",
  path: "/removal-approvals/{id}/reject",
  tags: ["Inventory"],
  operationId: "rejectRemovalApproval",
  summary: "Reject a shortfall removal request",
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "Removal approval rejected",
      content: {
        "application/json": {
          schema: RemovalApprovalDecisionResponse,
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
    403: {
      description: "Owner role required",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
    404: {
      description: "Approval not found",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
    409: {
      description: "Approval already processed",
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

  const skuMatch = await db
    .select({
      item_id: itemSku.item_id,
    })
    .from(itemSku)
    .where(eq(itemSku.sku, barcodeValue))
    .limit(1);

  if (skuMatch.length > 0) {
    return skuMatch[0].item_id;
  }

  if (!skuMatch.length) {
    throw new NotFoundError("Item not found");
  }

  return skuMatch[0].id;
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

async function getItemRecord(db: any, itemId: string) {
  const records = await db
    .select({
      id: item.id,
      name: item.name,
    })
    .from(item)
    .where(eq(item.id, itemId))
    .limit(1);

  if (!records.length) {
    throw new NotFoundError("Item not found");
  }

  return records[0];
}

function serializeTimestamp(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(String(value)).toISOString();
}

async function getVisibleRemovalApprovals(
  db: any,
  auth: { id: string; role: string },
) {
  const visibilityClause =
    auth.role === "owner" ? sql`TRUE` : sql`ra.user_id = ${auth.id}`;

  const result = await db.execute(sql`
    SELECT
      ra.id,
      ra.item_id,
      i.name AS item_name,
      ra.warehouse_id,
      w.name AS warehouse_name,
      ra.bin_id,
      b.name AS bin_name,
      ra.quantity_requested,
      ra.current_balance,
      GREATEST(ra.quantity_requested - ra.current_balance, 0)::int AS shortfall,
      ra.status,
      ra.user_id AS requested_by_user_id,
      requester.name AS requested_by_name,
      ra.approved_by_owner AS approved_by_owner_id,
      approver.name AS approved_by_owner_name,
      ra.movement_id,
      ra.created_at,
      ra.decided_at
    FROM ${removalApproval} ra
    INNER JOIN ${item} i ON i.id = ra.item_id
    INNER JOIN ${warehouse} w ON w.id = ra.warehouse_id
    INNER JOIN users requester ON requester.id = ra.user_id
    LEFT JOIN ${bin} b ON b.id = ra.bin_id
    LEFT JOIN users approver ON approver.id = ra.approved_by_owner
    WHERE ${visibilityClause}
    ORDER BY ra.created_at DESC
  `);

  const rows = Array.isArray(result) ? result : (result.rows ?? []);

  return rows.map((row: any) => ({
    id: String(row.id),
    item_id: String(row.item_id),
    item_name: String(row.item_name),
    warehouse_id: String(row.warehouse_id),
    warehouse_name: String(row.warehouse_name),
    ...(row.bin_id ? { bin_id: String(row.bin_id) } : {}),
    ...(row.bin_name ? { bin_name: String(row.bin_name) } : {}),
    quantity_requested: Number(row.quantity_requested),
    current_balance: Number(row.current_balance),
    shortfall: Number(row.shortfall),
    status: String(row.status) as z.infer<typeof RemovalApprovalStatus>,
    requested_by_user_id: String(row.requested_by_user_id),
    requested_by_name: String(row.requested_by_name),
    ...(row.approved_by_owner_id
      ? { approved_by_owner_id: String(row.approved_by_owner_id) }
      : {}),
    ...(row.approved_by_owner_name
      ? { approved_by_owner_name: String(row.approved_by_owner_name) }
      : {}),
    ...(row.movement_id ? { movement_id: String(row.movement_id) } : {}),
    created_at: serializeTimestamp(row.created_at),
    ...(row.decided_at
      ? { decided_at: serializeTimestamp(row.decided_at) }
      : {}),
  }));
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
    whereClauses.push(
      sql`inventory_balance.warehouse_id = ${filters.warehouse_id}`,
    );
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

async function getPointBalance(
  db: any,
  params: { item_id: string; warehouse_id: string; bin_id?: string },
): Promise<number> {
  const binFilter = params.bin_id
    ? sql`AND inventory_balance.bin_id = ${params.bin_id}`
    : sql`AND inventory_balance.bin_id IS NULL`;

  const result = await db.execute(sql`
    SELECT COALESCE(SUM(inventory_balance.quantity), 0)::int AS quantity
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
    WHERE inventory_balance.warehouse_id = ${params.warehouse_id}
      AND inventory_balance.item_id = ${params.item_id}
      ${binFilter}
  `);

  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  return Number(rows[0]?.quantity ?? 0);
}

function getInventoryLockScope(warehouseId: string, binId?: string) {
  return `${warehouseId}:${binId ?? "warehouse"}`;
}

function requirePersonalMovementAccount(c: Parameters<typeof requireAuth>[0]) {
  const auth = requireAuth(c);

  if (auth.role === "owner") {
    throw new ForbiddenError(PERSONAL_USER_ACCOUNT_REQUIRED_MESSAGE);
  }

  return auth;
}

inventoryRouter.openapi(addStockRoute, async (c) => {
  const auth = requirePersonalMovementAccount(c);
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

inventoryRouter.openapi(removeStockRoute, async (c) => {
  const auth = requirePersonalMovementAccount(c);
  const db = c.get("db");
  const data = c.req.valid("json");
  const warehouseRecord = await getWarehouseRecord(db, data.warehouse_id);
  const requestedOwnerOverride = data.owner_override === true;
  const requestOwnerApproval = data.request_owner_approval === true;

  await getItemRecord(db, data.item_id);

  if (warehouseRecord.use_bins && !data.bin_id) {
    throw new BadRequestError("Bin required for this warehouse");
  }

  if (!warehouseRecord.use_bins && data.bin_id) {
    throw new BadRequestError("Bins are not enabled for this warehouse");
  }

  if (data.bin_id) {
    await getBinRecord(db, warehouseRecord.id, data.bin_id);
  }

  if (requestedOwnerOverride && auth.role !== "owner") {
    throw new ForbiddenError("Owner role required to override stock shortfall");
  }

  const removalOutcome = await db.execute(sql`
      WITH stock_lock AS (
        SELECT pg_advisory_xact_lock(
          hashtext(${getInventoryLockScope(warehouseRecord.id, data.bin_id)}),
          hashtext(${data.item_id})
        )
      ),
      current_balance AS (
        SELECT COALESCE(SUM(inventory_balance.quantity), 0)::int AS quantity
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
        CROSS JOIN stock_lock
        WHERE inventory_balance.warehouse_id = ${warehouseRecord.id}
          AND inventory_balance.item_id = ${data.item_id}
          ${
            data.bin_id
              ? sql`AND inventory_balance.bin_id = ${data.bin_id}`
              : sql`AND inventory_balance.bin_id IS NULL`
          }
      ),
      decision AS (
        SELECT
          quantity AS current_balance,
          (${data.quantity} > quantity) AS requires_override,
          GREATEST(${data.quantity} - quantity, 0)::int AS shortfall,
          (${data.quantity} > quantity AND ${requestedOwnerOverride} AND ${auth.role === "owner"}) AS owner_override_applied
        FROM current_balance
      ),
      inserted AS (
        INSERT INTO movement (
          type,
          user_id,
          item_id,
          source_warehouse_id,
          source_bin_id,
          quantity,
          override_by_owner
        )
        SELECT
          'REMOVE',
          ${auth.id},
          ${data.item_id},
          ${warehouseRecord.id},
          ${data.bin_id ?? null},
          ${data.quantity},
          decision.owner_override_applied
        FROM decision
        WHERE NOT decision.requires_override OR decision.owner_override_applied
        RETURNING id, override_by_owner
      )
      SELECT
        decision.current_balance,
        decision.requires_override,
        decision.shortfall,
        decision.owner_override_applied,
        inserted.id AS movement_id,
        inserted.override_by_owner
      FROM decision
      LEFT JOIN inserted ON true
    `);

  const removalRows = Array.isArray(removalOutcome)
    ? removalOutcome
    : (removalOutcome.rows ?? []);
  const removalResult = removalRows[0] as
    | {
        current_balance: number | string;
        requires_override: boolean;
        shortfall: number | string;
        owner_override_applied: boolean;
        movement_id: string | null;
        override_by_owner: boolean | null;
      }
    | undefined;

  if (!removalResult) {
    throw new Error("Failed to evaluate stock removal");
  }

  const currentBalance = Number(removalResult.current_balance);
  const shortfall = Number(removalResult.shortfall);
  const requiresOverride = Boolean(removalResult.requires_override);

  if (requiresOverride && !removalResult.movement_id) {
    if (!requestOwnerApproval) {
      return c.json(
        {
          success: false as const,
          warning: "Insufficient stock. Owner approval is required to proceed.",
          owner_approval_required: true as const,
          approval_requested: false,
          current_balance: currentBalance,
          requested_quantity: data.quantity,
          shortfall,
        },
        422,
      );
    }

    const pendingCondition = and(
      eq(removalApproval.user_id, auth.id),
      eq(removalApproval.item_id, data.item_id),
      eq(removalApproval.warehouse_id, warehouseRecord.id),
      eq(removalApproval.quantity_requested, data.quantity),
      eq(removalApproval.status, "pending"),
      data.bin_id
        ? eq(removalApproval.bin_id, data.bin_id)
        : sql`${removalApproval.bin_id} IS NULL`,
    );

    const pendingApprovals = await db
      .select({
        id: removalApproval.id,
        status: removalApproval.status,
      })
      .from(removalApproval)
      .where(pendingCondition)
      .limit(1);

    const approvalRecord = pendingApprovals.length
      ? (
          await db
            .update(removalApproval)
            .set({
              current_balance: currentBalance,
            })
            .where(eq(removalApproval.id, pendingApprovals[0].id))
            .returning({
              id: removalApproval.id,
              status: removalApproval.status,
            })
        )[0]
      : (
          await db
            .insert(removalApproval)
            .values({
              user_id: auth.id,
              item_id: data.item_id,
              warehouse_id: warehouseRecord.id,
              ...(data.bin_id ? { bin_id: data.bin_id } : {}),
              quantity_requested: data.quantity,
              current_balance: currentBalance,
              status: "pending",
            })
            .returning({
              id: removalApproval.id,
              status: removalApproval.status,
            })
        )[0];

    if (!approvalRecord) {
      throw new Error("Failed to create removal approval");
    }

    return c.json(
      {
        success: false as const,
        warning: "Insufficient stock. Owner approval is required to proceed.",
        owner_approval_required: true as const,
        approval_requested: true,
        approval_id: approvalRecord.id,
        approval_status: approvalRecord.status,
        current_balance: currentBalance,
        requested_quantity: data.quantity,
        shortfall,
      },
      422,
    );
  }

  if (!removalResult.movement_id) {
    throw new Error("Failed to create movement");
  }

  return c.json(
    {
      success: true as const,
      movement_id: removalResult.movement_id,
      item_id: data.item_id,
      warehouse_id: warehouseRecord.id,
      ...(data.bin_id ? { bin_id: data.bin_id } : {}),
      quantity_removed: data.quantity,
      balance_after: currentBalance - data.quantity,
      owner_override_applied: Boolean(removalResult.override_by_owner),
    },
    201,
  );
});

inventoryRouter.openapi(transferStockRoute, async (c) => {
  const auth = requirePersonalMovementAccount(c);
  const db = c.get("db");
  const data = c.req.valid("json");

  if (data.source_warehouse_id === data.dest_warehouse_id) {
    throw new BadRequestError(
      "Source and destination warehouses must be different",
    );
  }

  const sourceWarehouse = await getWarehouseRecord(
    db,
    data.source_warehouse_id,
  );
  const destWarehouse = await getWarehouseRecord(db, data.dest_warehouse_id);

  await getItemRecord(db, data.item_id);

  if (sourceWarehouse.use_bins && !data.source_bin_id) {
    throw new BadRequestError("Source bin required for this warehouse");
  }

  if (!sourceWarehouse.use_bins && data.source_bin_id) {
    throw new BadRequestError("Bins are not enabled for the source warehouse");
  }

  if (destWarehouse.use_bins && !data.dest_bin_id) {
    throw new BadRequestError("Destination bin required for this warehouse");
  }

  if (!destWarehouse.use_bins && data.dest_bin_id) {
    throw new BadRequestError(
      "Bins are not enabled for the destination warehouse",
    );
  }

  if (data.source_bin_id) {
    await getBinRecord(db, sourceWarehouse.id, data.source_bin_id);
  }

  if (data.dest_bin_id) {
    await getBinRecord(db, destWarehouse.id, data.dest_bin_id);
  }

  const sourceLockScope = getInventoryLockScope(
    sourceWarehouse.id,
    data.source_bin_id,
  );
  const destLockScope = getInventoryLockScope(
    destWarehouse.id,
    data.dest_bin_id,
  );
  const lockScopes = [sourceLockScope, destLockScope].sort();

  const transferOutcome = await db.execute(sql`
      WITH first_lock AS (
        SELECT pg_advisory_xact_lock(
          hashtext(${lockScopes[0]}),
          hashtext(${data.item_id})
        )
      ),
      second_lock AS (
        SELECT pg_advisory_xact_lock(
          hashtext(${lockScopes[1]}),
          hashtext(${data.item_id})
        )
        FROM first_lock
      ),
      source_balance AS (
        SELECT COALESCE(SUM(inventory_balance.quantity), 0)::int AS quantity
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
        CROSS JOIN second_lock
        WHERE inventory_balance.warehouse_id = ${sourceWarehouse.id}
          AND inventory_balance.item_id = ${data.item_id}
          ${
            data.source_bin_id
              ? sql`AND inventory_balance.bin_id = ${data.source_bin_id}`
              : sql`AND inventory_balance.bin_id IS NULL`
          }
      ),
      dest_balance AS (
        SELECT COALESCE(SUM(inventory_balance.quantity), 0)::int AS quantity
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
        CROSS JOIN second_lock
        WHERE inventory_balance.warehouse_id = ${destWarehouse.id}
          AND inventory_balance.item_id = ${data.item_id}
          ${
            data.dest_bin_id
              ? sql`AND inventory_balance.bin_id = ${data.dest_bin_id}`
              : sql`AND inventory_balance.bin_id IS NULL`
          }
      ),
      decision AS (
        SELECT
          source_balance.quantity AS source_balance,
          dest_balance.quantity AS dest_balance,
          (source_balance.quantity >= ${data.quantity}) AS can_transfer
        FROM source_balance
        CROSS JOIN dest_balance
      ),
      inserted AS (
        INSERT INTO movement (
          type,
          user_id,
          item_id,
          source_warehouse_id,
          source_bin_id,
          dest_warehouse_id,
          dest_bin_id,
          quantity
        )
        SELECT
          'TRANSFER',
          ${auth.id},
          ${data.item_id},
          ${sourceWarehouse.id},
          ${data.source_bin_id ?? null},
          ${destWarehouse.id},
          ${data.dest_bin_id ?? null},
          ${data.quantity}
        FROM decision
        WHERE decision.can_transfer
        RETURNING id
      )
      SELECT
        decision.source_balance,
        decision.dest_balance,
        decision.can_transfer,
        inserted.id AS movement_id
      FROM decision
      LEFT JOIN inserted ON true
    `);

  const transferRows = Array.isArray(transferOutcome)
    ? transferOutcome
    : (transferOutcome.rows ?? []);
  const transferResult = transferRows[0] as
    | {
        source_balance: number | string;
        dest_balance: number | string;
        can_transfer: boolean;
        movement_id: string | null;
      }
    | undefined;

  if (!transferResult) {
    throw new Error("Failed to evaluate stock transfer");
  }

  const sourceBalance = Number(transferResult.source_balance);
  const destBalance = Number(transferResult.dest_balance);

  if (!transferResult.can_transfer || !transferResult.movement_id) {
    throw new AppError("Insufficient Stock", 422);
  }

  return c.json(
    {
      movement_id: transferResult.movement_id,
      item_id: data.item_id,
      quantity: data.quantity,
      source_warehouse_id: sourceWarehouse.id,
      dest_warehouse_id: destWarehouse.id,
      source_balance_after: sourceBalance - data.quantity,
      dest_balance_after: destBalance + data.quantity,
    },
    201,
  );
});

inventoryRouter.openapi(countAdjustRoute, async (c) => {
  const auth = requirePersonalMovementAccount(c);
  const db = c.get("db");
  const data = c.req.valid("json");
  const warehouseRecord = await getWarehouseRecord(db, data.warehouse_id);

  await getItemRecord(db, data.item_id);

  if (warehouseRecord.use_bins && !data.bin_id) {
    throw new BadRequestError("Bin required for this warehouse");
  }

  if (!warehouseRecord.use_bins && data.bin_id) {
    throw new BadRequestError("Bins are not enabled for this warehouse");
  }

  if (data.bin_id) {
    await getBinRecord(db, warehouseRecord.id, data.bin_id);
  }

  const adjustmentOutcome = await db.execute(sql`
      WITH stock_lock AS (
        SELECT pg_advisory_xact_lock(
          hashtext(${getInventoryLockScope(warehouseRecord.id, data.bin_id)}),
          hashtext(${data.item_id})
        )
      ),
      current_balance AS (
        SELECT COALESCE(SUM(inventory_balance.quantity), 0)::int AS quantity
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
        CROSS JOIN stock_lock
        WHERE inventory_balance.warehouse_id = ${warehouseRecord.id}
          AND inventory_balance.item_id = ${data.item_id}
          ${
            data.bin_id
              ? sql`AND inventory_balance.bin_id = ${data.bin_id}`
              : sql`AND inventory_balance.bin_id IS NULL`
          }
      ),
      adjustment AS (
        SELECT
          quantity AS previous_balance,
          (${data.observed_quantity} - quantity)::int AS delta,
          ${data.observed_quantity}::int AS new_balance
        FROM current_balance
      ),
      inserted AS (
        INSERT INTO movement (
          type,
          user_id,
          item_id,
          dest_warehouse_id,
          dest_bin_id,
          quantity
        )
        SELECT
          'COUNT_ADJUSTMENT',
          ${auth.id},
          ${data.item_id},
          ${warehouseRecord.id},
          ${data.bin_id ?? null},
          adjustment.delta
        FROM adjustment
        RETURNING id
      )
      SELECT
        adjustment.previous_balance,
        adjustment.new_balance,
        adjustment.delta,
        inserted.id AS movement_id
      FROM adjustment
      INNER JOIN inserted ON true
    `);

  const adjustmentRows = Array.isArray(adjustmentOutcome)
    ? adjustmentOutcome
    : (adjustmentOutcome.rows ?? []);
  const adjustmentResult = adjustmentRows[0] as
    | {
        previous_balance: number | string;
        new_balance: number | string;
        delta: number | string;
        movement_id: string;
      }
    | undefined;

  if (!adjustmentResult?.movement_id) {
    throw new Error("Failed to create count adjustment movement");
  }

  return c.json(
    {
      movement_id: adjustmentResult.movement_id,
      item_id: data.item_id,
      previous_balance: Number(adjustmentResult.previous_balance),
      new_balance: Number(adjustmentResult.new_balance),
      delta: Number(adjustmentResult.delta),
      movement_type: "COUNT_ADJUSTMENT" as const,
    },
    201,
  );
});

inventoryRouter.openapi(createManualMovementRoute, async (c) => {
  const auth = requireAuth(c);

  if (auth.role !== "owner") {
    throw new ForbiddenError("Owner role required");
  }

  // Manual movements must be created by an owner, but they must also be
  // attributable to a personal user account. Expect the client to provide
  // a personal user session token in the `X-Acting-User-Token` header.
  // Validate that token and use its `user_id` for the movement record.
  const actingUserToken =
    c.req.header("X-Acting-User-Token") || c.req.header("x-acting-user-token");
  if (!actingUserToken) {
    throw new ForbiddenError(PERSONAL_USER_ACCOUNT_REQUIRED_MESSAGE);
  }

  const actingRows = await c
    .get("db")
    .select()
    .from(session)
    .where(eq(session.token, actingUserToken))
    .limit(1);
  if (
    !actingRows.length ||
    actingRows[0].role !== "user" ||
    !actingRows[0].user_id
  ) {
    throw new ForbiddenError(PERSONAL_USER_ACCOUNT_REQUIRED_MESSAGE);
  }
  const actingUserId = actingRows[0].user_id as string;

  const db = c.get("db");
  const data = c.req.valid("json");

  const warehouseRecord = await getWarehouseRecord(db, data.warehouse_id);
  await getItemRecord(db, data.item_id);

  if (warehouseRecord.use_bins && !data.bin_id) {
    throw new BadRequestError("Bin required for this warehouse");
  }

  if (!warehouseRecord.use_bins && data.bin_id) {
    throw new BadRequestError("Bins are not enabled for this warehouse");
  }

  if (data.bin_id) {
    await getBinRecord(db, warehouseRecord.id, data.bin_id);
  }

  const isPositive = data.quantity > 0;
  const absQuantity = Math.abs(data.quantity);

  const created = await db
    .insert(movement)
    .values({
      type: "MANUAL_ADJUSTMENT",
      user_id: actingUserId,
      item_id: data.item_id,
      ...(isPositive
        ? {
            dest_warehouse_id: warehouseRecord.id,
            ...(data.bin_id ? { dest_bin_id: data.bin_id } : {}),
          }
        : {
            source_warehouse_id: warehouseRecord.id,
            ...(data.bin_id ? { source_bin_id: data.bin_id } : {}),
          }),
      quantity: absQuantity,
      ...(data.note ? { note: data.note } : {}),
    })
    .returning({
      id: movement.id,
      created_at: movement.created_at,
    });

  if (!created.length) {
    throw new Error("Failed to create movement");
  }

  return c.json(
    {
      movement_id: created[0].id,
      type: "MANUAL_ADJUSTMENT" as const,
      item_id: data.item_id,
      warehouse_id: warehouseRecord.id,
      ...(data.bin_id ? { bin_id: data.bin_id } : {}),
      quantity: data.quantity,
      ...(data.note ? { note: data.note } : {}),
      created_at: serializeTimestamp(created[0].created_at),
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

inventoryRouter.openapi(getCurrentBalanceRoute, async (c) => {
  requireAuth(c);

  const db = c.get("db");
  const { warehouse_id, sku } = c.req.valid("query");

  const whereClauses = [];

  if (warehouse_id) {
    whereClauses.push(sql`bal.warehouse_id = ${warehouse_id}::uuid`);
  }

  if (sku) {
    whereClauses.push(
      sql`i.id IN (SELECT item_id FROM item_sku WHERE sku ILIKE ${sku})`,
    );
  }

  const whereSql = whereClauses.length
    ? sql`AND ${sql.join(whereClauses, sql` AND `)}`
    : sql``;

  const result = await db.execute(sql`
    WITH balance AS (
      SELECT
        warehouse_id,
        bin_id,
        item_id,
        SUM(quantity)::int AS quantity
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
      ) mv
      GROUP BY warehouse_id, bin_id, item_id
    )
    SELECT
      i.id AS item_id,
      i.name AS item_name,
      bal.warehouse_id,
      w.name AS warehouse_name,
      bal.bin_id,
      bn.name AS bin_name,
      bal.quantity
    FROM balance bal
    INNER JOIN ${item} i ON i.id = bal.item_id
    INNER JOIN ${warehouse} w ON w.id = bal.warehouse_id
    LEFT JOIN ${bin} bn ON bn.id = bal.bin_id
    WHERE 1=1 ${whereSql}
    ORDER BY i.name, w.name, bn.name NULLS FIRST
  `);

  const rows = Array.isArray(result) ? result : (result.rows ?? []);

  const itemIds = [...new Set(rows.map((r: any) => String(r.item_id)))];
  const skusByItemId: Record<string, string[]> = {};

  if (itemIds.length > 0) {
    const skuResult = await db.execute(sql`
      SELECT item_id::text, sku
      FROM ${itemSku}
      WHERE item_id = ANY(ARRAY[${sql.join(
        itemIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )}])
      ORDER BY sku
    `);
    const skuRows = Array.isArray(skuResult)
      ? skuResult
      : (skuResult.rows ?? []);
    for (const row of skuRows) {
      const id = String(row.item_id);
      if (!skusByItemId[id]) skusByItemId[id] = [];
      skusByItemId[id].push(String(row.sku));
    }
  }

  const itemMap = new Map<
    string,
    {
      item_id: string;
      item_name: string;
      total_quantity: number;
      warehouses: Map<
        string,
        {
          warehouse_id: string;
          warehouse_name: string;
          quantity: number;
          bins: { bin_id: string; bin_name: string; quantity: number }[];
        }
      >;
    }
  >();

  for (const row of rows) {
    const itemId = String(row.item_id);
    const warehouseId = String(row.warehouse_id);
    const qty = Number(row.quantity);

    if (!itemMap.has(itemId)) {
      itemMap.set(itemId, {
        item_id: itemId,
        item_name: String(row.item_name),
        total_quantity: 0,
        warehouses: new Map(),
      });
    }

    const itemEntry = itemMap.get(itemId)!;
    itemEntry.total_quantity += qty;

    if (!itemEntry.warehouses.has(warehouseId)) {
      itemEntry.warehouses.set(warehouseId, {
        warehouse_id: warehouseId,
        warehouse_name: String(row.warehouse_name),
        quantity: 0,
        bins: [],
      });
    }

    const warehouseEntry = itemEntry.warehouses.get(warehouseId)!;
    warehouseEntry.quantity += qty;

    if (row.bin_id) {
      warehouseEntry.bins.push({
        bin_id: String(row.bin_id),
        bin_name: String(row.bin_name),
        quantity: qty,
      });
    }
  }

  const response = Array.from(itemMap.values()).map((entry) => ({
    item_id: entry.item_id,
    item_name: entry.item_name,
    skus: skusByItemId[entry.item_id] ?? [],
    total_quantity: entry.total_quantity,
    warehouses: Array.from(entry.warehouses.values()),
  }));

  return c.json(response, 200);
});

inventoryRouter.openapi(getCurrentBalanceCsvRoute, async (c) => {
  requireAuth(c);

  const db = c.get("db");
  const { warehouse_id, sku } = c.req.valid("query");

  const whereClauses = [];

  if (warehouse_id) {
    whereClauses.push(sql`bal.warehouse_id = ${warehouse_id}::uuid`);
  }

  if (sku) {
    whereClauses.push(
      sql`i.id IN (SELECT item_id FROM item_sku WHERE sku ILIKE ${sku})`,
    );
  }

  const whereSql = whereClauses.length
    ? sql`AND ${sql.join(whereClauses, sql` AND `)}`
    : sql``;

  const result = await db.execute(sql`
    WITH balance AS (
      SELECT
        warehouse_id,
        bin_id,
        item_id,
        SUM(quantity)::int AS quantity
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
      ) mv
      GROUP BY warehouse_id, bin_id, item_id
    )
    SELECT
      i.id AS item_id,
      i.name AS item_name,
      bal.warehouse_id,
      w.name AS warehouse_name,
      bal.bin_id,
      bn.name AS bin_name,
      bal.quantity
    FROM balance bal
    INNER JOIN ${item} i ON i.id = bal.item_id
    INNER JOIN ${warehouse} w ON w.id = bal.warehouse_id
    LEFT JOIN ${bin} bn ON bn.id = bal.bin_id
    WHERE 1=1 ${whereSql}
    ORDER BY i.name, w.name, bn.name NULLS FIRST
  `);

  const rows = Array.isArray(result) ? result : (result.rows ?? []);

  const itemIds = [...new Set(rows.map((r: any) => String(r.item_id)))];
  const skusByItemId: Record<string, string[]> = {};

  if (itemIds.length > 0) {
    const skuResult = await db.execute(sql`
      SELECT item_id::text, sku
      FROM ${itemSku}
      WHERE item_id = ANY(ARRAY[${sql.join(
        itemIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )}])
      ORDER BY sku
    `);
    const skuRows = Array.isArray(skuResult)
      ? skuResult
      : (skuResult.rows ?? []);
    for (const row of skuRows) {
      const id = String(row.item_id);
      if (!skusByItemId[id]) skusByItemId[id] = [];
      skusByItemId[id].push(String(row.sku));
    }
  }

  function esc(v: unknown) {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return '"' + s.replace(/"/g, '""') + '"';
  }

  let csv =
    "item_id,item_name,sku,warehouse_id,warehouse_name,bin_id,bin_name,quantity\n";

  for (const row of rows) {
    const id = String(row.item_id);
    const sku =
      skusByItemId[id] && skusByItemId[id].length > 0
        ? skusByItemId[id][0]
        : "";
    const line = [
      row.item_id,
      row.item_name,
      sku,
      row.warehouse_id,
      row.warehouse_name,
      row.bin_id ?? "",
      row.bin_name ?? "",
      String(row.quantity),
    ]
      .map(esc)
      .join(",");
    csv += line + "\n";
  }

  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", 'attachment; filename="current-balance.csv"');

  return c.body(csv, 200);
});

inventoryRouter.openapi(getRemovalApprovalsRoute, async (c) => {
  const auth = requireAuth(c);
  const db = c.get("db");
  const approvals = await getVisibleRemovalApprovals(db, auth);

  return c.json(approvals, 200);
});

inventoryRouter.openapi(approveRemovalApprovalRoute, async (c) => {
  const auth = requireAuth(c);
  const db = c.get("db");
  const { id } = c.req.valid("param");

  if (auth.role !== "owner") {
    throw new ForbiddenError("Owner role required to approve stock shortfall");
  }

  const result = await db.execute(sql`
    WITH target AS (
      SELECT id, status, user_id, item_id, warehouse_id, bin_id, quantity_requested
      FROM ${removalApproval}
      WHERE ${removalApproval.id} = ${id}
    ),
    updated_approval AS (
      UPDATE ${removalApproval}
      SET status = 'approved',
          approved_by_owner = ${auth.id},
          decided_at = now()
      WHERE ${removalApproval.id} = ${id}
        AND ${removalApproval.status} = 'pending'
      RETURNING id, status, decided_at, user_id, item_id, warehouse_id, bin_id, quantity_requested
    ),
    new_movement AS (
      INSERT INTO movement (
        type, user_id, item_id, source_warehouse_id, source_bin_id, quantity, override_by_owner
      )
      SELECT
        'REMOVE',
        updated_approval.user_id,
        updated_approval.item_id,
        updated_approval.warehouse_id,
        updated_approval.bin_id,
        updated_approval.quantity_requested,
        true
      FROM updated_approval
      RETURNING id
    ),
    finalized AS (
      UPDATE ${removalApproval}
      SET movement_id = new_movement.id
      FROM new_movement
      WHERE ${removalApproval.id} = ${id}
      RETURNING ${removalApproval.id}, ${removalApproval.status}, ${removalApproval.movement_id}, ${removalApproval.decided_at}
    )
    SELECT
      target.status AS original_status,
      finalized.id,
      finalized.status,
      finalized.movement_id,
      finalized.decided_at
    FROM target
    LEFT JOIN finalized ON true
  `);

  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  const row = rows[0] as
    | {
        original_status: string;
        id: string | null;
        status: string | null;
        movement_id: string | null;
        decided_at: unknown;
      }
    | undefined;

  if (!row) {
    throw new NotFoundError("Removal approval not found");
  }

  if (!row.id) {
    if (row.original_status !== "pending") {
      throw new ConflictError("Removal approval already processed");
    }
    throw new NotFoundError("Removal approval not found");
  }

  return c.json(
    {
      approval_id: row.id,
      status: row.status as "approved" | "pending" | "rejected",
      ...(row.movement_id ? { movement_id: row.movement_id } : {}),
      decided_at: serializeTimestamp(row.decided_at),
    },
    200,
  );
});

inventoryRouter.openapi(rejectRemovalApprovalRoute, async (c) => {
  const auth = requireAuth(c);
  const db = c.get("db");
  const { id } = c.req.valid("param");

  if (auth.role !== "owner") {
    throw new ForbiddenError("Owner role required to reject stock shortfall");
  }

  const result = await db.execute(sql`
    WITH target AS (
      SELECT id, status
      FROM ${removalApproval}
      WHERE ${removalApproval.id} = ${id}
    ),
    updated AS (
      UPDATE ${removalApproval}
      SET status = 'rejected',
          approved_by_owner = ${auth.id},
          decided_at = now()
      WHERE ${removalApproval.id} = ${id}
        AND ${removalApproval.status} = 'pending'
      RETURNING id, status, movement_id, decided_at
    )
    SELECT
      target.status AS original_status,
      updated.id,
      updated.status,
      updated.movement_id,
      updated.decided_at
    FROM target
    LEFT JOIN updated ON true
  `);

  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  const row = rows[0] as
    | {
        original_status: string;
        id: string | null;
        status: string | null;
        movement_id: string | null;
        decided_at: unknown;
      }
    | undefined;

  if (!row) {
    throw new NotFoundError("Removal approval not found");
  }

  if (!row.id) {
    if (row.original_status !== "pending") {
      throw new ConflictError("Removal approval already processed");
    }
    throw new NotFoundError("Removal approval not found");
  }

  return c.json(
    {
      approval_id: row.id,
      status: row.status as "approved" | "pending" | "rejected",
      ...(row.movement_id ? { movement_id: row.movement_id } : {}),
      decided_at: serializeTimestamp(row.decided_at),
    },
    200,
  );
});

inventoryRouter.post("/bulk-balance", async (c) => {
  const auth = requireAuth(c);
  if (auth.role !== "owner") {
    throw new ForbiddenError("Owner role required");
  }

  const db = c.get("db");

  // When an owner performs movements on behalf of a personal user account,
  // the client must provide an acting user session token so movements can be
  // attributed to a real user UUID (not the owner string id).
  const actingUserToken =
    c.req.header("X-Acting-User-Token") || c.req.header("x-acting-user-token");
  if (!actingUserToken) {
    return c.json({ error: "X-Acting-User-Token header is required" }, 400);
  }
  const actingRows = await db
    .select()
    .from(session)
    .where(eq(session.token, actingUserToken))
    .limit(1);
  if (
    !actingRows.length ||
    actingRows[0].role !== "user" ||
    !actingRows[0].user_id
  ) {
    return c.json({ error: "Invalid acting user token" }, 400);
  }
  const actingUserId = actingRows[0].user_id as string;

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: "Invalid form data" }, 400);
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return c.json({ error: "file field is required" }, 400);
  }

  const fileEntry = file as { text(): Promise<string> };
  const text = await fileEntry.text();
  const lines = text.split(/\r?\n/);

  if (lines.length === 0) {
    return c.json({ processed: 0, skipped: 0, errors: [] });
  }

  const header = lines[0].split(",").map((h: string) => h.trim().toLowerCase());
  const skuIdx = header.indexOf("sku");
  const warehouseNameIdx = header.indexOf("warehouse_name");
  const binNameIdx = header.indexOf("bin_name");
  const quantityIdx = header.indexOf("quantity");

  if (skuIdx === -1 || warehouseNameIdx === -1 || quantityIdx === -1) {
    return c.json(
      {
        error: "CSV must have 'sku', 'warehouse_name', and 'quantity' columns",
      },
      400,
    );
  }

  let processed = 0;
  let skipped = 0;
  const errors: { row: number; reason: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const rowNum = i + 1;
    const cols = line.split(",").map((col: string) => col.trim());
    const skuValue = skuIdx < cols.length ? cols[skuIdx] : "";
    const warehouseNameValue =
      warehouseNameIdx < cols.length ? cols[warehouseNameIdx] : "";
    const binNameValue =
      binNameIdx >= 0 && binNameIdx < cols.length ? cols[binNameIdx] : "";
    const quantityStr = quantityIdx < cols.length ? cols[quantityIdx] : "";

    if (!skuValue) {
      errors.push({ row: rowNum, reason: "sku is required" });
      continue;
    }

    if (!warehouseNameValue) {
      errors.push({ row: rowNum, reason: "warehouse_name is required" });
      continue;
    }

    const targetQuantity = parseInt(quantityStr, 10);
    if (isNaN(targetQuantity) || targetQuantity < 0) {
      errors.push({
        row: rowNum,
        reason: "quantity must be a non-negative integer",
      });
      continue;
    }

    try {
      const skuMatch = await db
        .select({ item_id: itemSku.item_id })
        .from(itemSku)
        .where(eq(itemSku.sku, skuValue))
        .limit(1);

      if (!skuMatch.length) {
        errors.push({
          row: rowNum,
          reason: `SKU '${skuValue}' not found`,
        });
        continue;
      }
      const itemId = String(skuMatch[0].item_id);

      const warehouseMatch = await db
        .select({ id: warehouse.id })
        .from(warehouse)
        .where(ilike(warehouse.name, warehouseNameValue))
        .limit(1);

      if (!warehouseMatch.length) {
        errors.push({
          row: rowNum,
          reason: `Warehouse '${warehouseNameValue}' not found`,
        });
        continue;
      }
      const warehouseId = String(warehouseMatch[0].id);

      let binId: string | undefined;
      if (binNameValue) {
        const binMatch = await db
          .select({ id: bin.id })
          .from(bin)
          .where(
            and(
              eq(bin.warehouse_id, warehouseId),
              ilike(bin.name, binNameValue),
            ),
          )
          .limit(1);

        if (!binMatch.length) {
          errors.push({
            row: rowNum,
            reason: `Bin '${binNameValue}' not found in warehouse '${warehouseNameValue}'`,
          });
          continue;
        }
        binId = String(binMatch[0].id);
      }

      const currentBalance = await getPointBalance(db, {
        item_id: itemId,
        warehouse_id: warehouseId,
        bin_id: binId,
      });

      const delta = targetQuantity - currentBalance;

      if (delta === 0) {
        skipped++;
        continue;
      }

      const isPositiveDelta = delta > 0;
      const absDelta = Math.abs(delta);

      await db.insert(movement).values({
        type: "COUNT_ADJUSTMENT",
        user_id: actingUserId,
        item_id: itemId,
        ...(isPositiveDelta
          ? {
              dest_warehouse_id: warehouseId,
              ...(binId ? { dest_bin_id: binId } : {}),
            }
          : {
              source_warehouse_id: warehouseId,
              ...(binId ? { source_bin_id: binId } : {}),
            }),
        quantity: absDelta,
      });

      processed++;
    } catch (err) {
      errors.push({
        row: rowNum,
        reason: err instanceof Error ? err.message : "Unexpected error",
      });
    }
  }

  return c.json({ processed, skipped, errors });
});

export default inventoryRouter;
