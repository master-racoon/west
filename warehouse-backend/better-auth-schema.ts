/**
 * Temporary file to generate BetterAuth schema
 * Run: npx @better-auth/cli@latest generate --config ./better-auth-schema.ts --output ./src/db/better-auth-tables.ts
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";

const { DATABASE_URL = "" } = process.env;

const sql = neon(DATABASE_URL);
const db = drizzle(sql);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
  },
  secret: "temp-secret",
  baseURL: "http://localhost:8788",
});
