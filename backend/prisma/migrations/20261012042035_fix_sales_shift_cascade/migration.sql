-- DropForeignKey
ALTER TABLE "sales_shift_consumption" DROP CONSTRAINT "sales_shift_consumption_product_id_fkey";

-- DropForeignKey
ALTER TABLE "sales_shift_lines" DROP CONSTRAINT "sales_shift_lines_dish_id_fkey";

-- AddForeignKey
ALTER TABLE "sales_shift_lines" ADD CONSTRAINT "sales_shift_lines_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dish_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_shift_consumption" ADD CONSTRAINT "sales_shift_consumption_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
