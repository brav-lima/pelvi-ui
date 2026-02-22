-- DropForeignKey
ALTER TABLE "financial_records" DROP CONSTRAINT "financial_records_patient_id_fkey";

-- AlterTable
ALTER TABLE "financial_records" ALTER COLUMN "patient_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "financial_records" ADD CONSTRAINT "financial_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
