/*
  Warnings:

  - Added the required column `searchTerms` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- The DEFAULT '' below only exists to satisfy existing rows at migration
-- time (this is dev/seed data, always recreated by prisma/seed.ts, which
-- computes the real value via buildProductSearchTerms()); it is dropped
-- immediately after so the column has no default going forward — every
-- future write must set searchTerms explicitly.
ALTER TABLE "Product" ADD COLUMN     "searchTerms" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "variant" TEXT,
ADD COLUMN     "volume" TEXT;

ALTER TABLE "Product" ALTER COLUMN "searchTerms" DROP DEFAULT;

-- Enables typo-tolerant, partial-term catalog search (similarity() and
-- accelerated ILIKE) with no paid dependency — pg_trgm is a standard,
-- free Postgres contrib extension available on virtually every managed
-- Postgres provider (Neon, Railway, Supabase, RDS, etc.). See DATABASE.md,
-- "Product catalog search".
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Product_searchTerms_trgm_idx" ON "Product" USING GIN ("searchTerms" gin_trgm_ops);
