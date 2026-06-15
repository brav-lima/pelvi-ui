-- Convert plan column from enum to text, preserving existing values
ALTER TABLE "organizations" ALTER COLUMN "plan" TYPE TEXT USING "plan"::TEXT;
ALTER TABLE "organizations" ALTER COLUMN "plan" SET DEFAULT 'SOLO';

-- Drop the now-unused Plan enum
DROP TYPE IF EXISTS "Plan";
