/*
  Warnings:

  - You are about to drop the `Material` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Material" DROP CONSTRAINT "Material_courseId_fkey";

-- DropForeignKey
ALTER TABLE "Material" DROP CONSTRAINT "Material_programLevelId_fkey";

-- DropTable
DROP TABLE "Material";

-- CreateTable
CREATE TABLE "MaterialFolder" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "programLevelId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MaterialFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialFile" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MaterialFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaterialFolder_parentId_idx" ON "MaterialFolder"("parentId");

-- CreateIndex
CREATE INDEX "MaterialFolder_programLevelId_parentId_idx" ON "MaterialFolder"("programLevelId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialFile_storageKey_key" ON "MaterialFile"("storageKey");

-- CreateIndex
CREATE INDEX "MaterialFile_folderId_idx" ON "MaterialFile"("folderId");

-- AddForeignKey
ALTER TABLE "MaterialFolder" ADD CONSTRAINT "MaterialFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MaterialFolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialFolder" ADD CONSTRAINT "MaterialFolder_programLevelId_fkey" FOREIGN KEY ("programLevelId") REFERENCES "ProgramLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialFolder" ADD CONSTRAINT "MaterialFolder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialFile" ADD CONSTRAINT "MaterialFile_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "MaterialFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialFile" ADD CONSTRAINT "MaterialFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
