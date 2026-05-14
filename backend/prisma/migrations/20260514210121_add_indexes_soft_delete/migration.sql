-- Priority 1: soft delete fields
ALTER TABLE "patients" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "financial_records" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- Priority 1: indexes for patients
CREATE INDEX "patients_organization_id_deleted_at_idx" ON "patients"("organization_id", "deleted_at");
CREATE INDEX "patients_organization_id_name_deleted_at_idx" ON "patients"("organization_id", "name", "deleted_at");

-- Priority 1: indexes for appointments
CREATE INDEX "appointments_organization_id_start_at_end_at_deleted_at_idx" ON "appointments"("organization_id", "start_at", "end_at", "deleted_at");
CREATE INDEX "appointments_organization_id_professional_id_start_at_deleted_at_idx" ON "appointments"("organization_id", "professional_id", "start_at", "deleted_at");
CREATE INDEX "appointments_organization_id_patient_id_deleted_at_idx" ON "appointments"("organization_id", "patient_id", "deleted_at");

-- Priority 1: indexes for financial_records
CREATE INDEX "financial_records_organization_id_created_at_deleted_at_idx" ON "financial_records"("organization_id", "created_at", "deleted_at");
CREATE INDEX "financial_records_organization_id_status_type_deleted_at_idx" ON "financial_records"("organization_id", "status", "type", "deleted_at");

-- Indexes for evolutions
CREATE INDEX "evolutions_organization_id_patient_id_idx" ON "evolutions"("organization_id", "patient_id");
CREATE INDEX "evolutions_organization_id_created_at_idx" ON "evolutions"("organization_id", "created_at");

-- Indexes for anamneses
CREATE INDEX "anamneses_organization_id_patient_id_idx" ON "anamneses"("organization_id", "patient_id");
CREATE INDEX "anamneses_organization_id_created_at_idx" ON "anamneses"("organization_id", "created_at");

-- Indexes for perineal_assessments
CREATE INDEX "perineal_assessments_organization_id_patient_id_idx" ON "perineal_assessments"("organization_id", "patient_id");
CREATE INDEX "perineal_assessments_organization_id_created_at_idx" ON "perineal_assessments"("organization_id", "created_at");

-- Indexes for treatment_packages
CREATE INDEX "treatment_packages_organization_id_patient_id_idx" ON "treatment_packages"("organization_id", "patient_id");
CREATE INDEX "treatment_packages_organization_id_created_at_idx" ON "treatment_packages"("organization_id", "created_at");
