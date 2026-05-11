-- CreateEnum
CREATE TYPE "SessionCancelledBy" AS ENUM ('TEACHER', 'ADMIN');

-- AlterTable
ALTER TABLE "ClassParticipant" ADD COLUMN     "absenceNote" TEXT,
ADD COLUMN     "noticedAbsenceAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN     "cancelledBy" "SessionCancelledBy";
