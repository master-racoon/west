CREATE TYPE "removal_approval_status" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "removal_approval" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "item_id" uuid NOT NULL,
  "warehouse_id" uuid NOT NULL,
  "bin_id" uuid,
  "quantity_requested" integer NOT NULL,
  "current_balance" integer NOT NULL,
  "status" "removal_approval_status" DEFAULT 'pending' NOT NULL,
  "approved_by_owner" uuid,
  "movement_id" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "decided_at" timestamp,
  CONSTRAINT "removal_approval_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "removal_approval_item_id_item_id_fk"
    FOREIGN KEY ("item_id") REFERENCES "item"("id")
    ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "removal_approval_warehouse_id_warehouse_id_fk"
    FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id")
    ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "removal_approval_bin_id_bin_id_fk"
    FOREIGN KEY ("bin_id") REFERENCES "bin"("id")
    ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "removal_approval_approved_by_owner_users_id_fk"
    FOREIGN KEY ("approved_by_owner") REFERENCES "users"("id")
    ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "removal_approval_movement_id_movement_id_fk"
    FOREIGN KEY ("movement_id") REFERENCES "movement"("id")
    ON DELETE set null ON UPDATE no action
);

CREATE INDEX "idx_removal_approval_status"
  ON "removal_approval" ("status");

CREATE INDEX "idx_removal_approval_user_id"
  ON "removal_approval" ("user_id");

CREATE INDEX "idx_removal_approval_created_at"
  ON "removal_approval" ("created_at");