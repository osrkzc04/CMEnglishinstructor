-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TestEventType" ADD VALUE 'SECTION_ADVANCED';
ALTER TYPE "TestEventType" ADD VALUE 'SECTION_LOCKED';
ALTER TYPE "TestEventType" ADD VALUE 'DEVICE_MISMATCH';

-- AlterTable
ALTER TABLE "TestSession" ADD COLUMN     "currentSectionOrder" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "deviceCookieHash" TEXT,
ADD COLUMN     "deviceFingerprint" TEXT,
ADD COLUMN     "resultsToken" TEXT,
ADD COLUMN     "resultsTokenExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TestSessionQuestion" ADD COLUMN     "cefrLevelCode" TEXT,
ADD COLUMN     "markedForReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sectionOrder" INTEGER;

-- CreateTable
CREATE TABLE "TestTemplateSection" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "samplePoolSize" INTEGER NOT NULL DEFAULT 50,
    "questionCount" INTEGER NOT NULL DEFAULT 20,
    "passingPercent" INTEGER NOT NULL DEFAULT 90,

    CONSTRAINT "TestTemplateSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacementSkillEvaluation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "reading" DECIMAL(5,2),
    "writing" DECIMAL(5,2),
    "listening" DECIMAL(5,2),
    "speaking" DECIMAL(5,2),
    "assignedLevelId" TEXT,
    "reviewerNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlacementSkillEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestTemplateSection_templateId_idx" ON "TestTemplateSection"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "TestTemplateSection_templateId_order_key" ON "TestTemplateSection"("templateId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "TestTemplateSection_templateId_levelId_key" ON "TestTemplateSection"("templateId", "levelId");

-- CreateIndex
CREATE UNIQUE INDEX "PlacementSkillEvaluation_sessionId_key" ON "PlacementSkillEvaluation"("sessionId");

-- CreateIndex
CREATE INDEX "PlacementSkillEvaluation_assignedLevelId_idx" ON "PlacementSkillEvaluation"("assignedLevelId");

-- CreateIndex
CREATE INDEX "Question_levelId_isActive_topic_idx" ON "Question"("levelId", "isActive", "topic");

-- CreateIndex
CREATE UNIQUE INDEX "TestSession_resultsToken_key" ON "TestSession"("resultsToken");

-- CreateIndex
CREATE INDEX "TestSession_resultsTokenExpiresAt_idx" ON "TestSession"("resultsTokenExpiresAt");

-- CreateIndex
CREATE INDEX "TestSessionQuestion_sessionId_sectionOrder_idx" ON "TestSessionQuestion"("sessionId", "sectionOrder");

-- AddForeignKey
ALTER TABLE "TestTemplateSection" ADD CONSTRAINT "TestTemplateSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TestTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestTemplateSection" ADD CONSTRAINT "TestTemplateSection_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "CefrLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementSkillEvaluation" ADD CONSTRAINT "PlacementSkillEvaluation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementSkillEvaluation" ADD CONSTRAINT "PlacementSkillEvaluation_assignedLevelId_fkey" FOREIGN KEY ("assignedLevelId") REFERENCES "CefrLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

