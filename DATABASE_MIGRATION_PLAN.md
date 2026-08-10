# Database Migration Plan - Store to Public Resource Platform

## 1. Migration Overview

This document outlines the step-by-step database migration plan to transform the existing Store Management System into a comprehensive Public Resource & Procurement Management Platform.

### 1.1 Migration Principles
- **Non-breaking changes**: Maintain backward compatibility where possible
- **Incremental migration**: Add new tables/columns without removing existing ones
- **Data preservation**: Ensure existing data is not lost
- **Rollback capability**: Each migration should be reversible
- **Testing first**: Test migrations on staging before production

### 1.2 Migration Order
1. Foundation models (Organization, RBAC)
2. Enhanced inventory models
3. Procurement models
4. Asset management models
5. Workflow and approval models
6. Document management models
7. Notification models
8. Enhanced audit models

## 2. Phase 2: Organization & RBAC Foundation

### 2.1 Organization Hierarchy Models

#### Migration 2.1: Add Organization Model
```prisma
model Organization {
  id          String   @id @default(uuid())
  name        String   @unique
  code        String   @unique
  type        String   // MINISTRY, AGENCY, NGO, UNIVERSITY, HOSPITAL, etc.
  description String?
  address     String?
  phone       String?
  email       String?
  website     String?
  logoUrl     String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  units       OrganizationUnit[]
  users       UserOrganization[]
}
```

#### Migration 2.2: Add OrganizationUnit Model
```prisma
model OrganizationUnit {
  id             String            @id @default(uuid())
  name           String
  code           String            @unique
  type           String            // REGION, ZONE, DISTRICT, DEPARTMENT, WAREHOUSE
  parentId       String?
  parent         OrganizationUnit? @relation("UnitHierarchy", fields: [parentId], references: [id])
  children       OrganizationUnit[] @relation("UnitHierarchy")
  organizationId String
  organization   Organization      @relation(fields: [organizationId], references: [id])
  address        String?
  phone          String?
  email          String?
  headOfUnit     String?
  isActive       Boolean           @default(true)
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
  
  departments    Department[]
  warehouses     Warehouse[]
  users          UserOrganization[]
}
```

#### Migration 2.3: Add Department Model
```prisma
model Department {
  id                String            @id @default(uuid())
  name              String
  code              String            @unique
  organizationUnitId String?
  organizationUnit  OrganizationUnit? @relation(fields: [organizationUnitId], references: [id])
  headOfDepartment  String?
  budgetCode        String?
  description       String?
  isActive          Boolean           @default(true)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  
  procurementRequests ProcurementRequest[]
  users              UserOrganization[]
}
```

#### Migration 2.4: Add Warehouse Model
```prisma
model Warehouse {
  id                String            @id @default(uuid())
  name              String
  code              String            @unique
  organizationUnitId String?
  organizationUnit  OrganizationUnit? @relation(fields: [organizationUnitId], references: [id])
  type              String            // CENTRAL, REGIONAL, DEPARTMENTAL
  address           String?
  phone             String?
  manager           String?
  capacity          Float?
  isActive          Boolean           @default(true)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  
  locations         WarehouseLocation[]
  products          Product[]
  stockTransfersFrom StockTransfer[]  @relation("TransferFrom")
  stockTransfersTo   StockTransfer[]  @relation("TransferTo")
  goodsReceipts     GoodsReceipt[]
  users             UserOrganization[]
}
```

#### Migration 2.5: Add WarehouseLocation Model
```prisma
model WarehouseLocation {
  id          String   @id @default(uuid())
  name        String
  code        String   @unique
  warehouseId String
  warehouse   Warehouse @relation(fields: [warehouseId], references: [id])
  type        String   // SHELF, BIN, ROOM, ZONE
  capacity    Float?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  products    Product[]
}
```

### 2.2 Enhanced RBAC Models

#### Migration 2.6: Enhance User Model
```prisma
// Add to existing User model
organizationId String?
organization   Organization?    @relation(fields: [organizationId], references: [id])
userOrgUnits   UserOrganization[]
```

#### Migration 2.7: Add UserOrganization Model
```prisma
model UserOrganization {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  
  organizationId String?
  organization   Organization? @relation(fields: [organizationId], references: [id])
  
  organizationUnitId String?
  organizationUnit  OrganizationUnit? @relation(fields: [organizationUnitId], references: [id])
  
  departmentId String?
  department   Department? @relation(fields: [departmentId], references: [id])
  
  warehouseId String?
  warehouse   Warehouse? @relation(fields: [warehouseId], references: [id])
  
  isPrimary   Boolean  @default(false)
  isActive    Boolean  @default(true)
  assignedAt  DateTime @default(now())
  assignedBy  String?
  
  @@unique([userId, organizationId, organizationUnitId, departmentId, warehouseId])
}
```

#### Migration 2.8: Add Permission Model
```prisma
model Permission {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  module      String   // inventory, procurement, asset, etc.
  action      String   // read, create, update, delete, approve, etc.
  resource    String?  // specific resource if applicable
  createdAt   DateTime @default(now())
  
  rolePermissions RolePermission[]
}
```

#### Migration 2.9: Add Role Model (Enhanced)
```prisma
model Role {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  level       Int      @default(0) // Hierarchy level for approval chains
  isSystem    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  permissions RolePermission[]
  userRoles   UserRole[]
}
```

#### Migration 2.10: Add RolePermission Model
```prisma
model RolePermission {
  id           String     @id @default(uuid())
  roleId       String
  role         Role       @relation(fields: [roleId], references: [id])
  permissionId String
  permission   Permission @relation(fields: [permissionId], references: [id])
  createdAt    DateTime   @default(now())
  
  @@unique([roleId, permissionId])
}
```

#### Migration 2.11: Add UserRole Model
```prisma
model UserRole {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  roleId    String
  role      Role     @relation(fields: [roleId], references: [id])
  assignedAt DateTime @default(now())
  assignedBy String?
  expiresAt DateTime?
  
  @@unique([userId, roleId])
}
```

### 2.3 Data Migration Scripts

#### Script 2.1: Migrate existing users to enhanced RBAC
```typescript
// prisma/migrations/20240808_migrate_users_to_rbac.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateUsersToRBAC() {
  // Create default roles
  const superAdmin = await prisma.role.create({
    data: {
      name: 'SUPER_ADMIN',
      description: 'Full system access',
      level: 100,
      isSystem: true,
    },
  });

  const orgAdmin = await prisma.role.create({
    data: {
      name: 'ORGANIZATION_ADMIN',
      description: 'Organization-level administrator',
      level: 90,
      isSystem: true,
    },
  });

  const warehouseManager = await prisma.role.create({
    data: {
      name: 'WAREHOUSE_MANAGER',
      description: 'Warehouse operations manager',
      level: 80,
      isSystem: true,
    },
  });

  const storekeeper = await prisma.role.create({
    data: {
      name: 'STOREKEEPER',
      description: 'Inventory management staff',
      level: 70,
      isSystem: true,
    },
  });

  const procurementOfficer = await prisma.role.create({
    data: {
      name: 'PROCUREMENT_OFFICER',
      description: 'Procurement specialist',
      level: 75,
      isSystem: true,
    },
  });

  const viewer = await prisma.role.create({
    data: {
      name: 'VIEWER',
      description: 'Read-only access',
      level: 10,
      isSystem: true,
    },
  });

  // Create default permissions
  const permissions = [
    // Inventory permissions
    { name: 'inventory.read', module: 'inventory', action: 'read' },
    { name: 'inventory.create', module: 'inventory', action: 'create' },
    { name: 'inventory.update', module: 'inventory', action: 'update' },
    { name: 'inventory.delete', module: 'inventory', action: 'delete' },
    { name: 'inventory.adjust', module: 'inventory', action: 'adjust' },
    { name: 'inventory.transfer', module: 'inventory', action: 'transfer' },
    
    // Procurement permissions
    { name: 'procurement.create', module: 'procurement', action: 'create' },
    { name: 'procurement.review', module: 'procurement', action: 'review' },
    { name: 'procurement.approve', module: 'procurement', action: 'approve' },
    
    // User management
    { name: 'user.manage', module: 'user', action: 'manage' },
    { name: 'role.manage', module: 'role', action: 'manage' },
    
    // Reports
    { name: 'reports.read', module: 'reports', action: 'read' },
    { name: 'reports.export', module: 'reports', action: 'export' },
  ];

  for (const perm of permissions) {
    await prisma.permission.create({ data: perm });
  }

  // Assign permissions to roles
  const allPermissions = await prisma.permission.findMany();
  
  // Super Admin gets all permissions
  for (const perm of allPermissions) {
    await prisma.rolePermission.create({
      data: {
        roleId: superAdmin.id,
        permissionId: perm.id,
      },
    });
  }

  // Migrate existing users based on their current role
  const existingUsers = await prisma.user.findMany();
  
  for (const user of existingUsers) {
    let targetRole;
    
    switch (user.role) {
      case 'ADMIN':
        targetRole = orgAdmin;
        break;
      case 'MANAGER':
        targetRole = warehouseManager;
        break;
      case 'CASHIER':
        targetRole = storekeeper;
        break;
      default:
        targetRole = viewer;
    }
    
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: targetRole.id,
      },
    });
  }

  // Create default organization
  const defaultOrg = await prisma.organization.create({
    data: {
      name: 'Default Organization',
      code: 'DEFAULT',
      type: 'AGENCY',
      description: 'Default organization for existing data',
    },
  });

  console.log('User RBAC migration completed successfully');
}

migrateUsersToRBAC()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

## 3. Phase 3: Enhanced Inventory Models

### 3.1 Batch and Serial Tracking

#### Migration 3.1: Add ItemBatch Model
```prisma
model ItemBatch {
  id              String   @id @default(uuid())
  productId       String
  product         Product  @relation(fields: [productId], references: [id])
  batchNumber     String   @unique
  manufacturingDate DateTime?
  expiryDate      DateTime?
  initialQuantity Int
  currentQuantity Int
  unitCost        Float
  supplierId      String?
  supplier        Supplier? @relation(fields: [supplierId], references: [id])
  warehouseId     String?
  warehouse       Warehouse? @relation(fields: [warehouseId], references: [id])
  locationId      String?
  location        WarehouseLocation? @relation(fields: [locationId], references: [id])
  status          String   @default("ACTIVE") // ACTIVE, EXPIRED, CONSUMED
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  serialNumbers   SerialNumber[]
}
```

#### Migration 3.2: Add SerialNumber Model
```prisma
model SerialNumber {
  id          String    @id @default(uuid())
  productId   String
  product     Product   @relation(fields: [productId], references: [id])
  serialNumber String   @unique
  batchId     String?
  batch       ItemBatch? @relation(fields: [batchId], references: [id])
  warehouseId String?
  warehouse   Warehouse? @relation(fields: [warehouseId], references: [id])
  locationId  String?
  location    WarehouseLocation? @relation(fields: [locationId], references: [id])
  status      String    @default("IN_STOCK") // IN_STOCK, ASSIGNED, SOLD, DISPOSED
  assignedTo  String?
  assignedAt  DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

### 3.2 Inventory Transfer System

#### Migration 3.3: Add StockTransfer Model
```prisma
model StockTransfer {
  id              String          @id @default(uuid())
  transferNumber String          @unique
  fromWarehouseId String
  fromWarehouse   Warehouse      @relation("TransferFrom", fields: [fromWarehouseId], references: [id])
  toWarehouseId   String
  toWarehouse     Warehouse      @relation("TransferTo", fields: [toWarehouseId], references: [id])
  requestedBy     String
  requestedAt     DateTime       @default(now())
  approvedBy      String?
  approvedAt      DateTime?
  status          String         @default("REQUESTED") // REQUESTED, APPROVED, REJECTED, DISPATCHED, IN_TRANSIT, RECEIVED, CANCELLED
  notes           String?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  
  items           StockTransferItem[]
  approvals       Approval[]
}
```

#### Migration 3.4: Add StockTransferItem Model
```prisma
model StockTransferItem {
  id              String       @id @default(uuid())
  stockTransferId String
  stockTransfer   StockTransfer @relation(fields: [stockTransferId], references: [id])
  productId       String
  product         Product      @relation(fields: [productId], references: [id])
  batchId         String?
  batch           ItemBatch?   @relation(fields: [batchId], references: [id])
  requestedQuantity Int
  approvedQuantity  Int?
  dispatchedQuantity Int?
  receivedQuantity  Int?
  notes           String?
}
```

### 3.3 Physical Inventory Audit

#### Migration 3.5: Add InventoryAudit Model
```prisma
model InventoryAudit {
  id              String          @id @default(uuid())
  auditNumber     String          @unique
  warehouseId     String
  warehouse       Warehouse       @relation(fields: [warehouseId], references: [id])
  locationId      String?
  location        WarehouseLocation? @relation(fields: [locationId], references: [id])
  auditDate       DateTime        @default(now())
  conductedBy     String
  supervisedBy    String?
  status          String          @default("IN_PROGRESS") // IN_PROGRESS, COMPLETED, CANCELLED
  notes           String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  
  items           InventoryAuditItem[]
}
```

#### Migration 3.6: Add InventoryAuditItem Model
```prisma
model InventoryAuditItem {
  id              String          @id @default(uuid())
  inventoryAuditId String
  inventoryAudit  InventoryAudit  @relation(fields: [inventoryAuditId], references: [id])
  productId       String
  product         Product         @relation(fields: [productId], references: [id])
  expectedQuantity Int
  actualQuantity  Int
  variance        Int
  varianceReason  String?
  resolved        Boolean         @default(false)
  resolution      String?
  resolvedBy      String?
  resolvedAt      DateTime?
}
```

## 4. Phase 4: Procurement Models

### 4.1 Procurement Requests

#### Migration 4.1: Add ProcurementRequest Model
```prisma
model ProcurementRequest {
  id              String              @id @default(uuid())
  requestNumber   String              @unique
  organizationId  String?
  organization    Organization?       @relation(fields: [organizationId], references: [id])
  departmentId    String?
  department      Department?         @relation(fields: [departmentId], references: [id])
  requesterId     String
  requester       User                @relation(fields: [requesterId], references: [id])
  requestDate     DateTime            @default(now())
  requiredDate    DateTime
  priority        String              @default("NORMAL") // LOW, NORMAL, HIGH, URGENT
  justification   String?
  estimatedTotal  Float
  status          String              @default("DRAFT") // DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, PROCUREMENT_IN_PROGRESS, COMPLETED, CANCELLED
  notes           String?
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt
  
  items           ProcurementRequestItem[]
  approvals       Approval[]
  documents       Document[]
}
```

#### Migration 4.2: Add ProcurementRequestItem Model
```prisma
model ProcurementRequestItem {
  id                    String              @id @default(uuid())
  procurementRequestId  String
  procurementRequest    ProcurementRequest  @relation(fields: [procurementRequestId], references: [id])
  description           String
  quantity              Int
  unitOfMeasure         String
  estimatedUnitCost     Float
  estimatedTotal        Float
  technicalSpecs        String?
  category              String?
  notes                 String?
}
```

### 4.2 Tender Management

#### Migration 4.3: Add Tender Model
```prisma
model Tender {
  id                  String   @id @default(uuid())
  tenderNumber        String   @unique
  procurementRefId    String?
  procurementRef      ProcurementRequest? @relation(fields: [procurementRefId], references: [id])
  projectName         String
  procurementCategory String
  procurementMethod   String   // OPEN, RESTRICTED, DIRECT, EMERGENCY
  marketType          String   // NATIONAL, INTERNATIONAL
  issueDate           DateTime @default(now())
  submissionDeadline  DateTime
  bidValidityPeriod   Int      // in days
  bidSecurity         Float?
  currency            String   @default("ETB")
  contractType        String
  status              String   @default("DRAFT") // DRAFT, PUBLISHED, OPEN, CLOSED, EVALUATION, AWARDED, CANCELLED
  description         String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  
  items               TenderItem[]
  bids                Bid[]
  documents           Document[]
}
```

#### Migration 4.4: Add TenderItem Model
```prisma
model TenderItem {
  id          String   @id @default(uuid())
  tenderId    String
  tender      Tender   @relation(fields: [tenderId], references: [id])
  description String
  quantity    Int
  unit        String
  specifications String?
}
```

### 4.3 Bid Management

#### Migration 4.5: Add Bid Model
```prisma
model Bid {
  id              String   @id @default(uuid())
  bidNumber       String   @unique
  tenderId        String
  tender          Tender   @relation(fields: [tenderId], references: [id])
  supplierId      String
  supplier        Supplier @relation(fields: [supplierId], references: [id])
  submittedAt     DateTime @default(now())
  bidSecurity     Float?
  totalPrice      Float
  currency        String   @default("ETB")
  deliveryPeriod  Int      // in days
  validityPeriod  Int      // in days
  status          String   @default("SUBMITTED") // SUBMITTED, QUALIFIED, DISQUALIFIED, WITHDRAWN, SELECTED, REJECTED
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  items           BidItem[]
  technicalEvaluations TechnicalEvaluation[]
  financialEvaluation FinancialEvaluation?
  documents       Document[]
}
```

#### Migration 4.6: Add BidItem Model
```prisma
model BidItem {
  id          String   @id @default(uuid())
  bidId       String
  bid         Bid      @relation(fields: [bidId], references: [id])
  tenderItemId String?
  tenderItem  TenderItem? @relation(fields: [tenderItemId], references: [id])
  description String
  quantity    Int
  unitPrice   Float
  totalPrice  Float
  specifications String?
}
```

### 4.4 Evaluation System

#### Migration 4.7: Add TechnicalRequirement Model
```prisma
model TechnicalRequirement {
  id          String   @id @default(uuid())
  tenderId    String
  tender      Tender   @relation(fields: [tenderId], references: [id])
  tenderItemId String?
  tenderItem  TenderItem? @relation(fields: [tenderItemId], references: [id])
  attribute   String
  requirement String
  type        String   // MANDATORY, PREFERRED
  category    String   // TECHNICAL, COMMERCIAL, GENERAL
  weight      Float    @default(1.0)
  createdAt   DateTime @default(now())
  
  evaluations TechnicalEvaluation[]
}
```

#### Migration 4.8: Add TechnicalEvaluation Model
```prisma
model TechnicalEvaluation {
  id                    String   @id @default(uuid())
  bidId                 String
  bid                   Bid      @relation(fields: [bidId], references: [id])
  technicalRequirementId String
  technicalRequirement TechnicalRequirement @relation(fields: [technicalRequirementId], references: [id])
  supplierResponse      String?
  compliance            Boolean
  score                 Float?
  evaluatorId           String
  evaluator             User     @relation(fields: [evaluatorId], references: [id])
  comments              String?
  evaluatedAt           DateTime @default(now())
  
  @@unique([bidId, technicalRequirementId, evaluatorId])
}
```

#### Migration 4.9: Add FinancialEvaluation Model
```prisma
model FinancialEvaluation {
  id              String   @id @default(uuid())
  bidId           String   @unique
  bid             Bid      @relation(fields: [bidId], references: [id])
  bidPrice        Float
  deliveryCost    Float?
  taxes           Float?
  totalEvaluatedPrice Float
  priceScore      Float?
  evaluatorId     String
  evaluator       User     @relation(fields: [evaluatorId], references: [id])
  comments        String?
  evaluatedAt     DateTime @default(now())
}
```

### 4.5 Contract Management

#### Migration 4.10: Add Contract Model
```prisma
model Contract {
  id              String   @id @default(uuid())
  contractNumber  String   @unique
  tenderId        String?
  tender          Tender?  @relation(fields: [tenderId], references: [id])
  bidId           String?
  bid             Bid?     @relation(fields: [bidId], references: [id])
  supplierId      String
  supplier        Supplier @relation(fields: [supplierId], references: [id])
  startDate       DateTime
  endDate         DateTime
  contractValue   Float
  currency        String   @default("ETB")
  paymentTerms    String?
  deliveryTerms   String?
  status          String   @default("DRAFT") // DRAFT, ACTIVE, EXPIRED, TERMINATED, CANCELLED
  description     String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  items           ContractItem[]
  purchaseOrders  PurchaseOrder[]
  documents       Document[]
}
```

#### Migration 4.11: Add ContractItem Model
```prisma
model ContractItem {
  id          String   @id @default(uuid())
  contractId  String
  contract    Contract @relation(fields: [contractId], references: [id])
  description String
  quantity    Int
  unit        String
  unitPrice   Float
  totalPrice  Float
}
```

## 5. Phase 5: Goods Receiving

### 5.1 Goods Receipt Model

#### Migration 5.1: Add GoodsReceipt Model
```prisma
model GoodsReceipt {
  id              String          @id @default(uuid())
  receiptNumber   String          @unique
  purchaseOrderId String?
  purchaseOrder   PurchaseOrder?  @relation(fields: [purchaseOrderId], references: [id])
  contractId      String?
  contract        Contract?       @relation(fields: [contractId], references: [id])
  supplierId      String
  supplier        Supplier        @relation(fields: [supplierId], references: [id])
  warehouseId     String
  warehouse       Warehouse       @relation(fields: [warehouseId], references: [id])
  deliveryNote    String?
  receivedDate    DateTime        @default(now())
  receivedBy      String
  inspectedBy     String?
  inspectionDate  DateTime?
  status          String          @default("PENDING") // PENDING, INSPECTED, ACCEPTED, PARTIALLY_ACCEPTED, REJECTED
  notes           String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  
  items           GoodsReceiptItem[]
  documents       Document[]
}
```

#### Migration 5.2: Add GoodsReceiptItem Model
```prisma
model GoodsReceiptItem {
  id                String        @id @default(uuid())
  goodsReceiptId    String
  goodsReceipt      GoodsReceipt  @relation(fields: [goodsReceiptId], references: [id])
  productId         String
  product           Product       @relation(fields: [productId], references: [id])
  orderedQuantity   Int
  receivedQuantity  Int
  acceptedQuantity  Int
  rejectedQuantity  Int
  damagedQuantity   Int
  batchNumber       String?
  serialNumbers     String[]      // Array of serial numbers
  unitCost          Float
  inspectionResult  String?
  notes             String?
}
```

## 6. Phase 6: Asset Management

### 6.1 Asset Models

#### Migration 6.1: Add Asset Model
```prisma
model Asset {
  id              String          @id @default(uuid())
  assetNumber     String          @unique
  serialNumber    String          @unique
  name            String
  description     String?
  category        String
  model           String?
  manufacturer    String?
  purchaseDate    DateTime?
  purchaseCost    Float
  currentValue    Float
  location        String?
  departmentId    String?
  department      Department?     @relation(fields: [departmentId], references: [id])
  warehouseId     String?
  warehouse       Warehouse?      @relation(fields: [warehouseId], references: [id])
  assignedTo      String?
  condition       String          @default("GOOD") // NEW, GOOD, FAIR, POOR, BROKEN
  warrantyExpiry  DateTime?
  status          String          @default("IN_STOCK") // PURCHASED, RECEIVED, IN_STOCK, ASSIGNED, IN_USE, MAINTENANCE, RETIRED, DISPOSED
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  
  assignments     AssetAssignment[]
  maintenance     AssetMaintenance[]
  disposals       AssetDisposal[]
  documents       Document[]
}
```

#### Migration 6.2: Add AssetAssignment Model
```prisma
model AssetAssignment {
  id              String   @id @default(uuid())
  assetId         String
  asset           Asset    @relation(fields: [assetId], references: [id])
  assignedTo      String
  assignedBy      String
  assignedDate    DateTime @default(now())
  location        String?
  departmentId    String?
  department      Department? @relation(fields: [departmentId], references: [id])
  returnDate      DateTime?
  conditionBefore  String?
  conditionAfter   String?
  notes           String?
  status          String   @default("ACTIVE") // ACTIVE, RETURNED, TRANSFERRED
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

#### Migration 6.3: Add AssetMaintenance Model
```prasma
model AssetMaintenance {
  id              String   @id @default(uuid())
  assetId         String
  asset           Asset    @relation(fields: [assetId], references: [id])
  maintenanceType String   // PREVENTIVE, CORRECTIVE, EMERGENCY
  description     String
  scheduledDate   DateTime?
  completedDate   DateTime?
  technician      String?
  serviceProvider String?
  cost            Float?
  partsUsed       String?
  downtime        Float?   // in hours
  nextMaintenanceDate DateTime?
  status          String   @default("SCHEDULED") // SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

#### Migration 6.4: Add AssetDisposal Model
```prisma
model AssetDisposal {
  id              String   @id @default(uuid())
  assetId         String
  asset           Asset    @relation(fields: [assetId], references: [id])
  disposalType    String   // SALE, DONATION, RECYCLE, SCRAPPING
  disposalDate    DateTime @default(now())
  disposedBy      String
  approvedBy      String?
  reason          String?
  disposalValue   Float?
  recipient       String?
  status          String   @default("PENDING") // PENDING, APPROVED, COMPLETED, CANCELLED
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

## 7. Phase 7: Workflow and Approval System

### 7.1 Workflow Models

#### Migration 7.1: Add Workflow Model
```prisma
model Workflow {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  entityType  String   // PROCUREMENT_REQUEST, STOCK_TRANSFER, ASSET_DISPOSAL, etc.
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  steps       WorkflowStep[]
}
```

#### Migration 7.2: Add WorkflowStep Model
```prisma
model WorkflowStep {
  id          String   @id @default(uuid())
  workflowId  String
  workflow    Workflow @relation(fields: [workflowId], references: [id])
  stepNumber  Int
  name        String
  description String?
  role        String   // Required role for this step
  required    Boolean  @default(true)
  autoApprove Boolean  @default(false)
  createdAt   DateTime @default(now())
  
  approvals   Approval[]
  
  @@unique([workflowId, stepNumber])
}
```

#### Migration 7.3: Add Approval Model
```prisma
model Approval {
  id              String   @id @default(uuid())
  entityType      String
  entityId        String
  workflowStepId  String?
  workflowStep    WorkflowStep? @relation(fields: [workflowStepId], references: [id])
  approverId      String
  approver        User     @relation(fields: [approverId], references: [id])
  status          String   @default("PENDING") // PENDING, APPROVED, REJECTED, RETURNED
  decisionDate    DateTime?
  comments        String?
  previousState   String?
  newState        String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

## 8. Phase 8: Document Management

### 8.1 Document Models

#### Migration 8.1: Add Document Model
```prisma
model Document {
  id              String   @id @default(uuid())
  entityType      String
  entityId        String
  fileName        String
  fileType        String
  fileSize        Int
  filePath        String
  uploadedBy      String
  uploadedAt      DateTime @default(now())
  description     String?
  category        String?
  expiryDate      DateTime?
  isConfidential  Boolean  @default(false)
  accessLevel     String   @default("INTERNAL") // PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED
  version         Int      @default(1)
  isLatest        Boolean  @default(true)
  
  // Relations to entities that can have documents
  procurementRequest ProcurementRequest? @relation(fields: [entityId], references: [id])
  tender           Tender?              @relation(fields: [entityId], references: [id])
  bid              Bid?                 @relation(fields: [entityId], references: [id])
  contract         Contract?            @relation(fields: [entityId], references: [id])
  goodsReceipt     GoodsReceipt?        @relation(fields: [entityId], references: [id])
  asset            Asset?               @relation(fields: [entityId], references: [id])
}
```

## 9. Phase 9: Enhanced Audit and Risk

### 9.1 Enhanced Audit Model

#### Migration 9.1: Enhance ActivityLog Model
```prisma
// Add to existing ActivityLog model
entityType      String?
entityId        String?
previousValues  Json?
newValues       Json?
ipAddress       String?
userAgent       String?
sessionId       String?
```

### 9.2 Risk Detection

#### Migration 9.2: Add RiskIndicator Model
```prisma
model RiskIndicator {
  id              String   @id @default(uuid())
  entityType      String
  entityId        String
  riskType        String   // PRICE_ANOMALY, QUANTITY_ANOMALY, DUPLICATE_ACTIVITY, DELIVERY_DELAY, etc.
  severity        String   // LOW, MEDIUM, HIGH, CRITICAL
  description     String
  detectedAt      DateTime @default(now())
  detectedBy      String?  // System or user ID
  status          String   @default("OPEN") // OPEN, UNDER_REVIEW, RESOLVED, FALSE_POSITIVE
  resolvedBy      String?
  resolvedAt      DateTime?
  resolution      String?
  metadata        Json?
  
  @@unique([entityType, entityId, riskType, detectedAt])
}
```

## 10. Phase 10: Notification System

### 10.1 Notification Models

#### Migration 10.1: Add Notification Model
```prisma
model Notification {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  type        String   // LOW_STOCK, APPROVAL_PENDING, DEADLINE_ALERT, etc.
  title       String
  message     String
  entityType  String?
  entityId    String?
  priority    String   @default("NORMAL") // LOW, NORMAL, HIGH, URGENT
  isRead      Boolean  @default(false)
  readAt      DateTime?
  actionUrl   String?
  createdAt   DateTime @default(now())
  
  @@index([userId, isRead])
}
```

#### Migration 10.2: Add User Relation for Notifications
```prisma
// Add to existing User model
notifications Notification[]
```

## 11. Migration Execution Plan

### 11.1 Pre-Migration Checklist
- [ ] Backup production database
- [ ] Test migrations on staging environment
- [ ] Prepare rollback scripts
- [ ] Schedule maintenance window
- [ ] Notify stakeholders
- [ ] Prepare monitoring tools

### 11.2 Migration Execution Steps

**Step 1: Preparation**
```bash
# Create backup
pg_dump -U username -d database_name > backup_$(date +%Y%m%d).sql

# Generate migration
npx prisma migrate dev --name phase_2_organization_rbac
```

**Step 2: Execute Phase 2 Migrations**
```bash
# Apply migrations
npx prisma migrate deploy

# Run data migration scripts
npx tsx prisma/migrations/20240808_migrate_users_to_rbac.ts
```

**Step 3: Validate**
```bash
# Check schema
npx prisma studio

# Validate data integrity
npx tsx prisma/validate_migration.ts
```

**Step 4: Repeat for Each Phase**
- Execute Steps 1-3 for each phase
- Validate after each phase
- Monitor system performance

### 11.3 Post-Migration Tasks
- [ ] Update application code
- [ ] Test new functionality
- [ ] Train users
- [ ] Monitor system logs
- [ ] Performance optimization
- [ ] Update documentation

## 12. Rollback Plan

### 12.1 Rollback Procedure
```bash
# Stop application
# Restore database from backup
psql -U username -d database_name < backup_20240808.sql

# Or rollback specific migration
npx prisma migrate resolve --rolled-back [migration_name]
```

### 12.2 Rollback Triggers
- Data corruption detected
- Performance degradation >50%
- Critical functionality broken
- Security vulnerability identified

## 13. Monitoring and Validation

### 13.1 Health Checks
- Database connection
- Query performance
- Data integrity
- Application functionality

### 13.2 Validation Queries
```sql
-- Check user migration
SELECT COUNT(*) FROM "UserRole";
SELECT COUNT(*) FROM "User" WHERE role IS NOT NULL;

-- Check organization data
SELECT COUNT(*) FROM "Organization";
SELECT COUNT(*) FROM "OrganizationUnit";

-- Check data consistency
SELECT COUNT(*) FROM "Product" WHERE "categoryId" IS NULL;
```

## 14. Timeline Estimate

- **Phase 2**: 2-3 weeks
- **Phase 3**: 2 weeks
- **Phase 4**: 3-4 weeks
- **Phase 5**: 1-2 weeks
- **Phase 6**: 2-3 weeks
- **Phase 7**: 2 weeks
- **Phase 8**: 1-2 weeks
- **Phase 9**: 1-2 weeks
- **Phase 10**: 1 week

**Total Estimated Time**: 15-22 weeks

---

**Document Version:** 1.0  
**Last Updated:** 2026-08-08  
**Status:** Migration Plan Complete - Ready for Execution