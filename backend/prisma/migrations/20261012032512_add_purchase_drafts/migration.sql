-- CreateTable
CREATE TABLE "purchase_drafts" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "supplier_id" UUID,
    "updated_by_user_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_draft_items" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "draft_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "requested_quantity" DECIMAL(14,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_draft_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_drafts_branch_id_key" ON "purchase_drafts"("branch_id");

-- CreateIndex
CREATE INDEX "purchase_drafts_organization_id_idx" ON "purchase_drafts"("organization_id");

-- CreateIndex
CREATE INDEX "purchase_drafts_supplier_id_idx" ON "purchase_drafts"("supplier_id");

-- CreateIndex
CREATE INDEX "purchase_drafts_updated_by_user_id_idx" ON "purchase_drafts"("updated_by_user_id");

-- CreateIndex
CREATE INDEX "purchase_draft_items_product_id_idx" ON "purchase_draft_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_draft_items_draft_id_product_id_key" ON "purchase_draft_items"("draft_id", "product_id");

-- AddForeignKey
ALTER TABLE "purchase_drafts" ADD CONSTRAINT "purchase_drafts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_drafts" ADD CONSTRAINT "purchase_drafts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_drafts" ADD CONSTRAINT "purchase_drafts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_drafts" ADD CONSTRAINT "purchase_drafts_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_draft_items" ADD CONSTRAINT "purchase_draft_items_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "purchase_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_draft_items" ADD CONSTRAINT "purchase_draft_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
