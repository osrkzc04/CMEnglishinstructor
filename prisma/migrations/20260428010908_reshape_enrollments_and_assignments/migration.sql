/*
  Warnings:

  - You are about to drop the column `consumedHours` on the `Enrollment` table. All the data in the column will be lost.
  - You are about to drop the column `contractedHours` on the `Enrollment` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `Enrollment` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `Enrollment` table. All the data in the column will be lost.
  - You are about to drop the `ExtraHours` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ExtraHours" DROP CONSTRAINT "ExtraHours_enrollmentId_fkey";

-- AlterTable
ALTER TABLE "Enrollment" DROP COLUMN "consumedHours",
DROP COLUMN "contractedHours",
DROP COLUMN "endDate",
DROP COLUMN "startDate",
ADD COLUMN     "closedAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "ExtraHours";

-- CreateTable
CREATE TABLE "EnrollmentSlot" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,

    CONSTRAINT "EnrollmentSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAssignment" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnrollmentSlot_enrollmentId_idx" ON "EnrollmentSlot"("enrollmentId");

-- CreateIndex
CREATE INDEX "EnrollmentSlot_dayOfWeek_startTime_idx" ON "EnrollmentSlot"("dayOfWeek", "startTime");

-- CreateIndex
CREATE INDEX "TeacherAssignment_enrollmentId_startDate_idx" ON "TeacherAssignment"("enrollmentId", "startDate");

-- CreateIndex
CREATE INDEX "TeacherAssignment_teacherId_startDate_idx" ON "TeacherAssignment"("teacherId", "startDate");

-- AddForeignKey
ALTER TABLE "EnrollmentSlot" ADD CONSTRAINT "EnrollmentSlot_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
