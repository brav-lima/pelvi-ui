-- CreateIndex
CREATE INDEX "financial_records_organization_id_due_date_deleted_at_idx" ON "financial_records"("organization_id", "due_date", "deleted_at");
