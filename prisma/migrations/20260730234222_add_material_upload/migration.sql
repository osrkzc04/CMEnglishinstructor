-- CreateEnum
CREATE TYPE "MaterialUploadStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateTable
CREATE TABLE "MaterialUpload" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "totalSize" BIGINT NOT NULL,
    "receivedSize" BIGINT NOT NULL DEFAULT 0,
    "tempKey" TEXT NOT NULL,
    "status" "MaterialUploadStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaterialUpload_tempKey_key" ON "MaterialUpload"("tempKey");

-- CreateIndex
CREATE INDEX "MaterialUpload_folderId_idx" ON "MaterialUpload"("folderId");

-- CreateIndex
CREATE INDEX "MaterialUpload_status_updatedAt_idx" ON "MaterialUpload"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "MaterialUpload" ADD CONSTRAINT "MaterialUpload_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "MaterialFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialUpload" ADD CONSTRAINT "MaterialUpload_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
