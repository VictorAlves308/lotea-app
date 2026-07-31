-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "catalogProductId" UUID;

-- CreateTable
CREATE TABLE "CatalogProduct" (
    "id" UUID NOT NULL,
    "brand" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "volume" TEXT NOT NULL DEFAULT '',
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "searchTerms" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" UUID,
    "updatedBy" UUID,

    CONSTRAINT "CatalogProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogProduct_active_idx" ON "CatalogProduct"("active");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogProduct_brand_name_volume_key" ON "CatalogProduct"("brand", "name", "volume");

-- CreateIndex
CREATE INDEX "Product_catalogProductId_idx" ON "Product"("catalogProductId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_catalogProductId_fkey" FOREIGN KEY ("catalogProductId") REFERENCES "CatalogProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hand-added: pg_trgm GIN indexes are not representable in schema.prisma's
-- DSL, so Prisma's diff engine doesn't know about them and will propose
-- dropping them again in a future migration — reject that diff if it
-- appears. "Product_searchTerms_trgm_idx" already existed (re-created here
-- because this migration's auto-generated diff tried to drop it, which was
-- removed from this file — see DATABASE.md, "Global product catalog" and
-- "Product catalog search"). The pg_trgm extension itself was created in an
-- earlier migration and doesn't need to be recreated.
CREATE INDEX IF NOT EXISTS "Product_searchTerms_trgm_idx" ON "Product" USING GIN ("searchTerms" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "CatalogProduct_searchTerms_trgm_idx" ON "CatalogProduct" USING GIN ("searchTerms" gin_trgm_ops);
