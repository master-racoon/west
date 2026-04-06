import {
  pgTable,
  boolean,
  timestamp,
  uuid,
  varchar,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/pg-core";

export const warehouse = pgTable("warehouse", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  use_bins: boolean("use_bins").default(false).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const bin = pgTable(
  "bin",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    warehouse_id: uuid("warehouse_id").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    fk_warehouse: foreignKey({
      columns: [table.warehouse_id],
      foreignColumns: [warehouse.id],
    }).onDelete("cascade"),
    uq_bin_per_warehouse: uniqueIndex("idx_bin_unique_per_warehouse").on(
      table.warehouse_id,
      table.name,
    ),
  }),
);
