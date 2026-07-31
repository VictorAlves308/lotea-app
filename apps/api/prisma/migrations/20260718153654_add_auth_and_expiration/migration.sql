-- NOTE: Prisma's auto-generated diff proposed `DROP INDEX
-- "Product_searchTerms_trgm_idx"` here — that index is hand-maintained raw
-- SQL not represented in schema.prisma (see DATABASE.md, "Preventing
-- double-selling a unit" / the pg_trgm caveat), so the drop was removed by
-- hand. Do NOT let a future migration drop it either.

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- AlterTable
-- The DEFAULT '' below only exists to satisfy existing rows at migration
-- time (this is dev/seed data, always recreated by prisma/seed.ts); it is
-- dropped immediately after so the column has no default going forward.
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT NOT NULL DEFAULT '';

ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP DEFAULT;

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
