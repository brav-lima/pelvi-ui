-- CreateEnum: SensitiveLegalBasis — hipóteses legais Art. 11 LGPD
CREATE TYPE "SensitiveLegalBasis" AS ENUM (
  'CONSENT',
  'LEGAL_OBLIGATION',
  'PUBLIC_POLICY',
  'RESEARCH',
  'CONTRACT_EXECUTION',
  'HEALTH_PROTECTION',
  'FRAUD_PREVENTION'
);

-- AlterTable: Anamnesis — add legal basis fields
ALTER TABLE "anamneses"
  ADD COLUMN "legal_basis"       "SensitiveLegalBasis" NOT NULL DEFAULT 'HEALTH_PROTECTION',
  ADD COLUMN "consent_id"        TEXT,
  ADD COLUMN "legal_basis_notes" TEXT;

-- AlterTable: PerinealAssessment — add legal basis fields
ALTER TABLE "perineal_assessments"
  ADD COLUMN "legal_basis"       "SensitiveLegalBasis" NOT NULL DEFAULT 'HEALTH_PROTECTION',
  ADD COLUMN "consent_id"        TEXT,
  ADD COLUMN "legal_basis_notes" TEXT;

-- AlterTable: Evolution — add legal basis fields
ALTER TABLE "evolutions"
  ADD COLUMN "legal_basis" "SensitiveLegalBasis" NOT NULL DEFAULT 'HEALTH_PROTECTION',
  ADD COLUMN "consent_id"  TEXT;
