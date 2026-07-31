-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CARD', 'CASH');

-- DropIndex
DROP INDEX "CatalogProduct_searchTerms_trgm_idx";

-- DropIndex
DROP INDEX "Customer_searchTerms_trgm_idx";

-- DropIndex
DROP INDEX "Product_searchTerms_trgm_idx";

-- AlterTable
ALTER TABLE "CustomerPayment" ADD COLUMN     "paymentMethod" "PaymentMethod";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "defaultSalePrice" DECIMAL(10,2),
ADD COLUMN     "minStockAlert" INTEGER;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "paymentMethod" "PaymentMethod";
