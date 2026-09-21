-- CreateEnum
CREATE TYPE "VoidingLeakageAmount" AS ENUM ('SMALL', 'MODERATE', 'LARGE');

-- CreateTable
CREATE TABLE "voiding_diary_entries" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "urine_volume_ml" INTEGER,
    "voiding_duration_seconds" INTEGER,
    "fluid_intake_ml" INTEGER,
    "had_leakage" BOOLEAN NOT NULL DEFAULT false,
    "leakage_amount" "VoidingLeakageAmount",
    "changed_pad" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voiding_diary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voiding_diary_entries_organization_id_patient_id_recorded_a_idx" ON "voiding_diary_entries"("organization_id", "patient_id", "recorded_at");
