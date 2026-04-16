DO $$ BEGIN
 CREATE TYPE "movement_type" AS ENUM('ADD', 'REMOVE', 'TRANSFER', 'COUNT_ADJUSTMENT', 'MANUAL_ADJUSTMENT');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "movement_type" NOT NULL,
	"user_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"source_warehouse_id" uuid,
	"source_bin_id" uuid,
	"dest_warehouse_id" uuid,
	"dest_bin_id" uuid,
	"quantity" integer NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "movement_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "movement_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "movement_source_warehouse_id_warehouse_id_fk" FOREIGN KEY ("source_warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "movement_source_bin_id_bin_id_fk" FOREIGN KEY ("source_bin_id") REFERENCES "public"."bin"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "movement_dest_warehouse_id_warehouse_id_fk" FOREIGN KEY ("dest_warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "movement_dest_bin_id_bin_id_fk" FOREIGN KEY ("dest_bin_id") REFERENCES "public"."bin"("id") ON DELETE restrict ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "idx_movement_item_id" ON "movement" USING btree ("item_id");
CREATE INDEX IF NOT EXISTS "idx_movement_source_warehouse_id" ON "movement" USING btree ("source_warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_movement_dest_warehouse_id" ON "movement" USING btree ("dest_warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_movement_user_id" ON "movement" USING btree ("user_id");