-- AlterTable: Organization — add identity and address fields
ALTER TABLE "organizations"
  ADD COLUMN "legal_name"           TEXT,
  ADD COLUMN "state_registration"   TEXT,
  ADD COLUMN "address_cep"          TEXT,
  ADD COLUMN "address_street"       TEXT,
  ADD COLUMN "address_number"       TEXT,
  ADD COLUMN "address_complement"   TEXT,
  ADD COLUMN "address_neighborhood" TEXT,
  ADD COLUMN "address_city"         TEXT,
  ADD COLUMN "address_state"        TEXT;

-- AlterTable: OrganizationUser — add specialty and professional registration
ALTER TABLE "organization_users"
  ADD COLUMN "specialty"                TEXT,
  ADD COLUMN "professional_registration" TEXT;
