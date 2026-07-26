-- AlterTable
ALTER TABLE "evolutions" ADD COLUMN     "evolution_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: prior to this migration, created_at was the only date shown for
-- an evolution, so it's the best available value for pre-existing rows.
UPDATE "evolutions" SET "evolution_date" = "created_at";

-- DropIndex
DROP INDEX "evolutions_organization_id_created_at_idx";

-- CreateIndex
CREATE INDEX "evolutions_organization_id_evolution_date_idx" ON "evolutions"("organization_id", "evolution_date");
