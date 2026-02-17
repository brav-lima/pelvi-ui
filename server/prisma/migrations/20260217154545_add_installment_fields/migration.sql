-- AlterTable
ALTER TABLE "financial_records" ADD COLUMN     "due_date" TIMESTAMP(3),
ADD COLUMN     "installment" INTEGER,
ADD COLUMN     "installment_total" INTEGER;
