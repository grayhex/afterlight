-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('User', 'Admin');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "password_hash" TEXT,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'User';

