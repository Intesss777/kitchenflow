ALTER TABLE "purchase_invoices"
DROP CONSTRAINT "purchase_invoices_supplier_id_fkey",
ADD CONSTRAINT "purchase_invoices_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_invoice_items"
DROP CONSTRAINT "purchase_invoice_items_product_id_fkey",
ADD CONSTRAINT "purchase_invoice_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
