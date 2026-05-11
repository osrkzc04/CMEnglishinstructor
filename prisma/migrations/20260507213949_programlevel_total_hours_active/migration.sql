-- AlterTable
ALTER TABLE "ProgramLevel" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "totalHours" DECIMAL(6,2) NOT NULL DEFAULT 48;
