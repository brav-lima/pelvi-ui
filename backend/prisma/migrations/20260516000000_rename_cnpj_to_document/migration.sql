-- Rename column "cnpj" to "document" in organizations table.
-- The Prisma field is already named "document"; only the DB column name changes.
-- Safe for existing data — sem alteração de tipo ou constraint.
ALTER TABLE "organizations" RENAME COLUMN "cnpj" TO "document";
