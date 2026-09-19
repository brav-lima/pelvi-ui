-- CreateEnum
CREATE TYPE "PatientAccountStatus" AS ENUM ('ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "PatientAccountLinkStatus" AS ENUM ('PENDING_CONSENT', 'ACTIVE', 'DECLINED');

-- CreateEnum
CREATE TYPE "PatientConsentAction" AS ENUM ('REQUESTED', 'ACCEPTED', 'DECLINED', 'RESENT');

-- CreateEnum
CREATE TYPE "PatientConsentActorType" AS ENUM ('PATIENT', 'PROFESSIONAL');

-- CreateTable
CREATE TABLE "patient_accounts" (
    "id" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "password_hash" TEXT,
    "status" "PatientAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activated_at" TIMESTAMP(3),

    CONSTRAINT "patient_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_account_links" (
    "id" TEXT NOT NULL,
    "patient_account_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "status" "PatientAccountLinkStatus" NOT NULL DEFAULT 'PENDING_CONSENT',
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),

    CONSTRAINT "patient_account_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_consent_audits" (
    "id" TEXT NOT NULL,
    "patient_account_link_id" TEXT NOT NULL,
    "action" "PatientConsentAction" NOT NULL,
    "actor_type" "PatientConsentActorType" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_consent_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_treatment_plans" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "features" JSONB NOT NULL DEFAULT '{}',
    "updated_by_person_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_treatment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patient_accounts_cpf_key" ON "patient_accounts"("cpf");

-- CreateIndex
CREATE INDEX "patient_account_links_patient_account_id_status_idx" ON "patient_account_links"("patient_account_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "patient_account_links_patient_id_key" ON "patient_account_links"("patient_id");

-- CreateIndex
CREATE INDEX "patient_consent_audits_patient_account_link_id_idx" ON "patient_consent_audits"("patient_account_link_id");

-- CreateIndex
CREATE UNIQUE INDEX "patient_treatment_plans_patient_id_key" ON "patient_treatment_plans"("patient_id");
