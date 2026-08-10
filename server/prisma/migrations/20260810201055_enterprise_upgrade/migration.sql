/*
  Warnings:

  - Added the required column `updatedAt` to the `Branch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotal` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalAmount` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unitPrice` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vatAmount` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN "metadata" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "requestId" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "userAgent" TEXT;

-- CreateTable
CREATE TABLE "BranchStock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 10,
    "lastReorder" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BranchStock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BranchStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockTransferOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "shippedAt" DATETIME,
    "receivedAt" DATETIME,
    "estimatedArrival" DATETIME NOT NULL,
    "notes" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockTransferOrder_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockTransferOrder_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockTransferOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transferOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "requestedQuantity" INTEGER NOT NULL,
    "approvedQuantity" INTEGER,
    "shippedQuantity" INTEGER,
    "receivedQuantity" INTEGER,
    "unitCost" REAL,
    "totalCost" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockTransferOrderItem_transferOrderId_fkey" FOREIGN KEY ("transferOrderId") REFERENCES "StockTransferOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockTransferOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" DATETIME NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "landedCost" REAL NOT NULL,
    "supplierId" TEXT,
    "branchId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProductBatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProductBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportShipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "arrivalDate" DATETIME NOT NULL,
    "totalFreightCost" REAL NOT NULL DEFAULT 0,
    "totalCustomsCost" REAL NOT NULL DEFAULT 0,
    "totalTariffCost" REAL NOT NULL DEFAULT 0,
    "totalInsuranceCost" REAL NOT NULL DEFAULT 0,
    "totalHandlingCost" REAL NOT NULL DEFAULT 0,
    "totalLogisticsCost" REAL NOT NULL DEFAULT 0,
    "allocationMethod" TEXT NOT NULL DEFAULT 'WEIGHT',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportShipment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportShipmentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" REAL NOT NULL,
    "totalCost" REAL NOT NULL,
    "weight" REAL NOT NULL,
    "volume" REAL NOT NULL,
    "allocatedFreightCost" REAL NOT NULL DEFAULT 0,
    "allocatedCustomsCost" REAL NOT NULL DEFAULT 0,
    "allocatedTariffCost" REAL NOT NULL DEFAULT 0,
    "allocatedInsuranceCost" REAL NOT NULL DEFAULT 0,
    "allocatedHandlingCost" REAL NOT NULL DEFAULT 0,
    "totalAllocatedCost" REAL NOT NULL DEFAULT 0,
    "trueLandedUnitCost" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImportShipmentItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "ImportShipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ImportShipmentItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "phoneNumber" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "callbackUrl" TEXT,
    "providerTransactionId" TEXT,
    "completedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Branch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "manager" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Branch" ("address", "createdAt", "id", "isActive", "manager", "name", "phone") SELECT "address", "createdAt", "id", "isActive", "manager", "name", "phone" FROM "Branch";
DROP TABLE "Branch";
ALTER TABLE "new_Branch" RENAME TO "Branch";
CREATE UNIQUE INDEX "Branch_name_key" ON "Branch"("name");
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "notes" TEXT,
    "userId" TEXT,
    "unitPrice" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    "vatAmount" REAL NOT NULL,
    "totalAmount" REAL NOT NULL,
    "clearanceStatus" TEXT NOT NULL DEFAULT 'PENDING_CLEARANCE',
    "irn" TEXT,
    "rrn" TEXT,
    "clearedAt" DATETIME,
    "failureReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "productBatchId" TEXT,
    CONSTRAINT "Transaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_productBatchId_fkey" FOREIGN KEY ("productBatchId") REFERENCES "ProductBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("createdAt", "id", "notes", "productId", "quantity", "type", "userId") SELECT "createdAt", "id", "notes", "productId", "quantity", "type", "userId" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_productId_idx" ON "Transaction"("productId");
CREATE INDEX "Transaction_clearanceStatus_idx" ON "Transaction"("clearanceStatus");
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "BranchStock_branchId_idx" ON "BranchStock"("branchId");

-- CreateIndex
CREATE INDEX "BranchStock_productId_idx" ON "BranchStock"("productId");

-- CreateIndex
CREATE INDEX "BranchStock_quantity_idx" ON "BranchStock"("quantity");

-- CreateIndex
CREATE UNIQUE INDEX "BranchStock_branchId_productId_key" ON "BranchStock"("branchId", "productId");

-- CreateIndex
CREATE INDEX "StockTransferOrder_fromBranchId_idx" ON "StockTransferOrder"("fromBranchId");

-- CreateIndex
CREATE INDEX "StockTransferOrder_toBranchId_idx" ON "StockTransferOrder"("toBranchId");

-- CreateIndex
CREATE INDEX "StockTransferOrder_status_idx" ON "StockTransferOrder"("status");

-- CreateIndex
CREATE INDEX "StockTransferOrder_createdAt_idx" ON "StockTransferOrder"("createdAt");

-- CreateIndex
CREATE INDEX "StockTransferOrderItem_transferOrderId_idx" ON "StockTransferOrderItem"("transferOrderId");

-- CreateIndex
CREATE INDEX "StockTransferOrderItem_productId_idx" ON "StockTransferOrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBatch_batchNumber_key" ON "ProductBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "ProductBatch_productId_idx" ON "ProductBatch"("productId");

-- CreateIndex
CREATE INDEX "ProductBatch_batchNumber_idx" ON "ProductBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "ProductBatch_expiryDate_idx" ON "ProductBatch"("expiryDate");

-- CreateIndex
CREATE INDEX "ProductBatch_status_idx" ON "ProductBatch"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ImportShipment_shipmentNumber_key" ON "ImportShipment"("shipmentNumber");

-- CreateIndex
CREATE INDEX "ImportShipment_supplierId_idx" ON "ImportShipment"("supplierId");

-- CreateIndex
CREATE INDEX "ImportShipment_arrivalDate_idx" ON "ImportShipment"("arrivalDate");

-- CreateIndex
CREATE INDEX "ImportShipment_status_idx" ON "ImportShipment"("status");

-- CreateIndex
CREATE INDEX "ImportShipmentItem_shipmentId_idx" ON "ImportShipmentItem"("shipmentId");

-- CreateIndex
CREATE INDEX "ImportShipmentItem_productId_idx" ON "ImportShipmentItem"("productId");

-- CreateIndex
CREATE INDEX "Payment_transactionId_idx" ON "Payment"("transactionId");

-- CreateIndex
CREATE INDEX "Payment_provider_idx" ON "Payment"("provider");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_phoneNumber_idx" ON "Payment"("phoneNumber");

-- CreateIndex
CREATE INDEX "ActivityLog_ipAddress_idx" ON "ActivityLog"("ipAddress");

-- CreateIndex
CREATE INDEX "ActivityLog_sessionId_idx" ON "ActivityLog"("sessionId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_supplierId_idx" ON "Product"("supplierId");

-- CreateIndex
CREATE INDEX "Product_warehouseId_idx" ON "Product"("warehouseId");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "Product_stock_idx" ON "Product"("stock");
