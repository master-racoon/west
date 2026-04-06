import { OpenAPIHono } from "@hono/zod-openapi";
import { logger } from "hono/logger";
import { createDbClient } from "./db";
import { AppError } from "./utils/errors";
import warehouseRoutes from "./routes/warehouses";

interface Bindings {
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
}

interface Variables {
  db?: any;
  auth?: any;
}

const app = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

// Global middleware
app.use("*", logger());

// CORS middleware
app.use("*", async (c, next) => {
  const origin = c.req.header("origin");
  const allowedOrigins = [
    c.env?.FRONTEND_URL || "http://localhost:5173",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ].filter(Boolean);

  if (origin && allowedOrigins.includes(origin)) {
    c.header("Access-Control-Allow-Origin", origin);
  }

  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  c.header("Access-Control-Allow-Credentials", "true");

  if (c.req.method === "OPTIONS") {
    return c.text("", 204);
  }

  await next();
});

// Database middleware - connects to Neon Postgres via serverless driver
app.use("*", async (c, next) => {
  const databaseUrl = c.env?.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set");
    return c.json({ error: "Database not configured" }, 500);
  }

  const db = createDbClient(databaseUrl);
  c.set("db", db);

  // Mock auth - replace with BetterAuth session once auth is wired up
  c.set("auth", {
    user: {
      id: "test-user-id",
      email: "test@example.com",
      role: "owner",
    },
  });

  await next();
});

// Error handler
app.onError((err, c) => {
  console.error("Error:", err);

  if (err instanceof AppError) {
    return c.json({ error: err.message }, err.statusCode);
  }

  return c.json({ error: "Internal server error" }, 500);
});

// Routes
app.route("/api/warehouses", warehouseRoutes);

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

export default app;
