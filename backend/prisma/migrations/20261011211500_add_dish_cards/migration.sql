CREATE TABLE "dish_cards" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "organization_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "created_by_user_id" UUID,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "photo_path" TEXT,
  "selling_price" DECIMAL(14,2),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dish_cards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dish_ingredients" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "dish_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  CONSTRAINT "dish_ingredients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dish_cards_branch_id_name_key" ON "dish_cards"("branch_id", "name");
CREATE INDEX "dish_cards_organization_id_is_active_idx" ON "dish_cards"("organization_id", "is_active");
CREATE INDEX "dish_cards_created_by_user_id_idx" ON "dish_cards"("created_by_user_id");
CREATE UNIQUE INDEX "dish_ingredients_dish_id_product_id_key" ON "dish_ingredients"("dish_id", "product_id");
CREATE INDEX "dish_ingredients_product_id_idx" ON "dish_ingredients"("product_id");

ALTER TABLE "dish_cards" ADD CONSTRAINT "dish_cards_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dish_cards" ADD CONSTRAINT "dish_cards_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dish_cards" ADD CONSTRAINT "dish_cards_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dish_ingredients" ADD CONSTRAINT "dish_ingredients_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dish_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dish_ingredients" ADD CONSTRAINT "dish_ingredients_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
