-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CASHIER',
    "organizationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "costPrice" REAL NOT NULL,
    "sellingPrice" REAL NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "minStockLevel" INTEGER NOT NULL DEFAULT 10,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "categoryId" TEXT NOT NULL,
    "supplierId" TEXT,
    "warehouseId" TEXT,
    "locationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "notes" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNo" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "customerId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SaleReturn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "refundAmount" REAL NOT NULL,
    "reason" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaleReturn_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SaleReturn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poNumber" TEXT NOT NULL,
    "supplierId" TEXT,
    "contractId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" REAL NOT NULL,
    CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TraditionalItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "amharicName" TEXT,
    "region" TEXT NOT NULL,
    "material" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "culturalNote" TEXT,
    "imageUrl" TEXT,
    "costPrice" REAL NOT NULL DEFAULT 0,
    "sellingPrice" REAL NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "minStockLevel" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "manager" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OrganizationUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parentId" TEXT,
    "organizationId" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "headOfUnit" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrganizationUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrganizationUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrganizationUnit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "organizationUnitId" TEXT,
    "headOfDepartment" TEXT,
    "budgetCode" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Department_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "OrganizationUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "organizationUnitId" TEXT,
    "type" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "manager" TEXT,
    "capacity" REAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Warehouse_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "OrganizationUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WarehouseLocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "capacity" REAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WarehouseLocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,
    "expiresAt" DATETIME,
    CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserOrganization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "organizationUnitId" TEXT,
    "departmentId" TEXT,
    "warehouseId" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,
    CONSTRAINT "UserOrganization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserOrganization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserOrganization_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "OrganizationUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserOrganization_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserOrganization_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "manufacturingDate" DATETIME,
    "expiryDate" DATETIME,
    "initialQuantity" INTEGER NOT NULL,
    "currentQuantity" INTEGER NOT NULL,
    "unitCost" REAL NOT NULL,
    "supplierId" TEXT,
    "warehouseId" TEXT,
    "locationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ItemBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ItemBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ItemBatch_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ItemBatch_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SerialNumber" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "batchId" TEXT,
    "warehouseId" TEXT,
    "locationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_STOCK',
    "assignedTo" TEXT,
    "assignedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SerialNumber_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SerialNumber_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ItemBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SerialNumber_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SerialNumber_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transferNumber" TEXT NOT NULL,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockTransfer_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockTransfer_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockTransferItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockTransferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "requestedQuantity" INTEGER NOT NULL,
    "approvedQuantity" INTEGER,
    "dispatchedQuantity" INTEGER,
    "receivedQuantity" INTEGER,
    "notes" TEXT,
    CONSTRAINT "StockTransferItem_stockTransferId_fkey" FOREIGN KEY ("stockTransferId") REFERENCES "StockTransfer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockTransferItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockTransferItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ItemBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auditNumber" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "locationId" TEXT,
    "auditDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conductedBy" TEXT NOT NULL,
    "supervisedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryAudit_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryAudit_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryAuditItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inventoryAuditId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expectedQuantity" INTEGER NOT NULL,
    "actualQuantity" INTEGER NOT NULL,
    "variance" INTEGER NOT NULL,
    "varianceReason" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" DATETIME,
    CONSTRAINT "InventoryAuditItem_inventoryAuditId_fkey" FOREIGN KEY ("inventoryAuditId") REFERENCES "InventoryAudit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryAuditItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcurementRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestNumber" TEXT NOT NULL,
    "organizationId" TEXT,
    "departmentId" TEXT,
    "requesterId" TEXT NOT NULL,
    "requestDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requiredDate" DATETIME NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "justification" TEXT,
    "estimatedTotal" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProcurementRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProcurementRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProcurementRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcurementRequestItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "procurementRequestId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitOfMeasure" TEXT NOT NULL,
    "estimatedUnitCost" REAL NOT NULL,
    "estimatedTotal" REAL NOT NULL,
    "technicalSpecs" TEXT,
    "category" TEXT,
    "notes" TEXT,
    CONSTRAINT "ProcurementRequestItem_procurementRequestId_fkey" FOREIGN KEY ("procurementRequestId") REFERENCES "ProcurementRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tender" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenderNumber" TEXT NOT NULL,
    "procurementRefId" TEXT,
    "projectName" TEXT NOT NULL,
    "procurementCategory" TEXT NOT NULL,
    "procurementMethod" TEXT NOT NULL,
    "marketType" TEXT NOT NULL,
    "issueDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submissionDeadline" DATETIME NOT NULL,
    "bidValidityPeriod" INTEGER NOT NULL,
    "bidSecurity" REAL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "contractType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tender_procurementRefId_fkey" FOREIGN KEY ("procurementRefId") REFERENCES "ProcurementRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TenderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenderId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "specifications" TEXT,
    CONSTRAINT "TenderItem_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bidNumber" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bidSecurity" REAL,
    "totalPrice" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "deliveryPeriod" INTEGER NOT NULL,
    "validityPeriod" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Bid_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bid_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BidItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bidId" TEXT NOT NULL,
    "tenderItemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL,
    "totalPrice" REAL NOT NULL,
    "specifications" TEXT,
    CONSTRAINT "BidItem_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BidItem_tenderItemId_fkey" FOREIGN KEY ("tenderItemId") REFERENCES "TenderItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TechnicalRequirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenderId" TEXT NOT NULL,
    "tenderItemId" TEXT,
    "attribute" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TechnicalRequirement_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TechnicalRequirement_tenderItemId_fkey" FOREIGN KEY ("tenderItemId") REFERENCES "TenderItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TechnicalEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bidId" TEXT NOT NULL,
    "technicalRequirementId" TEXT NOT NULL,
    "supplierResponse" TEXT,
    "compliance" BOOLEAN NOT NULL,
    "score" REAL,
    "evaluatorId" TEXT NOT NULL,
    "comments" TEXT,
    "evaluatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TechnicalEvaluation_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TechnicalEvaluation_technicalRequirementId_fkey" FOREIGN KEY ("technicalRequirementId") REFERENCES "TechnicalRequirement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TechnicalEvaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinancialEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bidId" TEXT NOT NULL,
    "bidPrice" REAL NOT NULL,
    "deliveryCost" REAL,
    "taxes" REAL,
    "totalEvaluatedPrice" REAL NOT NULL,
    "priceScore" REAL,
    "evaluatorId" TEXT NOT NULL,
    "comments" TEXT,
    "evaluatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialEvaluation_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinancialEvaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractNumber" TEXT NOT NULL,
    "tenderId" TEXT,
    "bidId" TEXT,
    "supplierId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "contractValue" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "paymentTerms" TEXT,
    "deliveryTerms" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contract_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" REAL NOT NULL,
    "totalPrice" REAL NOT NULL,
    CONSTRAINT "ContractItem_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptNumber" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "contractId" TEXT,
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "deliveryNote" TEXT,
    "receivedDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedBy" TEXT NOT NULL,
    "inspectedBy" TEXT,
    "inspectionDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GoodsReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GoodsReceipt_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GoodsReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GoodsReceipt_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GoodsReceiptItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goodsReceiptId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderedQuantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL,
    "acceptedQuantity" INTEGER NOT NULL,
    "rejectedQuantity" INTEGER NOT NULL,
    "damagedQuantity" INTEGER NOT NULL,
    "batchNumber" TEXT,
    "serialNumbers" TEXT,
    "unitCost" REAL NOT NULL,
    "inspectionResult" TEXT,
    "notes" TEXT,
    CONSTRAINT "GoodsReceiptItem_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GoodsReceiptItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetNumber" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "model" TEXT,
    "manufacturer" TEXT,
    "purchaseDate" DATETIME,
    "purchaseCost" REAL NOT NULL,
    "currentValue" REAL NOT NULL,
    "location" TEXT,
    "departmentId" TEXT,
    "warehouseId" TEXT,
    "assignedTo" TEXT,
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "warrantyExpiry" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'IN_STOCK',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asset_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Asset_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "assignedTo" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "assignedDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT,
    "departmentId" TEXT,
    "returnDate" DATETIME,
    "conditionBefore" TEXT,
    "conditionAfter" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetAssignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AssetAssignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetMaintenance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "maintenanceType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "scheduledDate" DATETIME,
    "completedDate" DATETIME,
    "technician" TEXT,
    "serviceProvider" TEXT,
    "cost" REAL,
    "partsUsed" TEXT,
    "downtime" REAL,
    "nextMaintenanceDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetMaintenance_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetDisposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "disposalType" TEXT NOT NULL,
    "disposalDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disposedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "reason" TEXT,
    "disposalValue" REAL,
    "recipient" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetDisposal_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "entityType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "role" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "workflowStepId" TEXT,
    "approverId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decisionDate" DATETIME,
    "comments" TEXT,
    "previousState" TEXT,
    "newState" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Approval_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "WorkflowStep" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "category" TEXT,
    "expiryDate" DATETIME,
    "isConfidential" BOOLEAN NOT NULL DEFAULT false,
    "accessLevel" TEXT NOT NULL DEFAULT 'INTERNAL',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isLatest" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "actionUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ApprovalToStockTransfer" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ApprovalToStockTransfer_A_fkey" FOREIGN KEY ("A") REFERENCES "Approval" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ApprovalToStockTransfer_B_fkey" FOREIGN KEY ("B") REFERENCES "StockTransfer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_ApprovalToProcurementRequest" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ApprovalToProcurementRequest_A_fkey" FOREIGN KEY ("A") REFERENCES "Approval" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ApprovalToProcurementRequest_B_fkey" FOREIGN KEY ("B") REFERENCES "ProcurementRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_invoiceNo_key" ON "Sale"("invoiceNo");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_name_key" ON "Branch"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_key" ON "Organization"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_code_key" ON "Organization"("code");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationUnit_code_key" ON "OrganizationUnit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseLocation_code_key" ON "WarehouseLocation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_key" ON "Permission"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserOrganization_userId_organizationId_organizationUnitId_departmentId_warehouseId_key" ON "UserOrganization"("userId", "organizationId", "organizationUnitId", "departmentId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemBatch_batchNumber_key" ON "ItemBatch"("batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SerialNumber_serialNumber_key" ON "SerialNumber"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_transferNumber_key" ON "StockTransfer"("transferNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAudit_auditNumber_key" ON "InventoryAudit"("auditNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementRequest_requestNumber_key" ON "ProcurementRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Tender_tenderNumber_key" ON "Tender"("tenderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Bid_bidNumber_key" ON "Bid"("bidNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TechnicalEvaluation_bidId_technicalRequirementId_evaluatorId_key" ON "TechnicalEvaluation"("bidId", "technicalRequirementId", "evaluatorId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialEvaluation_bidId_key" ON "FinancialEvaluation"("bidId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_receiptNumber_key" ON "GoodsReceipt"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_assetNumber_key" ON "Asset"("assetNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_serialNumber_key" ON "Asset"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_name_key" ON "Workflow"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStep_workflowId_stepNumber_key" ON "WorkflowStep"("workflowId", "stepNumber");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "_ApprovalToStockTransfer_AB_unique" ON "_ApprovalToStockTransfer"("A", "B");

-- CreateIndex
CREATE INDEX "_ApprovalToStockTransfer_B_index" ON "_ApprovalToStockTransfer"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ApprovalToProcurementRequest_AB_unique" ON "_ApprovalToProcurementRequest"("A", "B");

-- CreateIndex
CREATE INDEX "_ApprovalToProcurementRequest_B_index" ON "_ApprovalToProcurementRequest"("B");
