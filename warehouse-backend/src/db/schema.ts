import {
  pgTable,
  boolean,
  timestamp,
  uuid,
  varchar,
  uniqueIndex,
  sql,
} from "drizzle-orm/pg-core";

export const warehouse = pgTable("warehouse", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  use_bins: boolean("use_bins").default(false).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow(),
});
