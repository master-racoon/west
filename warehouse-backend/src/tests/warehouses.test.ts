import { describe, it, expect, beforeEach } from "vitest";
import app from "../app";
import { clearDatabase, signupUser } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set for tests");
}

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

describe("Warehouse Routes", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe("POST /api/warehouses", () => {
    it("should create a warehouse with valid data (owner)", async () => {
      const owner = await signupUser("owner");

      const res = await makeRequest("POST", "/api/warehouses", {
        headers: {
          Authorization: `Bearer ${owner.token}`,
        },
        body: JSON.stringify({
          name: "Main Warehouse",
          use_bins: true,
        }),
      });

      expect(res.status).toBe(201);
      const data = (await res.json()) as Record<string, unknown>;
      expect(data).toHaveProperty("id");
      expect(data.name).toBe("Main Warehouse");
      expect(data.use_bins).toBe(true);
      expect(data).toHaveProperty("created_at");
    });

    it("should reject non-owner users with 403", async () => {
      const user = await signupUser("user");

      const res = await makeRequest("POST", "/api/warehouses", {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          name: "Another Warehouse",
          use_bins: false,
        }),
      });

      expect(res.status).toBe(403);
    });

    it("should return 409 for duplicate warehouse name", async () => {
      const owner = await signupUser("owner");
      const headers = {
        Authorization: `Bearer ${owner.token}`,
      };

      // First warehouse
      const res1 = await makeRequest("POST", "/api/warehouses", {
        headers,
        body: JSON.stringify({
          name: "Duplicate Test",
          use_bins: false,
        }),
      });
      expect(res1.status).toBe(201);

      // Duplicate name
      const res2 = await makeRequest("POST", "/api/warehouses", {
        headers,
        body: JSON.stringify({
          name: "Duplicate Test",
          use_bins: true,
        }),
      });

      expect(res2.status).toBe(409);
    });

    it("should be case-insensitive for name uniqueness", async () => {
      const owner = await signupUser("owner");
      const headers = {
        Authorization: `Bearer ${owner.token}`,
      };

      // First warehouse
      const res1 = await makeRequest("POST", "/api/warehouses", {
        headers,
        body: JSON.stringify({
          name: "Warehouse A",
          use_bins: false,
        }),
      });
      expect(res1.status).toBe(201);

      // Same name different case
      const res2 = await makeRequest("POST", "/api/warehouses", {
        headers,
        body: JSON.stringify({
          name: "warehouse a",
          use_bins: false,
        }),
      });

      expect(res2.status).toBe(409);
    });

    it("should handle boundary names (1-100 chars)", async () => {
      const owner = await signupUser("owner");
      const headers = {
        Authorization: `Bearer ${owner.token}`,
      };

      // 1 character
      const res1 = await makeRequest("POST", "/api/warehouses", {
        headers,
        body: JSON.stringify({
          name: "A",
          use_bins: false,
        }),
      });
      expect(res1.status).toBe(201);

      // 100 characters
      const longName = "A".repeat(100);
      const res2 = await makeRequest("POST", "/api/warehouses", {
        headers,
        body: JSON.stringify({
          name: longName,
          use_bins: false,
        }),
      });
      expect(res2.status).toBe(201);
    });

    it("should reject invalid input with 400", async () => {
      const owner = await signupUser("owner");

      // Empty name
      const res = await makeRequest("POST", "/api/warehouses", {
        headers: {
          Authorization: `Bearer ${owner.token}`,
        },
        body: JSON.stringify({
          name: "",
          use_bins: false,
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/warehouses", () => {
    it("should list all warehouses", async () => {
      const res = await makeRequest("GET", "/api/warehouses");

      expect(res.status).toBe(200);
      const data = (await res.json()) as Record<string, unknown>[];
      expect(Array.isArray(data)).toBe(true);
    });

    it("should include warehouse metadata", async () => {
      const owner = await signupUser("owner");

      // Create warehouses
      await makeRequest("POST", "/api/warehouses", {
        headers: {
          Authorization: `Bearer ${owner.token}`,
        },
        body: JSON.stringify({
          name: "Warehouse 1",
          use_bins: true,
        }),
      });

      const res = await makeRequest("GET", "/api/warehouses");
      expect(res.status).toBe(200);
      const data = (await res.json()) as Record<string, unknown>[];

      // Should have metadata fields
      if (data.length > 0) {
        const warehouse = data[0];
        expect(warehouse).toHaveProperty("id");
        expect(warehouse).toHaveProperty("name");
        expect(warehouse).toHaveProperty("use_bins");
        expect(warehouse).toHaveProperty("created_at");
      }
    });
  });

  describe("PUT /api/warehouses/:id", () => {
    it("should update a warehouse name and use_bins flag", async () => {
      const owner = await signupUser("owner");
      const headers = {
        Authorization: `Bearer ${owner.token}`,
      };

      const createRes = await makeRequest("POST", "/api/warehouses", {
        headers,
        body: JSON.stringify({
          name: "Original Warehouse",
          use_bins: false,
        }),
      });

      expect(createRes.status).toBe(201);
      const created = (await createRes.json()) as { id: string };

      const updateRes = await makeRequest(
        "PUT",
        `/api/warehouses/${created.id}`,
        {
          headers,
          body: JSON.stringify({
            name: "Updated Warehouse",
            use_bins: true,
          }),
        },
      );

      expect(updateRes.status).toBe(200);
      const updated = (await updateRes.json()) as Record<string, unknown>;
      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe("Updated Warehouse");
      expect(updated.use_bins).toBe(true);
    });
  });
});
