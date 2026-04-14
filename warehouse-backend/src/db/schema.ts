import {
  pgTable,
  boolean,
  timestamp,
  uuid,
  varchar,
  uniqueIndex,
  foreignKey,
  integer,
  text,
  index,
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

export const item = pgTable("item", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const barcode = pgTable(
  "barcode",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    item_id: uuid("item_id").notNull(),
    barcode: varchar("barcode", { length: 200 }).notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    fk_item: foreignKey({
      columns: [table.item_id],
      foreignColumns: [item.id],
    }).onDelete("cascade"),
    uq_barcode_value: uniqueIndex("idx_barcode_unique").on(table.barcode),
    idx_barcode_item_id: index("idx_barcode_item_id").on(table.item_id),
  }),
);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  pin_hash: text("pin_hash").notNull(),
  failed_attempts: integer("failed_attempts").notNull().default(0),
  locked_until: timestamp("locked_until"),
  role: text("role").notNull().default("user"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});
