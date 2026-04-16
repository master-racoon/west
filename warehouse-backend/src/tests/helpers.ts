import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { sessions, type SessionUser } from "../authorization/middleware";
import { createDbClient } from "../db";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set for tests");
}

const db = createDbClient(databaseUrl);

export async function clearDatabase() {
  sessions.clear();

  await db.execute(
    sql`TRUNCATE TABLE movement, barcode, bin, users, item, warehouse RESTART IDENTITY CASCADE`,
  );
}

export async function signupUser(role: "owner" | "user" = "user") {
  const token = randomUUID();
  const user: SessionUser = {
    id: randomUUID(),
    role,
    name: `Test ${role}`,
  };

  sessions.set(token, user);

  return {
    ...user,
    email: `${role}@test.com`,
    token,
  };
}
