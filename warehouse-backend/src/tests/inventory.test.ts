import { expect, describe, it, beforeEach } from "vitest";
import app from "../app";
import { createDbClient } from "../db";
import { users } from "../db/schema";
import { clearDatabase, signupUser } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set for tests");
}

const db = createDbClient(databaseUrl);

const testBindings = {
  DATABASE_URL: databaseUrl,
  APP_PASSWORD: "test-password",
  FRONTEND_URL: "http://localhost:5173",
};

const makeRequest = (
  method: string,
  path: string,
  options?: { body?: string; headers?: Record<string, string> },
) => {
  const url = `http://localhost${path}`;
  const headers = options?.headers || {};

  if (options?.body) {
    headers["Content-Type"] = "application/json";
  }

  return app.request(
    url,
    {
      method,
      body: options?.body,
      headers,
    },
    testBindings,
  );
};

async function createAuthenticatedUser(role: "owner" | "user" = "owner") {
  const sessionUser = await signupUser(role);

  await db.insert(users).values({
    id: sessionUser.id,
    name: sessionUser.name,
    pin_hash: "test-hash",
    role: sessionUser.role,
  });

  return sessionUser;
}

async function createWarehouse(token: string, name: string, useBins = false) {
  const response = await makeRequest("POST", "/api/warehouses", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name,
      use_bins: useBins,
    }),
  });

  expect(response.status).toBe(201);

  return (await response.json()) as {
    id: string;
    name: string;
    use_bins: boolean;
  };
}

async function createItem(token: string, name: string) {
  const response = await makeRequest("POST", "/api/items", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name,
    }),
  });

  expect(response.status).toBe(201);

  return (await response.json()) as {
    id: string;
    name: string;
  };
}

async function createBin(token: string, warehouseId: string, name: string) {
  const response = await makeRequest("POST", "/api/bins", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      warehouse_id: warehouseId,
      name,
    }),
  });

  expect(response.status).toBe(201);

  return (await response.json()) as {
    id: string;
    name: string;
  };
}

async function addStock(
  token: string,
  data: {
    warehouse_id: string;
    barcode_or_item_id: string;
    quantity: number;
    bin_id?: string;
  },
) {
  const response = await makeRequest("POST", "/api/inventory/add", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  expect(response.status).toBe(201);
}

describe("Inventory count adjust routes", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it("rejects shared owner sessions from all movement-writing routes", async () => {
    const owner = await createAuthenticatedUser("owner");
    const operator = await createAuthenticatedUser("user");
    const sourceWarehouse = await createWarehouse(owner.token, "Owner Block A");
    const destWarehouse = await createWarehouse(owner.token, "Owner Block B");
    const item = await createItem(owner.token, "Blocked Item");

    await addStock(operator.token, {
      warehouse_id: sourceWarehouse.id,
      barcode_or_item_id: item.id,
      quantity: 5,
    });

    const addResponse = await makeRequest("POST", "/api/inventory/add", {
      headers: {
        Authorization: `Bearer ${owner.token}`,
      },
      body: JSON.stringify({
        warehouse_id: sourceWarehouse.id,
        barcode_or_item_id: item.id,
        quantity: 1,
      }),
    });

    const removeResponse = await makeRequest("POST", "/api/inventory/remove", {
      headers: {
        Authorization: `Bearer ${owner.token}`,
      },
      body: JSON.stringify({
        warehouse_id: sourceWarehouse.id,
        item_id: item.id,
        quantity: 1,
      }),
    });

    const transferResponse = await makeRequest(
      "POST",
      "/api/inventory/transfer",
      {
        headers: {
          Authorization: `Bearer ${owner.token}`,
        },
        body: JSON.stringify({
          item_id: item.id,
          quantity: 1,
          source_warehouse_id: sourceWarehouse.id,
          dest_warehouse_id: destWarehouse.id,
        }),
      },
    );

    const countAdjustResponse = await makeRequest(
      "POST",
      "/api/inventory/count-adjust",
      {
        headers: {
          Authorization: `Bearer ${owner.token}`,
        },
        body: JSON.stringify({
          warehouse_id: sourceWarehouse.id,
          item_id: item.id,
          observed_quantity: 5,
        }),
      },
    );

    const expectedBody = {
      error:
        "Inventory movements require a personal user account. Sign out of the owner account and sign in with your own PIN.",
    };

    expect(addResponse.status).toBe(403);
    expect(await addResponse.json()).toEqual(expectedBody);

    expect(removeResponse.status).toBe(403);
    expect(await removeResponse.json()).toEqual(expectedBody);

    expect(transferResponse.status).toBe(403);
    expect(await transferResponse.json()).toEqual(expectedBody);

    expect(countAdjustResponse.status).toBe(403);
    expect(await countAdjustResponse.json()).toEqual(expectedBody);
  });

  it("creates a positive delta when observed count is above the recorded balance", async () => {
    const owner = await createAuthenticatedUser("owner");
    const operator = await createAuthenticatedUser("user");
    const warehouse = await createWarehouse(
      owner.token,
      "Main Count Warehouse",
    );
    const item = await createItem(owner.token, "Tape Roll");

    await addStock(operator.token, {
      warehouse_id: warehouse.id,
      barcode_or_item_id: item.id,
      quantity: 10,
    });

    const response = await makeRequest("POST", "/api/inventory/count-adjust", {
      headers: {
        Authorization: `Bearer ${operator.token}`,
      },
      body: JSON.stringify({
        warehouse_id: warehouse.id,
        item_id: item.id,
        observed_quantity: 12,
      }),
    });

    expect(response.status).toBe(201);

    const body = (await response.json()) as {
      previous_balance: number;
      new_balance: number;
      delta: number;
      movement_type: string;
    };

    expect(body.previous_balance).toBe(10);
    expect(body.new_balance).toBe(12);
    expect(body.delta).toBe(2);
    expect(body.movement_type).toBe("COUNT_ADJUSTMENT");
  });

  it("creates a negative delta when observed count is below the recorded balance", async () => {
    const owner = await createAuthenticatedUser("owner");
    const operator = await createAuthenticatedUser("user");
    const warehouse = await createWarehouse(
      owner.token,
      "Loss Count Warehouse",
    );
    const item = await createItem(owner.token, "Cleaning Spray");

    await addStock(operator.token, {
      warehouse_id: warehouse.id,
      barcode_or_item_id: item.id,
      quantity: 10,
    });

    const response = await makeRequest("POST", "/api/inventory/count-adjust", {
      headers: {
        Authorization: `Bearer ${operator.token}`,
      },
      body: JSON.stringify({
        warehouse_id: warehouse.id,
        item_id: item.id,
        observed_quantity: 5,
      }),
    });

    expect(response.status).toBe(201);

    const body = (await response.json()) as {
      previous_balance: number;
      new_balance: number;
      delta: number;
    };

    expect(body.previous_balance).toBe(10);
    expect(body.new_balance).toBe(5);
    expect(body.delta).toBe(-5);
  });

  it("creates an audit movement even when the observed count matches the recorded balance", async () => {
    const owner = await createAuthenticatedUser("owner");
    const operator = await createAuthenticatedUser("user");
    const warehouse = await createWarehouse(
      owner.token,
      "Match Count Warehouse",
    );
    const item = await createItem(owner.token, "Protein Powder");

    await addStock(operator.token, {
      warehouse_id: warehouse.id,
      barcode_or_item_id: item.id,
      quantity: 10,
    });

    const response = await makeRequest("POST", "/api/inventory/count-adjust", {
      headers: {
        Authorization: `Bearer ${operator.token}`,
      },
      body: JSON.stringify({
        warehouse_id: warehouse.id,
        item_id: item.id,
        observed_quantity: 10,
      }),
    });

    expect(response.status).toBe(201);

    const body = (await response.json()) as {
      movement_id: string;
      previous_balance: number;
      new_balance: number;
      delta: number;
    };

    expect(body.movement_id).toBeTruthy();
    expect(body.previous_balance).toBe(10);
    expect(body.new_balance).toBe(10);
    expect(body.delta).toBe(0);
  });

  it("requires a bin when the warehouse uses bins", async () => {
    const owner = await createAuthenticatedUser("owner");
    const operator = await createAuthenticatedUser("user");
    const warehouse = await createWarehouse(
      owner.token,
      "Bin Count Warehouse",
      true,
    );
    const item = await createItem(owner.token, "Packing Tape");
    const bin = await createBin(owner.token, warehouse.id, "A-01");

    await addStock(operator.token, {
      warehouse_id: warehouse.id,
      barcode_or_item_id: item.id,
      quantity: 3,
      bin_id: bin.id,
    });

    const response = await makeRequest("POST", "/api/inventory/count-adjust", {
      headers: {
        Authorization: `Bearer ${operator.token}`,
      },
      body: JSON.stringify({
        warehouse_id: warehouse.id,
        item_id: item.id,
        observed_quantity: 2,
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Bin required for this warehouse",
    });
  });
});
