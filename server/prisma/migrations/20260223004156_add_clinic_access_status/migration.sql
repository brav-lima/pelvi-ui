-- CreateEnum
CREATE TYPE "ClinicAccessStatus" AS ENUM ('ACTIVE', 'BLOCKED');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "access_status" "ClinicAccessStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT;
