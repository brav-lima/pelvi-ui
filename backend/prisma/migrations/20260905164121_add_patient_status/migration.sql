-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "patients_organization_id_status_deleted_at_idx" ON "patients"("organization_id", "status", "deleted_at");
