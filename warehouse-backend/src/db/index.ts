import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function createDbClient(databaseUrl: string) {
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
