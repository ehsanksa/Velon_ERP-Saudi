-- Distinguish physical products from non-stocked services on the catalog.

CREATE TYPE "InventoryItemType" AS ENUM ('PRODUCT', 'SERVICE');

ALTER TABLE "InventoryProduct"
ADD COLUMN "itemType" "InventoryItemType" NOT NULL DEFAULT 'PRODUCT';

CREATE INDEX "InventoryProduct_tenantId_itemType_idx" ON "InventoryProduct"("tenantId", "itemType");
