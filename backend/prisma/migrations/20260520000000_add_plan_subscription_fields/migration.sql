-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('SOLO', 'CLINICA', 'REDE');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- AlterTable
ALTER TABLE "organizations"
  ADD COLUMN "plan"             "Plan"        NOT NULL DEFAULT 'SOLO',
  ADD COLUMN "plan_status"      "PlanStatus"  NOT NULL DEFAULT 'TRIAL',
  ADD COLUMN "trial_ends_at"    TIMESTAMP(3),
  ADD COLUMN "founder_discount" BOOLEAN       NOT NULL DEFAULT false;
