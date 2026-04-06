import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

// Load environment variables from specified env file or default .env.local
// Usage: tsx src/db/migrate.ts [env-file]
const envFile = process.argv[2] || ".env.local";
config({ path: envFile });

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL || "";

  if (!databaseUrl) {
    console.error("DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  console.log("Using env file:", envFile);
  console.log("Database:", databaseUrl.substring(0, 30) + "...");
  console.log("Running migrations...");
  const client = postgres(databaseUrl);
  const db = drizzle(client);

  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("✅ Migrations completed");
    await client.end();
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

runMigrations();
