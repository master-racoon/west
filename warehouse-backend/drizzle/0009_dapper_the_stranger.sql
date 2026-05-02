CREATE TABLE IF NOT EXISTS "item_sku" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"sku" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "item_sku" ADD CONSTRAINT "item_sku_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_item_sku_unique" ON "item_sku" USING btree ("sku");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_item_sku_item_id" ON "item_sku" USING btree ("item_id");