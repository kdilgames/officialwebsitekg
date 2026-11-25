-- EU VAT (Stripe Tax) order fields + DMCA takedown notices

-- CreateEnum
CREATE TYPE "DmcaStatus" AS ENUM ('RECEIVED', 'UNDER_REVIEW', 'REMOVED', 'DISMISSED', 'COUNTER_NOTICED');

-- AlterTable
ALTER TABLE "Order"
  ADD COLUMN "billingCountry" CHAR(2),
  ADD COLUMN "customerTaxId" TEXT,
  ADD COLUMN "taxMinor" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DmcaNotice" (
    "id" UUID NOT NULL,
    "noticeNumber" TEXT NOT NULL,
    "claimantName" TEXT NOT NULL,
    "claimantEmail" TEXT NOT NULL,
    "claimantCompany" TEXT,
    "productId" UUID,
    "productUrl" TEXT NOT NULL,
    "originalWorkUrl" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "goodFaithStatement" BOOLEAN NOT NULL DEFAULT true,
    "accuracyStatement" BOOLEAN NOT NULL DEFAULT true,
    "signature" TEXT NOT NULL,
    "status" "DmcaStatus" NOT NULL DEFAULT 'RECEIVED',
    "adminNotes" TEXT,
    "reviewedById" UUID,
    "resolvedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DmcaNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DmcaNotice_noticeNumber_key" ON "DmcaNotice"("noticeNumber");

-- CreateIndex
CREATE INDEX "DmcaNotice_status_createdAt_idx" ON "DmcaNotice"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DmcaNotice_productId_idx" ON "DmcaNotice"("productId");

-- AddForeignKey
ALTER TABLE "DmcaNotice" ADD CONSTRAINT "DmcaNotice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
