-- CreateEnum
CREATE TYPE "purchase_invoice_status" AS ENUM ('upload_pending', 'review', 'confirmed', 'rejected');

-- CreateEnum
CREATE TYPE "invoice_recognition_mode" AS ENUM ('demo', 'provider');

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN "purchase_invoice_id" UUID;

-- AlterTable
ALTER TABLE "supplier_ledger_entries" ADD COLUMN "purchase_invoice_id" UUID;

-- CreateTable
CREATE TABLE "purchase_invoices" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "supplier_id" UUID,
    "created_by_user_id" UUID,
    "confirmed_by_user_id" UUID,
    "status" "purchase_invoice_status" NOT NULL DEFAULT 'upload_pending',
    "recognition_mode" "invoice_recognition_mode" NOT NULL DEFAULT 'demo',
    "recognition_confidence" DECIMAL(5,4),
    "object_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "upload_expires_at" TIMESTAMP(3) NOT NULL,
    "invoice_number" TEXT,
    "invoice_date" DATE,
    "due_at" DATE,
    "total_amount" DECIMAL(14,2),
    "recognized_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoice_items" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "invoice_id" UUID NOT NULL,
    "product_id" UUID,
    "position" INTEGER NOT NULL,
    "detected_name" TEXT NOT NULL,
    "unit" "inventory_unit" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "line_total" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_object_key_key" ON "purchase_invoices"("object_key");

-- CreateIndex
CREATE INDEX "purchase_invoices_organization_id_created_at_idx" ON "purchase_invoices"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "purchase_invoices_branch_id_status_idx" ON "purchase_invoices"("branch_id", "status");

-- CreateIndex
CREATE INDEX "purchase_invoices_supplier_id_idx" ON "purchase_invoices"("supplier_id");

-- CreateIndex
CREATE INDEX "purchase_invoices_created_by_user_id_idx" ON "purchase_invoices"("created_by_user_id");

-- CreateIndex
CREATE INDEX "purchase_invoices_confirmed_by_user_id_idx" ON "purchase_invoices"("confirmed_by_user_id");

-- CreateIndex
CREATE INDEX "purchase_invoice_items_product_id_idx" ON "purchase_invoice_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoice_items_invoice_id_position_key" ON "purchase_invoice_items"("invoice_id", "position");

-- CreateIndex
CREATE INDEX "inventory_movements_purchase_invoice_id_idx" ON "inventory_movements"("purchase_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_ledger_entries_purchase_invoice_id_key" ON "supplier_ledger_entries"("purchase_invoice_id");

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_purchase_invoice_id_fkey" FOREIGN KEY ("purchase_invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_confirmed_by_user_id_fkey" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_ledger_entries" ADD CONSTRAINT "supplier_ledger_entries_purchase_invoice_id_fkey" FOREIGN KEY ("purchase_invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
