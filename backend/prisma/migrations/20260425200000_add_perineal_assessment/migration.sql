-- CreateTable
CREATE TABLE "perineal_assessments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "professional_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "perineal_assessments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "perineal_assessments" ADD CONSTRAINT "perineal_assessments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perineal_assessments" ADD CONSTRAINT "perineal_assessments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perineal_assessments" ADD CONSTRAINT "perineal_assessments_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "organization_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
