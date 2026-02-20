-- AlterTable
ALTER TABLE "patients" DROP COLUMN IF EXISTS "address",
ADD COLUMN "address_cep"          TEXT,
ADD COLUMN "address_street"       TEXT,
ADD COLUMN "address_number"       TEXT,
ADD COLUMN "address_complement"   TEXT,
ADD COLUMN "address_neighborhood" TEXT,
ADD COLUMN "address_city"         TEXT,
ADD COLUMN "address_state"        TEXT;
