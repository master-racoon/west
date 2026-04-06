CREATE TABLE IF NOT EXISTS "bin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bin" ADD CONSTRAINT "bin_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_bin_unique_per_warehouse" ON "bin" USING btree ("warehouse_id","name");