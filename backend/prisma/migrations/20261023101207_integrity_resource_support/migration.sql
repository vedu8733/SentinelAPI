/*
  Warnings:

  - Added the required column `updatedAt` to the `IntegrityRecord` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "IntegrityRecord" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "resourceId" TEXT,
ADD COLUMN     "resourceType" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "requestLogId" DROP NOT NULL,
ALTER COLUMN "signatureProvided" DROP NOT NULL,
ALTER COLUMN "isValid" SET DEFAULT true,
ALTER COLUMN "requestTimestamp" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "timeDriftMs" SET DEFAULT 0;

-- CreateIndex
CREATE INDEX "IntegrityRecord_resourceType_resourceId_idx" ON "IntegrityRecord"("resourceType", "resourceId");
