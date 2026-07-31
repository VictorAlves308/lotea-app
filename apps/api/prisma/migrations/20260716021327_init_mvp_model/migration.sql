-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('ACTIVE', 'FINISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InventoryItemStatus" AS ENUM ('IN_STOCK', 'RESERVED', 'SOLD', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('PURCHASE_ENTRY', 'SALE', 'RESERVATION', 'RESERVATION_RELEASE', 'RETURN', 'MANUAL_ADJUSTMENT', 'SALE_CANCELLATION', 'WRITE_OFF');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" UUID NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "supplier" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "status" "LotStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" UUID NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT,
    "sku" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" UUID NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "lotId" UUID NOT NULL,
    "status" "InventoryItemStatus" NOT NULL DEFAULT 'IN_STOCK',
    "acquisitionCost" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" UUID NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "saleId" UUID,
    "type" "InventoryMovementType" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'PENDING',
    "total" DECIMAL(10,2) NOT NULL,
    "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" UUID NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "salePrice" DECIMAL(10,2) NOT NULL,
    "acquisitionCostSnapshot" DECIMAL(10,2) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE INDEX "Lot_userId_idx" ON "Lot"("userId");

-- CreateIndex
CREATE INDEX "Lot_userId_status_idx" ON "Lot"("userId", "status");

-- CreateIndex
CREATE INDEX "Product_userId_idx" ON "Product"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_userId_sku_key" ON "Product"("userId", "sku");

-- CreateIndex
CREATE INDEX "InventoryItem_userId_idx" ON "InventoryItem"("userId");

-- CreateIndex
CREATE INDEX "InventoryItem_userId_status_idx" ON "InventoryItem"("userId", "status");

-- CreateIndex
CREATE INDEX "InventoryItem_userId_productId_idx" ON "InventoryItem"("userId", "productId");

-- CreateIndex
CREATE INDEX "InventoryItem_userId_lotId_idx" ON "InventoryItem"("userId", "lotId");

-- CreateIndex
CREATE INDEX "InventoryMovement_userId_idx" ON "InventoryMovement"("userId");

-- CreateIndex
CREATE INDEX "InventoryMovement_userId_createdAt_idx" ON "InventoryMovement"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_inventoryItemId_createdAt_idx" ON "InventoryMovement"("inventoryItemId", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_userId_idx" ON "Sale"("userId");

-- CreateIndex
CREATE INDEX "Sale_userId_status_idx" ON "Sale"("userId", "status");

-- CreateIndex
CREATE INDEX "Sale_userId_createdAt_idx" ON "Sale"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_userId_idempotencyKey_key" ON "Sale"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "SaleItem_userId_idx" ON "SaleItem"("userId");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_inventoryItemId_idx" ON "SaleItem"("inventoryItemId");

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-added: Prisma's schema DSL cannot express a partial (filtered) unique
-- index, so this is maintained by hand rather than generated from
-- schema.prisma. It enforces "the same InventoryItem can never appear in
-- more than one *active* SaleItem" — voidedAt IS NULL means the sale item
-- hasn't been reversed by a sale cancellation. A future `prisma migrate dev`
-- run will not see this index in schema.prisma and may propose dropping it;
-- do NOT accept that diff. See DATABASE.md, "Preventing double-selling a unit".
CREATE UNIQUE INDEX "SaleItem_active_inventoryItemId_key" ON "SaleItem"("inventoryItemId") WHERE "voidedAt" IS NULL;
