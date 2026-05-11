/*
  Warnings:

  - You are about to drop the column `enrollmentId` on the `TeacherAssignment` table. All the data in the column will be lost.
  - You are about to drop the `EnrollmentSlot` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `classGroupId` to the `ClassSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `classGroupId` to the `TeacherAssignment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ClassGroupStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "EnrollmentSlot" DROP CONSTRAINT "EnrollmentSlot_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "TeacherAssignment" DROP CONSTRAINT "TeacherAssignment_enrollmentId_fkey";

-- DropIndex
DROP INDEX "TeacherAssignment_enrollmentId_startDate_idx";

-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN     "classGroupId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "classGroupId" TEXT;

-- AlterTable
ALTER TABLE "TeacherAssignment" DROP COLUMN "enrollmentId",
ADD COLUMN     "classGroupId" TEXT NOT NULL;

-- DropTable
DROP TABLE "EnrollmentSlot";

-- CreateTable
CREATE TABLE "ClassGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "programLevelId" TEXT NOT NULL,
    "modality" "Modality" NOT NULL,
    "status" "ClassGroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "ClassGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassGroupSlot" (
    "id" TEXT NOT NULL,
    "classGroupId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,

    CONSTRAINT "ClassGroupSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassGroup_programLevelId_status_idx" ON "ClassGroup"("programLevelId", "status");

-- CreateIndex
CREATE INDEX "ClassGroup_status_idx" ON "ClassGroup"("status");

-- CreateIndex
CREATE INDEX "ClassGroupSlot_classGroupId_idx" ON "ClassGroupSlot"("classGroupId");

-- CreateIndex
CREATE INDEX "ClassGroupSlot_dayOfWeek_startTime_idx" ON "ClassGroupSlot"("dayOfWeek", "startTime");

-- CreateIndex
CREATE INDEX "ClassSession_classGroupId_scheduledStart_idx" ON "ClassSession"("classGroupId", "scheduledStart");

-- CreateIndex
CREATE INDEX "Enrollment_classGroupId_idx" ON "Enrollment"("classGroupId");

-- CreateIndex
CREATE INDEX "TeacherAssignment_classGroupId_startDate_idx" ON "TeacherAssignment"("classGroupId", "startDate");

-- AddForeignKey
ALTER TABLE "ClassGroup" ADD CONSTRAINT "ClassGroup_programLevelId_fkey" FOREIGN KEY ("programLevelId") REFERENCES "ProgramLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassGroupSlot" ADD CONSTRAINT "ClassGroupSlot_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
