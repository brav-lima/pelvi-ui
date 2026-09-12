-- DropForeignKey
ALTER TABLE "device_tokens" DROP CONSTRAINT "device_tokens_person_id_fkey";

-- CreateIndex
CREATE INDEX "device_tokens_person_id_idx" ON "device_tokens"("person_id");

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
