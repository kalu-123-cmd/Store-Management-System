/*
  Warnings:

  - Added the required column `updatedAt` to the `Customer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotal` to the `Sale` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Sale` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vatAmount` to the `Sale` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "CreditAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "managerId" TEXT,
    "creditLimit" REAL NOT NULL DEFAULT 0,
    "currentBalance" REAL NOT NULL DEFAULT 0,
    "availableCredit" REAL NOT NULL,
    "overdueBalance" REAL NOT NULL DEFAULT 0,
    "riskScore" INTEGER NOT NULL DEFAULT 50,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastPaymentDate" DATETIME,
    "nextPaymentDue" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CreditAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CreditAccount_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreditPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creditAccountId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paymentDate" DATETIME NOT NULL,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CreditPayment_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "CreditAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplierPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitPrice" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "minOrderQuantity" INTEGER NOT NULL DEFAULT 1,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 7,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "qualityScore" REAL NOT NULL DEFAULT 1.0,
    "reliabilityScore" REAL NOT NULL DEFAULT 1.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupplierPrice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupplierPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,
    "requestId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "taxId" TEXT,
    "creditLimit" REAL NOT NULL DEFAULT 0,
    "currentDebt" REAL NOT NULL DEFAULT 0,
    "riskScore" INTEGER NOT NULL DEFAULT 50,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Customer" ("createdAt", "email", "id", "name", "phone") SELECT "createdAt", "email", "id", "name", "phone" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
CREATE INDEX "Customer_status_idx" ON "Customer"("status");
CREATE INDEX "Customer_riskScore_idx" ON "Customer"("riskScore");
CREATE TABLE "new_Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNo" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    "vatAmount" REAL NOT NULL,
    "customerId" TEXT,
    "userId" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "paymentStatus" TEXT NOT NULL DEFAULT 'PAID',
    "creditAccountId" TEXT,
    "branchId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Sale" ("createdAt", "customerId", "id", "invoiceNo", "totalAmount", "userId") SELECT "createdAt", "customerId", "id", "invoiceNo", "totalAmount", "userId" FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
CREATE UNIQUE INDEX "Sale_invoiceNo_key" ON "Sale"("invoiceNo");
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");
CREATE INDEX "Sale_paymentMethod_idx" ON "Sale"("paymentMethod");
CREATE INDEX "Sale_paymentStatus_idx" ON "Sale"("paymentStatus");
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CreditAccount_customerId_key" ON "CreditAccount"("customerId");

-- CreateIndex
CREATE INDEX "CreditAccount_customerId_idx" ON "CreditAccount"("customerId");

-- CreateIndex
CREATE INDEX "CreditAccount_managerId_idx" ON "CreditAccount"("managerId");

-- CreateIndex
CREATE INDEX "CreditAccount_status_idx" ON "CreditAccount"("status");

-- CreateIndex
CREATE INDEX "CreditAccount_riskScore_idx" ON "CreditAccount"("riskScore");

-- CreateIndex
CREATE INDEX "CreditPayment_creditAccountId_idx" ON "CreditPayment"("creditAccountId");

-- CreateIndex
CREATE INDEX "CreditPayment_paymentDate_idx" ON "CreditPayment"("paymentDate");

-- CreateIndex
CREATE INDEX "SupplierPrice_supplierId_idx" ON "SupplierPrice"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierPrice_productId_idx" ON "SupplierPrice"("productId");

-- CreateIndex
CREATE INDEX "SupplierPrice_effectiveFrom_idx" ON "SupplierPrice"("effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPrice_supplierId_productId_effectiveFrom_key" ON "SupplierPrice"("supplierId", "productId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_ipAddress_idx" ON "AuditLog"("ipAddress");

-- CreateIndex
CREATE INDEX "AuditLog_sessionId_idx" ON "AuditLog"("sessionId");
