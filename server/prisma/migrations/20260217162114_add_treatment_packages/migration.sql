-- CreateEnum
CREATE TYPE "TreatmentPackageStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELED');

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "treatment_package_id" TEXT;

-- AlterTable
ALTER TABLE "financial_records" ADD COLUMN     "treatment_package_id" TEXT;

-- CreateTable
CREATE TABLE "treatment_packages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "total_sessions" INTEGER NOT NULL,
    "used_sessions" INTEGER NOT NULL DEFAULT 0,
    "total_price" DECIMAL(10,2) NOT NULL,
    "status" "TreatmentPackageStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_package_procedures" (
    "id" TEXT NOT NULL,
    "treatment_package_id" TEXT NOT NULL,
    "procedure_id" TEXT NOT NULL,

    CONSTRAINT "treatment_package_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "treatment_package_procedures_treatment_package_id_procedure_key" ON "treatment_package_procedures"("treatment_package_id", "procedure_id");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_treatment_package_id_fkey" FOREIGN KEY ("treatment_package_id") REFERENCES "treatment_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_records" ADD CONSTRAINT "financial_records_treatment_package_id_fkey" FOREIGN KEY ("treatment_package_id") REFERENCES "treatment_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_packages" ADD CONSTRAINT "treatment_packages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_packages" ADD CONSTRAINT "treatment_packages_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_package_procedures" ADD CONSTRAINT "treatment_package_procedures_treatment_package_id_fkey" FOREIGN KEY ("treatment_package_id") REFERENCES "treatment_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_package_procedures" ADD CONSTRAINT "treatment_package_procedures_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
