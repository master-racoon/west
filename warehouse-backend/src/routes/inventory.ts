import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { and, eq, sql } from "drizzle-orm";
import { requireAuth } from "../authorization/middleware";
import {
  barcode,
  bin,
  item,
  itemSku,
  movement,
  removalApproval,
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

inventoryRouter.openapi(getBalanceRoute, async (c) => {
  requireAuth(c);

  const db = c.get("db");
  const filters = c.req.valid("query");
  const rows = await getBalanceRows(db, filters);

  return c.json(rows, 200);
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

export default inventoryRouter;
