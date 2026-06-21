-- AlterTable
ALTER TABLE "financial_records" ADD COLUMN     "recurrence_group_id" UUID,
ADD COLUMN     "recurrence_index" INTEGER;
