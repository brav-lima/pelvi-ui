-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CNPJ', 'CPF');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "document_type" "DocumentType";
