import {
  pgTable,
  pgEnum,
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

export const movementType = pgEnum("movement_type", [
  "ADD",
  "REMOVE",
  "TRANSFER",
  "COUNT_ADJUSTMENT",
  "MANUAL_ADJUSTMENT",
]);

export const movement = pgTable(
  "movement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: movementType("type").notNull(),
    user_id: uuid("user_id").notNull(),
    item_id: uuid("item_id").notNull(),
    source_warehouse_id: uuid("source_warehouse_id"),
    source_bin_id: uuid("source_bin_id"),
    dest_warehouse_id: uuid("dest_warehouse_id"),
    dest_bin_id: uuid("dest_bin_id"),
    quantity: integer("quantity").notNull(),
    note: text("note"),
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    fk_user: foreignKey({
      columns: [table.user_id],
      foreignColumns: [users.id],
    }).onDelete("restrict"),
    fk_item: foreignKey({
      columns: [table.item_id],
      foreignColumns: [item.id],
    }).onDelete("restrict"),
    fk_source_warehouse: foreignKey({
      columns: [table.source_warehouse_id],
      foreignColumns: [warehouse.id],
    }).onDelete("restrict"),
    fk_source_bin: foreignKey({
      columns: [table.source_bin_id],
      foreignColumns: [bin.id],
    }).onDelete("restrict"),
    fk_dest_warehouse: foreignKey({
      columns: [table.dest_warehouse_id],
      foreignColumns: [warehouse.id],
    }).onDelete("restrict"),
    fk_dest_bin: foreignKey({
      columns: [table.dest_bin_id],
      foreignColumns: [bin.id],
    }).onDelete("restrict"),
    idx_movement_item_id: index("idx_movement_item_id").on(table.item_id),
    idx_movement_source_warehouse_id: index(
      "idx_movement_source_warehouse_id",
    ).on(table.source_warehouse_id),
    idx_movement_dest_warehouse_id: index("idx_movement_dest_warehouse_id").on(
      table.dest_warehouse_id,
    ),
    idx_movement_user_id: index("idx_movement_user_id").on(table.user_id),
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
