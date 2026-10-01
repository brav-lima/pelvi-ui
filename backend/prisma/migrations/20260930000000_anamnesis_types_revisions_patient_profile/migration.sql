-- CreateEnum
CREATE TYPE "AnamnesisType" AS ENUM ('PELVIC_GENERAL', 'PREGNANCY');

-- CreateEnum
CREATE TYPE "AnamnesisStatus" AS ENUM ('DRAFT', 'COMPLETED');

-- AlterTable: patient profile
ALTER TABLE "patients" ADD COLUMN "occupation" TEXT,
ADD COLUMN "marital_status" TEXT;

-- AlterTable: anamnesis
ALTER TABLE "anamneses" ADD COLUMN "type" "AnamnesisType",
ADD COLUMN "status" "AnamnesisStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "assessment_date" TIMESTAMP(3),
ADD COLUMN "completed_at" TIMESTAMP(3);

-- Backfill: legacy (4-field) records are finished clinical history, not pending drafts.
UPDATE "anamneses" SET "status" = 'COMPLETED', "completed_at" = "updated_at" WHERE "type" IS NULL;

-- CreateTable
CREATE TABLE "anamnesis_revisions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "anamnesis_id" TEXT NOT NULL,
    "professional_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "assessment_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anamnesis_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anamnesis_revisions_organization_id_anamnesis_id_idx" ON "anamnesis_revisions"("organization_id", "anamnesis_id");

-- AddForeignKey
ALTER TABLE "anamnesis_revisions" ADD CONSTRAINT "anamnesis_revisions_anamnesis_id_fkey" FOREIGN KEY ("anamnesis_id") REFERENCES "anamneses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
