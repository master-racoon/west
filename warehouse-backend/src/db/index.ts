import { drizzle } from "drizzle-orm/neon-http";
import { neon, neonConfig } from "@neondatabase/serverless";
import * as schema from "./schema";

export function createDbClient(databaseUrl: string) {
  // Configure for local neon-http-proxy (HTTP, not HTTPS)
  if (
    databaseUrl.includes("db.localtest.me") ||
    databaseUrl.includes("neon-proxy-test")
  ) {
    const url = new URL(databaseUrl.replace(/^postgresql:\/\//, "http://"));
    const host = url.hostname;
    const port = url.port || "4444";

    neonConfig.fetchEndpoint = () => `http://${host}:${port}/sql`;
    neonConfig.useSecureWebSocket = false;
  }

  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}
