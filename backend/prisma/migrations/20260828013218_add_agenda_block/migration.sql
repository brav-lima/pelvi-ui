-- CreateTable
CREATE TABLE "agenda_blocks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "professional_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agenda_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agenda_blocks_organization_id_start_at_end_at_idx" ON "agenda_blocks"("organization_id", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "agenda_blocks_organization_id_professional_id_start_at_idx" ON "agenda_blocks"("organization_id", "professional_id", "start_at");

-- AddForeignKey
ALTER TABLE "agenda_blocks" ADD CONSTRAINT "agenda_blocks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_blocks" ADD CONSTRAINT "agenda_blocks_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "organization_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "appointments_organization_id_professional_id_start_at_deleted_a" RENAME TO "appointments_organization_id_professional_id_start_at_delet_idx";

-- RenameIndex
ALTER INDEX "organizations_cnpj_key" RENAME TO "organizations_document_key";
