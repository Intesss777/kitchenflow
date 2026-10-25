-- CreateEnum
CREATE TYPE "sales_shift_status" AS ENUM ('review', 'confirmed');

-- CreateEnum
CREATE TYPE "sales_receipt_status" AS ENUM ('upload_pending', 'recognized', 'rejected');

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "sales_shift_id" UUID;

-- CreateTable
CREATE TABLE "sales_shifts" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "created_by_user_id" UUID,
    "confirmed_by_user_id" UUID,
    "shift_date" DATE NOT NULL,
    "status" "sales_shift_status" NOT NULL DEFAULT 'review',
    "recognition_mode" "invoice_recognition_mode" NOT NULL DEFAULT 'demo',
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_receipts" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "shift_id" UUID NOT NULL,
    "created_by_user_id" UUID,
    "status" "sales_receipt_status" NOT NULL DEFAULT 'upload_pending',
    "object_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "upload_expires_at" TIMESTAMP(3) NOT NULL,
    "recognition_confidence" DECIMAL(5,4),
    "recognized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_shift_lines" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "shift_id" UUID NOT NULL,
    "dish_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "sales_shift_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_shift_consumption" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "shift_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity_before" DECIMAL(14,3) NOT NULL,
    "quantity_used" DECIMAL(14,3) NOT NULL,
    "quantity_after" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "sales_shift_consumption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_shifts_organization_id_shift_date_idx" ON "sales_shifts"("organization_id", "shift_date");

-- CreateIndex
CREATE INDEX "sales_shifts_created_by_user_id_idx" ON "sales_shifts"("created_by_user_id");

-- CreateIndex
CREATE INDEX "sales_shifts_confirmed_by_user_id_idx" ON "sales_shifts"("confirmed_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_shifts_branch_id_shift_date_key" ON "sales_shifts"("branch_id", "shift_date");

-- CreateIndex
CREATE UNIQUE INDEX "sales_receipts_object_key_key" ON "sales_receipts"("object_key");

-- CreateIndex
CREATE INDEX "sales_receipts_shift_id_created_at_idx" ON "sales_receipts"("shift_id", "created_at");

-- CreateIndex
CREATE INDEX "sales_receipts_created_by_user_id_idx" ON "sales_receipts"("created_by_user_id");

-- CreateIndex
CREATE INDEX "sales_receipts_upload_expires_at_idx" ON "sales_receipts"("upload_expires_at");

-- CreateIndex
CREATE INDEX "sales_shift_lines_dish_id_idx" ON "sales_shift_lines"("dish_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_shift_lines_shift_id_dish_id_key" ON "sales_shift_lines"("shift_id", "dish_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_shift_lines_shift_id_position_key" ON "sales_shift_lines"("shift_id", "position");

-- CreateIndex
CREATE INDEX "sales_shift_consumption_product_id_idx" ON "sales_shift_consumption"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_shift_consumption_shift_id_product_id_key" ON "sales_shift_consumption"("shift_id", "product_id");

-- CreateIndex
CREATE INDEX "inventory_movements_sales_shift_id_idx" ON "inventory_movements"("sales_shift_id");

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_sales_shift_id_fkey" FOREIGN KEY ("sales_shift_id") REFERENCES "sales_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_shifts" ADD CONSTRAINT "sales_shifts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_shifts" ADD CONSTRAINT "sales_shifts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_shifts" ADD CONSTRAINT "sales_shifts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_shifts" ADD CONSTRAINT "sales_shifts_confirmed_by_user_id_fkey" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_receipts" ADD CONSTRAINT "sales_receipts_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "sales_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_receipts" ADD CONSTRAINT "sales_receipts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_shift_lines" ADD CONSTRAINT "sales_shift_lines_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "sales_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_shift_lines" ADD CONSTRAINT "sales_shift_lines_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dish_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_shift_consumption" ADD CONSTRAINT "sales_shift_consumption_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "sales_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_shift_consumption" ADD CONSTRAINT "sales_shift_consumption_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
