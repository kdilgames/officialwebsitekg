-- KDILGAMES Marketplace — freebies, media previews, Q&A, coupons, and product bundles

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'QUESTION';

-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENT', 'FIXED');

-- AlterTable
ALTER TABLE "Product"
    ADD COLUMN "demoUrl" TEXT,
    ADD COLUMN "videoUrl" TEXT;

-- AlterTable
ALTER TABLE "Cart"
    ADD COLUMN "couponCode" TEXT;

-- AlterTable
ALTER TABLE "Order"
    ADD COLUMN "couponId" UUID,
    ADD COLUMN "couponCodeSnapshot" TEXT;

-- CreateTable
CREATE TABLE "ProductQuestion" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "sellerId" UUID,
    "discountType" "CouponDiscountType" NOT NULL DEFAULT 'PERCENT',
    "percentOff" INTEGER,
    "amountOffMinor" INTEGER,
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "minSubtotalMinor" INTEGER,
    "maxRedemptions" INTEGER,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBundle" (
    "id" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "bundlePriceMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBundleItem" (
    "id" UUID NOT NULL,
    "bundleId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductBundleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartBundle" (
    "id" UUID NOT NULL,
    "cartId" UUID NOT NULL,
    "bundleId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartBundle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductQuestion_productId_isHidden_createdAt_idx" ON "ProductQuestion"("productId", "isHidden", "createdAt");

-- CreateIndex
CREATE INDEX "ProductQuestion_userId_idx" ON "ProductQuestion"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_code_isActive_idx" ON "Coupon"("code", "isActive");

-- CreateIndex
CREATE INDEX "Coupon_sellerId_isActive_idx" ON "Coupon"("sellerId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBundle_slug_key" ON "ProductBundle"("slug");

-- CreateIndex
CREATE INDEX "ProductBundle_sellerId_isActive_idx" ON "ProductBundle"("sellerId", "isActive");

-- CreateIndex
CREATE INDEX "ProductBundle_isActive_createdAt_idx" ON "ProductBundle"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX "ProductBundleItem_productId_idx" ON "ProductBundleItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBundleItem_bundleId_productId_key" ON "ProductBundleItem"("bundleId", "productId");

-- CreateIndex
CREATE INDEX "CartBundle_bundleId_idx" ON "CartBundle"("bundleId");

-- CreateIndex
CREATE UNIQUE INDEX "CartBundle_cartId_bundleId_key" ON "CartBundle"("cartId", "bundleId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBundle" ADD CONSTRAINT "ProductBundle_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBundleItem" ADD CONSTRAINT "ProductBundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "ProductBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBundleItem" ADD CONSTRAINT "ProductBundleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartBundle" ADD CONSTRAINT "CartBundle_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartBundle" ADD CONSTRAINT "CartBundle_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "ProductBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
