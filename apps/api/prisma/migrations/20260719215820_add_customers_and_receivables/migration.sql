-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "customerId" UUID;

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "searchTerms" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" UUID NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPayment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "customerId" UUID,
    "amount" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "voidedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,

    CONSTRAINT "CustomerPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "customerPaymentId" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_userId_idx" ON "Customer"("userId");

-- CreateIndex
CREATE INDEX "Customer_userId_deletedAt_idx" ON "Customer"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "CustomerPayment_userId_idx" ON "CustomerPayment"("userId");

-- CreateIndex
CREATE INDEX "CustomerPayment_userId_customerId_idx" ON "CustomerPayment"("userId", "customerId");

-- CreateIndex
CREATE INDEX "CustomerPayment_userId_customerId_createdAt_idx" ON "CustomerPayment"("userId", "customerId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerPayment_userId_createdAt_idx" ON "CustomerPayment"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPayment_userId_idempotencyKey_key" ON "CustomerPayment"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentAllocation_userId_idx" ON "PaymentAllocation"("userId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_customerPaymentId_idx" ON "PaymentAllocation"("customerPaymentId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_saleId_idx" ON "PaymentAllocation"("saleId");

-- CreateIndex
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");

-- CreateIndex
CREATE INDEX "Sale_userId_customerId_status_idx" ON "Sale"("userId", "customerId", "status");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPayment" ADD CONSTRAINT "CustomerPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPayment" ADD CONSTRAINT "CustomerPayment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_customerPaymentId_fkey" FOREIGN KEY ("customerPaymentId") REFERENCES "CustomerPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-added: pg_trgm GIN indexes are not representable in schema.prisma's
-- DSL, so Prisma's diff engine doesn't know about them and will propose
-- dropping them again in a future migration — reject that diff if it
-- appears. "Product_searchTerms_trgm_idx" and "CatalogProduct_searchTerms_trgm_idx"
-- already existed (re-created here because this migration's auto-generated
-- diff tried to drop them, which was removed from this file — see
-- DATABASE.md, "Accounts receivable" and "Global product catalog"). The
-- pg_trgm extension itself was created in an earlier migration and doesn't
-- need to be recreated. "Customer_searchTerms_trgm_idx" is new, third of
-- its kind.
CREATE INDEX IF NOT EXISTS "Product_searchTerms_trgm_idx" ON "Product" USING GIN ("searchTerms" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "CatalogProduct_searchTerms_trgm_idx" ON "CatalogProduct" USING GIN ("searchTerms" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Customer_searchTerms_trgm_idx" ON "Customer" USING GIN ("searchTerms" gin_trgm_ops);

-- One-time backfill for historical sales — MUST run before the CHECK
-- constraints below: every pre-existing Sale was always created with
-- status='PAID' but paidAmount never written (stayed at its column
-- default, 0). This corrects that inconsistency honestly — these sales WERE
-- fully paid, the column just never reflected it — without fabricating any
-- CustomerPayment/PaymentAllocation history. See DATABASE.md, "Historical
-- (pre-migration) sales": paidAmount > 0 with zero PaymentAllocation rows is
-- the permanent, self-identifying signature of a sale that predates payment
-- tracking; no separate marker column needed.
UPDATE "Sale" SET "paidAmount" = "total" WHERE "status" = 'PAID';

-- Hand-added: Prisma's schema DSL has no CHECK-constraint support at all, so
-- these are always invisible to it (unlike indexes, there's no future
-- "reject the diff" step needed — but there's also no automatic
-- IF NOT EXISTS for constraints, hence the DO-block guard, which lets a
-- future migration defensively re-assert one of these without erroring if
-- it's already present). See DATABASE.md, "Accounts receivable".
DO $$ BEGIN
  ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customer_required_when_outstanding"
    CHECK ("status" IN ('CANCELLED','REFUNDED') OR "customerId" IS NOT NULL OR "paidAmount" >= "total");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Sale" ADD CONSTRAINT "Sale_paid_amount_bounds"
    CHECK ("paidAmount" >= 0 AND "paidAmount" <= "total");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerPayment" ADD CONSTRAINT "CustomerPayment_amount_positive" CHECK ("amount" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_amount_positive" CHECK ("amount" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
