-- CreateEnum
CREATE TYPE "BowelEffort" AS ENUM ('NONE', 'LIGHT', 'MODERATE', 'INTENSE');

-- CreateEnum
CREATE TYPE "BowelSensation" AS ENUM ('COMPLETE', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "BowelLeakageType" AS ENUM ('GAS', 'STOOL', 'GAS_AND_STOOL');

-- CreateTable
CREATE TABLE "bowel_diary_entries" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "had_bowel_movement" BOOLEAN NOT NULL DEFAULT false,
    "bristol_type" TEXT,
    "effort" "BowelEffort",
    "sensation" "BowelSensation",
    "bowel_movement_duration_seconds" INTEGER,
    "had_leakage" BOOLEAN NOT NULL DEFAULT false,
    "leakage_type" "BowelLeakageType",
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bowel_diary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bowel_diary_entries_organization_id_patient_id_recorded_at_idx" ON "bowel_diary_entries"("organization_id", "patient_id", "recorded_at");
