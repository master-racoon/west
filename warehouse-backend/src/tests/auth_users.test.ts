import { hash } from "bcryptjs";
import { describe, it, expect, beforeEach } from "vitest";
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

async function createDbUser(options?: {
  name?: string;
  pin?: string;
  failed_attempts?: number;
  locked_until?: Date | null;
}) {
  const [createdUser] = await db
    .insert(users)
    .values({
      name: options?.name ?? "Alice",
      pin_hash: await hash(options?.pin ?? "1234", 10),
      failed_attempts: options?.failed_attempts ?? 0,
      locked_until: options?.locked_until ?? null,
      role: "user",
    })
    .returning({
      id: users.id,
      name: users.name,
      failed_attempts: users.failed_attempts,
      locked_until: users.locked_until,
      created_at: users.created_at,
    });

  return createdUser;
}

describe("PIN auth and user routes", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it("lists user names publicly in ascending name order", async () => {
    const bob = await createDbUser({ name: "Bob", pin: "1111" });
    const alice = await createDbUser({ name: "Alice", pin: "2222" });

    const response = await makeRequest("GET", "/api/users/names");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { id: alice.id, name: alice.name },
      { id: bob.id, name: bob.name },
    ]);
  });

  it("authenticates the shared owner password path and returns a 401 for a bad password", async () => {
    const successResponse = await makeRequest("POST", "/api/auth/login", {
      body: JSON.stringify({ password: "test-password" }),
    });

    expect(successResponse.status).toBe(200);
    expect(await successResponse.json()).toMatchObject({
      session_token: expect.any(String),
      user: {
        id: "owner-user",
        role: "owner",
      },
    });

    const failureResponse = await makeRequest("POST", "/api/auth/login", {
      body: JSON.stringify({ password: "wrong-password" }),
    });

    expect(failureResponse.status).toBe(401);
    expect(await failureResponse.json()).toEqual({
      error: "Incorrect owner password.",
    });
  });

  it("authenticates a personal user PIN and locks the account on the fifth wrong attempt", async () => {
    const owner = await signupUser("owner");
    const user = await createDbUser({ name: "Alice", pin: "1234" });

    const successResponse = await makeRequest("POST", "/api/auth/login", {
      body: JSON.stringify({ user_id: user.id, pin: "1234" }),
    });

    expect(successResponse.status).toBe(200);
    expect(await successResponse.json()).toMatchObject({
      session_token: expect.any(String),
      user: {
        id: user.id,
        name: "Alice",
        role: "user",
      },
    });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const wrongPinResponse = await makeRequest("POST", "/api/auth/login", {
        body: JSON.stringify({ user_id: user.id, pin: "0000" }),
      });

      expect(wrongPinResponse.status).toBe(401);
      expect(await wrongPinResponse.json()).toEqual({
        error: "Incorrect PIN.",
      });
    }

    const lockedResponse = await makeRequest("POST", "/api/auth/login", {
      body: JSON.stringify({ user_id: user.id, pin: "0000" }),
    });

    expect(lockedResponse.status).toBe(423);
    expect(await lockedResponse.json()).toEqual({
      error:
        "Account locked. Ask an owner to unlock it or try again in 15 minutes.",
    });

    const stillLockedResponse = await makeRequest("POST", "/api/auth/login", {
      body: JSON.stringify({ user_id: user.id, pin: "1234" }),
    });

    expect(stillLockedResponse.status).toBe(423);

    const unlockResponse = await makeRequest(
      "POST",
      `/api/users/${user.id}/unlock`,
      {
        headers: {
          Authorization: `Bearer ${owner.token}`,
        },
      },
    );

    expect(unlockResponse.status).toBe(200);

    const unlockedLoginResponse = await makeRequest("POST", "/api/auth/login", {
      body: JSON.stringify({ user_id: user.id, pin: "1234" }),
    });

    expect(unlockedLoginResponse.status).toBe(200);
  });

  it("creates and lists users for owner sessions only", async () => {
    const owner = await signupUser("owner");
    const regularUser = await signupUser("user");

    const createResponse = await makeRequest("POST", "/api/users", {
      headers: {
        Authorization: `Bearer ${owner.token}`,
      },
      body: JSON.stringify({ name: "Alice", pin: "1234" }),
    });

    expect(createResponse.status).toBe(201);
    expect(await createResponse.json()).toMatchObject({
      id: expect.any(String),
      name: "Alice",
      role: "user",
    });

    const ownerListResponse = await makeRequest("GET", "/api/users", {
      headers: {
        Authorization: `Bearer ${owner.token}`,
      },
    });

    expect(ownerListResponse.status).toBe(200);
    expect(await ownerListResponse.json()).toEqual([
      expect.objectContaining({
        id: expect.any(String),
        name: "Alice",
        role: "user",
        failed_attempts: 0,
        locked_until: null,
      }),
    ]);

    const nonOwnerCreateResponse = await makeRequest("POST", "/api/users", {
      headers: {
        Authorization: `Bearer ${regularUser.token}`,
      },
      body: JSON.stringify({ name: "Bob", pin: "4321" }),
    });

    expect(nonOwnerCreateResponse.status).toBe(403);

    const nonOwnerListResponse = await makeRequest("GET", "/api/users", {
      headers: {
        Authorization: `Bearer ${regularUser.token}`,
      },
    });

    expect(nonOwnerListResponse.status).toBe(403);
  });

  it("deletes users and returns the expected owner-only errors", async () => {
    const owner = await signupUser("owner");
    const regularUser = await signupUser("user");
    const user = await createDbUser({ name: "Delete Me", pin: "1234" });

    const nonOwnerResponse = await makeRequest(
      "DELETE",
      `/api/users/${user.id}`,
      {
        headers: {
          Authorization: `Bearer ${regularUser.token}`,
        },
      },
    );

    expect(nonOwnerResponse.status).toBe(403);

    const successResponse = await makeRequest(
      "DELETE",
      `/api/users/${user.id}`,
      {
        headers: {
          Authorization: `Bearer ${owner.token}`,
        },
      },
    );

    expect(successResponse.status).toBe(200);
    expect(await successResponse.json()).toEqual({ success: true });

    const notFoundResponse = await makeRequest(
      "DELETE",
      `/api/users/${user.id}`,
      {
        headers: {
          Authorization: `Bearer ${owner.token}`,
        },
      },
    );

    expect(notFoundResponse.status).toBe(404);
  });

  it("resets PINs, clears lockout state, and enforces owner-only access", async () => {
    const owner = await signupUser("owner");
    const regularUser = await signupUser("user");
    const lockedUser = await createDbUser({
      name: "Reset Me",
      pin: "1234",
      failed_attempts: 5,
      locked_until: new Date(Date.now() + 15 * 60 * 1000),
    });

    const nonOwnerResponse = await makeRequest(
      "PUT",
      `/api/users/${lockedUser.id}/pin`,
      {
        headers: {
          Authorization: `Bearer ${regularUser.token}`,
        },
        body: JSON.stringify({ pin: "4321" }),
      },
    );

    expect(nonOwnerResponse.status).toBe(403);

    const successResponse = await makeRequest(
      "PUT",
      `/api/users/${lockedUser.id}/pin`,
      {
        headers: {
          Authorization: `Bearer ${owner.token}`,
        },
        body: JSON.stringify({ pin: "4321" }),
      },
    );

    expect(successResponse.status).toBe(200);
    expect(await successResponse.json()).toEqual({ success: true });

    const loginResponse = await makeRequest("POST", "/api/auth/login", {
      body: JSON.stringify({ user_id: lockedUser.id, pin: "4321" }),
    });

    expect(loginResponse.status).toBe(200);

    const notFoundResponse = await makeRequest(
      "PUT",
      "/api/users/00000000-0000-0000-0000-000000000000/pin",
      {
        headers: {
          Authorization: `Bearer ${owner.token}`,
        },
        body: JSON.stringify({ pin: "1111" }),
      },
    );

    expect(notFoundResponse.status).toBe(404);
  });

  it("unlocks users and returns 404 and 403 for the expected cases", async () => {
    const owner = await signupUser("owner");
    const regularUser = await signupUser("user");
    const lockedUser = await createDbUser({
      name: "Unlock Me",
      pin: "1234",
      failed_attempts: 5,
      locked_until: new Date(Date.now() + 15 * 60 * 1000),
    });

    const nonOwnerResponse = await makeRequest(
      "POST",
      `/api/users/${lockedUser.id}/unlock`,
      {
        headers: {
          Authorization: `Bearer ${regularUser.token}`,
        },
      },
    );

    expect(nonOwnerResponse.status).toBe(403);

    const successResponse = await makeRequest(
      "POST",
      `/api/users/${lockedUser.id}/unlock`,
      {
        headers: {
          Authorization: `Bearer ${owner.token}`,
        },
      },
    );

    expect(successResponse.status).toBe(200);
    expect(await successResponse.json()).toEqual({ success: true });

    const loginResponse = await makeRequest("POST", "/api/auth/login", {
      body: JSON.stringify({ user_id: lockedUser.id, pin: "1234" }),
    });

    expect(loginResponse.status).toBe(200);

    const notFoundResponse = await makeRequest(
      "POST",
      "/api/users/00000000-0000-0000-0000-000000000000/unlock",
      {
        headers: {
          Authorization: `Bearer ${owner.token}`,
        },
      },
    );

    expect(notFoundResponse.status).toBe(404);
  });
});
