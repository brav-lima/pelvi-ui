-- CreateEnum
CREATE TYPE "ClinicDocumentType" AS ENUM ('FILE', 'GENERATED');

-- CreateEnum
CREATE TYPE "GeneratedDocumentTemplate" AS ENUM ('ANAMNESIS_REPORT', 'APPOINTMENT_CERTIFICATE', 'ATTENDANCE_TERM', 'EVOLUTION_SUMMARY');

-- CreateTable
CREATE TABLE "clinic_documents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "type" "ClinicDocumentType" NOT NULL,
    "file_key" TEXT,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "template_type" "GeneratedDocumentTemplate",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clinic_documents_organization_id_active_idx" ON "clinic_documents"("organization_id", "active");

-- AddForeignKey
ALTER TABLE "clinic_documents" ADD CONSTRAINT "clinic_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
