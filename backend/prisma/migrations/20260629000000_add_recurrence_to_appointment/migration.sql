-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "recurrence_group_id" UUID,
ADD COLUMN     "recurrence_index" INTEGER;
