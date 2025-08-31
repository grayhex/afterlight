-- AlterEnum
ALTER TYPE "UserRole" RENAME VALUE 'User' TO 'Owner';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'Verifier';

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'Owner';
