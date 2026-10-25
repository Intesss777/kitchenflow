-- CreateIndex
CREATE INDEX "purchase_invoices_branch_id_invoice_date_created_at_idx" ON "purchase_invoices"("branch_id", "invoice_date", "created_at");
