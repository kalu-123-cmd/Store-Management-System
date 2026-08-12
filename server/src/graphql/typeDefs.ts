export const typeDefs = `#graphql
  scalar Date
  scalar JSON

  type User {
    id: ID!
    name: String!
    email: String!
    role: String!
    organizationId: String
    organization: Organization
    createdAt: String!
    userRoles: [UserRole!]!
    userOrganizations: [UserOrganization!]!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Category {
    id: ID!
    name: String!
    description: String
    productCount: Int
  }

  type Supplier {
    id: ID!
    name: String!
    contactName: String
    email: String
    phone: String
    address: String
  }

  type Customer {
    id: ID!
    name: String!
    email: String
    phone: String
    createdAt: String!
    totalSpent: Float
    purchaseCount: Int
    sales: [Sale!]!
  }

  type Product {
    id: ID!
    name: String!
    sku: String!
    barcode: String
    description: String
    imageUrl: String
    costPrice: Float!
    sellingPrice: Float!
    stock: Int!
    minStockLevel: Int!
    status: String!
    categoryId: String!
    category: Category
    supplierId: String
    supplier: Supplier
    warehouseId: String
    warehouse: Warehouse
    locationId: String
    location: WarehouseLocation
    createdAt: String!
    updatedAt: String!
    profitMargin: Float
    saleItems: [SaleItem!]!
    batches: [ItemBatch!]!
    serialNumbers: [SerialNumber!]!
    goodsReceiptItems: [GoodsReceiptItem!]!
  }

  type Transaction {
    id: ID!
    productId: String!
    product: Product
    quantity: Int!
    type: String!
    notes: String
    userId: String
    createdAt: String!
  }

  type SaleItem {
    id: ID!
    saleId: String!
    productId: String!
    product: Product
    quantity: Int!
    price: Float!
  }

  type SaleReturn {
    id: ID!
    saleId: String!
    sale: Sale
    refundAmount: Float!
    reason: String
    userId: String!
    user: User
    createdAt: String!
  }

  type Sale {
    id: ID!
    invoiceNo: String!
    totalAmount: Float!
    subtotal: Float
    vatAmount: Float
    customerId: String
    customer: Customer
    userId: String!
    user: User
    items: [SaleItem!]!
    returns: [SaleReturn!]!
    paymentMethod: String
    paymentStatus: String
    creditAmount: Float
    branchId: String
    notes: String
    cogsAmount: Float
    profitAmount: Float
    createdAt: String!
  }

  type ActivityLog {
    id: ID!
    userId: String!
    user: User
    action: String!
    details: String
    ipAddress: String
    entityType: String
    entityId: String
    oldValue: String
    newValue: String
    changes: String
    createdAt: String!
  }

  type DashboardStats {
    totalProducts: Int!
    totalCategories: Int!
    totalSuppliers: Int!
    totalCustomers: Int!
    inventoryValue: Float!
    todaySales: Float!
    monthlyRevenue: Float!
    monthlyProfit: Float!
    lowStockCount: Int!
    outOfStockCount: Int!
    totalStock: Int!
    expiringCount: Int!
    pendingPurchases: Int!
    outstandingReceivables: Float!
    outstandingPayables: Float!
  }

  type PurchaseOrder {
    id: ID!
    poNumber: String!
    supplierId: String
    supplier: Supplier
    contractId: String
    contract: Contract
    status: String!
    notes: String
    userId: String!
    user: User
    items: [PurchaseOrderItem!]!
    totalCost: Float!
    createdAt: String!
    updatedAt: String!
    goodsReceipts: [GoodsReceipt!]!
  }

  type PurchaseOrderItem {
    id: ID!
    purchaseOrderId: String!
    productId: String!
    product: Product
    quantity: Int!
    unitCost: Float!
  }

  input POItemInput {
    productId: String!
    quantity: Int!
    unitCost: Float!
  }

  type Branch {
    id: ID!
    name: String!
    address: String
    phone: String
    manager: String
    isActive: Boolean!
    createdAt: String!
  }

  # ORGANIZATION TYPES

  type Organization {
    id: ID!
    name: String!
    code: String!
    type: String!
    description: String
    address: String
    phone: String
    email: String
    website: String
    logoUrl: String
    isActive: Boolean!
    createdAt: String!
    updatedAt: String!
    units: [OrganizationUnit!]!
    users: [User!]!
  }

  type OrganizationUnit {
    id: ID!
    name: String!
    code: String!
    type: String!
    parentId: String
    parent: OrganizationUnit
    organizationId: String!
    organization: Organization!
    address: String
    phone: String
    email: String
    headOfUnit: String
    isActive: Boolean!
    createdAt: String!
    updatedAt: String!
    children: [OrganizationUnit!]!
    departments: [Department!]!
    warehouses: [Warehouse!]!
    users: [UserOrganization!]!
  }

  type Department {
    id: ID!
    name: String!
    code: String!
    organizationUnitId: String
    organizationUnit: OrganizationUnit
    headOfDepartment: String
    budgetCode: String
    description: String
    isActive: Boolean!
    createdAt: String!
    updatedAt: String!
    procurementRequests: [ProcurementRequest!]!
    users: [UserOrganization!]!
    assets: [Asset!]!
    assetAssignments: [AssetAssignment!]!
  }

  type Warehouse {
    id: ID!
    name: String!
    code: String!
    organizationUnitId: String
    organizationUnit: OrganizationUnit
    type: String!
    address: String
    phone: String
    manager: String
    capacity: Float
    isActive: Boolean!
    createdAt: String!
    updatedAt: String!
    locations: [WarehouseLocation!]!
    products: [Product!]!
    users: [UserOrganization!]!
    assets: [Asset!]!
  }

  type WarehouseLocation {
    id: ID!
    name: String!
    code: String!
    warehouseId: String!
    warehouse: Warehouse!
    type: String!
    capacity: Float
    isActive: Boolean!
    createdAt: String!
    updatedAt: String!
    products: [Product!]!
  }

  # RBAC TYPES

  type Permission {
    id: ID!
    name: String!
    description: String
    module: String!
    action: String!
    resource: String
    createdAt: String!
  }

  type Role {
    id: ID!
    name: String!
    description: String
    level: Int!
    isSystem: Boolean!
    createdAt: String!
    updatedAt: String!
    permissions: [Permission!]!
    userRoles: [UserRole!]!
  }

  type RolePermission {
    id: ID!
    roleId: String!
    role: Role!
    permissionId: String!
    permission: Permission!
    createdAt: String!
  }

  type UserRole {
    id: ID!
    userId: String!
    user: User!
    roleId: String!
    role: Role!
    assignedAt: String!
    assignedBy: String
    expiresAt: String
  }

  type UserOrganization {
    id: ID!
    userId: String!
    user: User!
    organizationId: String
    organization: Organization
    organizationUnitId: String
    organizationUnit: OrganizationUnit
    departmentId: String
    department: Department
    warehouseId: String
    warehouse: Warehouse
    isPrimary: Boolean!
    isActive: Boolean!
    assignedAt: String!
    assignedBy: String
  }

  # Placeholder types for future phases
  type ProcurementRequest {
    id: ID!
    requestNumber: String!
    status: String!
  }

  type Asset {
    id: ID!
    assetNumber: String!
    name: String!
    status: String!
  }

  type AssetAssignment {
    id: ID!
    assetId: String!
    status: String!
  }

  type Approval {
    id: ID!
    entityType: String!
    entityId: String!
    workflowStepId: String
    workflowStep: WorkflowStep
    approverId: String!
    approver: User!
    status: String!
    decisionDate: String
    comments: String
    previousState: String
    newState: String
    createdAt: String!
    updatedAt: String!
  }

  type Document {
    id: ID!
    entityType: String!
    entityId: String
    fileName: String!
    fileType: String!
    fileSize: Int!
    filePath: String!
    uploadedBy: String!
    uploadedAt: String!
    description: String
    category: String
    expiryDate: String
    isConfidential: Boolean!
    accessLevel: String!
    version: Int!
    isLatest: Boolean!
    parentDocumentId: String
    parentDocument: Document
    versions: [Document!]!
  }

  # NOTIFICATION TYPES (Phase 11)

  type Notification {
    id: ID!
    userId: String!
    user: User
    type: String!
    title: String!
    message: String!
    actionUrl: String
    entityType: String
    entityId: String
    priority: String!
    isRead: Boolean!
    readAt: String
    createdAt: String!
  }

  type NotificationPreference {
    id: ID!
    userId: String!
    user: User
    emailEnabled: Boolean!
    smsEnabled: Boolean!
    pushEnabled: Boolean!
    inventoryAlerts: Boolean!
    procurementAlerts: Boolean!
    assetAlerts: Boolean!
    deadlineAlerts: Boolean!
    riskAlerts: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  # AUDIT & RISK TYPES (Phase 9)

  type RiskIndicator {
    id: ID!
    entityType: String!
    entityId: String!
    riskType: String!
    severity: String!
    description: String
    detectedAt: String!
    resolvedAt: String
    resolvedBy: String
    status: String!
    confidence: Float
    metadata: String
    createdAt: String!
    updatedAt: String!
  }

  # REPORTING & ANALYTICS TYPES (Phase 10)

  type InventoryReport {
    totalProducts: Int!
    activeProducts: Int!
    lowStockProducts: Int!
    outOfStockProducts: Int!
    totalStockValue: Float!
    totalStock: Int!
    byCategory: [CategorySummary!]!
    byWarehouse: [WarehouseSummary!]!
    expiringItems: [ExpiringItem!]!
  }

  type CategorySummary {
    category: String!
    productCount: Int!
    totalStock: Int!
    totalValue: Float!
    lowStockCount: Int!
  }

  type WarehouseSummary {
    warehouseId: String!
    warehouseName: String!
    productCount: Int!
    totalStock: Int!
    totalValue: Float!
    lowStockCount: Int!
  }

  type ExpiringItem {
    productId: String!
    productName: String!
    batchNumber: String!
    expiryDate: String!
    quantity: Int!
    value: Float!
    daysToExpiry: Int!
  }

  type ProcurementReport {
    totalRequests: Int!
    approvedRequests: Int!
    pendingRequests: Int!
    rejectedRequests: Int!
    totalSpent: Float!
    averageProcessingTime: Float!
    byDepartment: [DepartmentProcurementSummary!]!
    byCategory: [CategoryProcurementSummary!]!
    topSuppliers: [SupplierSummary!]!
  }

  type DepartmentProcurementSummary {
    departmentId: String!
    departmentName: String!
    requestCount: Int!
    approvedCount: Int!
    totalSpent: Float!
  }

  type CategoryProcurementSummary {
    category: String!
    requestCount: Int!
    totalSpent: Float!
  }

  type SupplierSummary {
    supplierId: String!
    supplierName: String!
    totalOrders: Int!
    totalSpent: Float!
    averageDeliveryTime: Float!
    onTimeDeliveryRate: Float!
  }

  type AssetReport {
    totalAssets: Int!
    totalValue: Float!
    depreciatedValue: Float!
    inUseAssets: Int!
    inStockAssets: Int!
    maintenanceAssets: Int!
    retiredAssets: Int!
    byCategory: [AssetCategorySummary!]!
    byDepartment: [AssetDepartmentSummary!]!
    maintenanceCost: Float!
    overdueMaintenance: Int!
  }

  type AssetCategorySummary {
    category: String!
    assetCount: Int!
    totalValue: Float!
    depreciatedValue: Float!
  }

  type AssetDepartmentSummary {
    departmentId: String!
    departmentName: String!
    assetCount: Int!
    totalValue: Float!
  }

  type Analytics {
    inventoryTrends: [TrendData!]!
    procurementTrends: [TrendData!]!
    assetTrends: [TrendData!]!
    forecast: ForecastData!
    insights: [Insight!]!
  }

  type TrendData {
    period: String!
    value: Float!
    change: Float!
    changePercent: Float!
  }

  type ForecastData {
    inventoryForecast: [ForecastItem!]!
    procurementForecast: [ForecastItem!]!
    confidence: Float!
  }

  type ForecastItem {
    period: String!
    predictedValue: Float!
    lowerBound: Float!
    upperBound: Float!
  }

  type Insight {
    type: String!
    title: String!
    description: String!
    severity: String!
    actionable: Boolean!
    metadata: String
  }

  # PROCUREMENT TYPES (Phase 4 & 5)

  type ProcurementRequest {
    id: ID!
    requestNumber: String!
    organizationId: String
    organization: Organization
    departmentId: String
    department: Department
    requesterId: String!
    requester: User
    requestDate: String!
    requiredDate: String!
    priority: String!
    justification: String
    estimatedTotal: Float!
    status: String!
    notes: String
    createdAt: String!
    updatedAt: String!
    items: [ProcurementRequestItem!]!
    approvals: [Approval!]!
    tenders: [Tender!]!
  }

  type ProcurementRequestItem {
    id: ID!
    procurementRequestId: String!
    procurementRequest: ProcurementRequest!
    description: String!
    quantity: Int!
    unitOfMeasure: String!
    estimatedUnitCost: Float!
    estimatedTotal: Float!
    technicalSpecs: String
    category: String
    notes: String
  }

  type Tender {
    id: ID!
    tenderNumber: String!
    procurementRefId: String
    procurementRef: ProcurementRequest
    projectName: String!
    procurementCategory: String!
    procurementMethod: String!
    marketType: String!
    issueDate: String!
    submissionDeadline: String!
    bidValidityPeriod: Int!
    bidSecurity: Float
    currency: String!
    contractType: String!
    status: String!
    description: String
    createdAt: String!
    updatedAt: String!
    items: [TenderItem!]!
    bids: [Bid!]!
    contracts: [Contract!]!
    technicalRequirements: [TechnicalRequirement!]!
  }

  type TenderItem {
    id: ID!
    tenderId: String!
    tender: Tender!
    description: String!
    quantity: Int!
    unit: String!
    specifications: String
    technicalRequirements: [TechnicalRequirement!]!
    bidItems: [BidItem!]!
  }

  type Bid {
    id: ID!
    bidNumber: String!
    tenderId: String!
    tender: Tender!
    supplierId: String!
    supplier: Supplier!
    submittedAt: String!
    bidSecurity: Float
    totalPrice: Float!
    currency: String!
    deliveryPeriod: Int!
    validityPeriod: Int!
    status: String!
    notes: String
    createdAt: String!
    updatedAt: String!
    items: [BidItem!]!
    technicalEvaluations: [TechnicalEvaluation!]!
    financialEvaluation: FinancialEvaluation
    contracts: [Contract!]!
  }

  type BidItem {
    id: ID!
    bidId: String!
    bid: Bid!
    tenderItemId: String
    tenderItem: TenderItem
    description: String!
    quantity: Int!
    unitPrice: Float!
    totalPrice: Float!
    specifications: String
  }

  type TechnicalRequirement {
    id: ID!
    tenderId: String!
    tender: Tender!
    tenderItemId: String
    tenderItem: TenderItem
    attribute: String!
    requirement: String!
    type: String!
    category: String!
    weight: Float!
    createdAt: String!
    evaluations: [TechnicalEvaluation!]!
  }

  type TechnicalEvaluation {
    id: ID!
    bidId: String!
    bid: Bid!
    technicalRequirementId: String!
    technicalRequirement: TechnicalRequirement!
    supplierResponse: String
    compliance: Boolean!
    score: Float
    evaluatorId: String!
    evaluator: User
    comments: String
    evaluatedAt: String!
  }

  type FinancialEvaluation {
    id: ID!
    bidId: String!
    bid: Bid!
    bidPrice: Float!
    deliveryCost: Float
    taxes: Float
    totalEvaluatedPrice: Float!
    priceScore: Float
    evaluatorId: String!
    evaluator: User
    comments: String
    evaluatedAt: String!
  }

  type Contract {
    id: ID!
    contractNumber: String!
    tenderId: String
    tender: Tender
    bidId: String
    bid: Bid
    supplierId: String!
    supplier: Supplier!
    startDate: String!
    endDate: String!
    contractValue: Float!
    currency: String!
    paymentTerms: String
    deliveryTerms: String
    status: String!
    description: String
    createdAt: String!
    updatedAt: String!
    items: [ContractItem!]!
    purchaseOrders: [PurchaseOrder!]!
    goodsReceipts: [GoodsReceipt!]!
  }

  type ContractItem {
    id: ID!
    contractId: String!
    contract: Contract!
    description: String!
    quantity: Int!
    unit: String!
    unitPrice: Float!
    totalPrice: Float!
  }

  type GoodsReceipt {
    id: ID!
    receiptNumber: String!
    purchaseOrderId: String
    purchaseOrder: PurchaseOrder
    contractId: String
    contract: Contract
    supplierId: String!
    supplier: Supplier!
    warehouseId: String!
    warehouse: Warehouse!
    deliveryNote: String
    receivedDate: String!
    receivedBy: String!
    inspectedBy: String
    inspectionDate: String
    status: String!
    notes: String
    createdAt: String!
    updatedAt: String!
    items: [GoodsReceiptItem!]!
  }

  type GoodsReceiptItem {
    id: ID!
    goodsReceiptId: String!
    goodsReceipt: GoodsReceipt!
    productId: String!
    product: Product!
    orderedQuantity: Int!
    receivedQuantity: Int!
    acceptedQuantity: Int!
    rejectedQuantity: Int!
    damagedQuantity: Int
    batchNumber: String
    serialNumbers: String
    unitCost: Float
  }

  # ASSET MANAGEMENT TYPES (Phase 7)

  type Asset {
    id: ID!
    assetNumber: String!
    serialNumber: String!
    name: String!
    description: String
    category: String!
    model: String
    manufacturer: String
    purchaseDate: String
    purchaseCost: Float!
    currentValue: Float!
    location: String
    departmentId: String
    department: Department
    warehouseId: String
    warehouse: Warehouse
    assignedTo: String
    condition: String!
    warrantyExpiry: String
    status: String!
    createdAt: String!
    updatedAt: String!
    assignments: [AssetAssignment!]!
    maintenance: [AssetMaintenance!]!
    disposals: [AssetDisposal!]!
  }

  type AssetAssignment {
    id: ID!
    assetId: String!
    asset: Asset!
    assignedTo: String!
    assignedBy: String!
    assignedDate: String!
    location: String
    departmentId: String
    department: Department
    returnDate: String
    conditionBefore: String
    conditionAfter: String
    notes: String
    status: String!
    createdAt: String!
    updatedAt: String!
  }

  type AssetMaintenance {
    id: ID!
    assetId: String!
    asset: Asset!
    maintenanceType: String!
    description: String!
    scheduledDate: String
    completedDate: String
    technician: String
    serviceProvider: String
    cost: Float
    partsUsed: String
    downtime: Float
    nextMaintenanceDate: String
    status: String!
    notes: String
    createdAt: String!
    updatedAt: String!
  }

  type AssetDisposal {
    id: ID!
    assetId: String!
    asset: Asset!
    disposalType: String!
    disposalDate: String!
    disposedBy: String!
    approvedBy: String
    reason: String
    disposalValue: Float
    recipient: String
    status: String!
    notes: String
    createdAt: String!
    updatedAt: String!
  }

  # WORKFLOW & APPROVAL TYPES (Phase 7)

  type Workflow {
    id: ID!
    name: String!
    description: String
    entityType: String!
    isActive: Boolean!
    createdAt: String!
    updatedAt: String!
    steps: [WorkflowStep!]!
  }

  type WorkflowStep {
    id: ID!
    workflowId: String!
    workflow: Workflow!
    stepNumber: Int!
    name: String!
    description: String
    role: String!
    required: Boolean!
    autoApprove: Boolean!
    createdAt: String!
    approvals: [Approval!]!
  }

  # ENHANCED INVENTORY TYPES (Phase 3)

  type ItemBatch {
    id: ID!
    productId: String!
    product: Product
    batchNumber: String!
    manufacturingDate: String
    expiryDate: String
    initialQuantity: Int!
    currentQuantity: Int!
    unitCost: Float!
    supplierId: String
    supplier: Supplier
    warehouseId: String
    warehouse: Warehouse
    locationId: String
    location: WarehouseLocation
    status: String!
    createdAt: String!
    updatedAt: String!
    serialNumbers: [SerialNumber!]!
    stockTransferItems: [StockTransferItem!]!
  }

  type SerialNumber {
    id: ID!
    productId: String!
    product: Product
    serialNumber: String!
    batchId: String
    batch: ItemBatch
    warehouseId: String
    warehouse: Warehouse
    locationId: String
    location: WarehouseLocation
    status: String!
    assignedTo: String
    assignedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type StockTransfer {
    id: ID!
    transferNumber: String!
    fromWarehouseId: String!
    fromWarehouse: Warehouse!
    toWarehouseId: String!
    toWarehouse: Warehouse!
    requestedBy: String!
    requestedAt: String!
    approvedBy: String
    approvedAt: String
    status: String!
    notes: String
    createdAt: String!
    updatedAt: String!
    items: [StockTransferItem!]!
  }

  type StockTransferItem {
    id: ID!
    stockTransferId: String!
    stockTransfer: StockTransfer!
    productId: String!
    product: Product
    batchId: String
    batch: ItemBatch
    requestedQuantity: Int!
    approvedQuantity: Int
    dispatchedQuantity: Int
    receivedQuantity: Int
    notes: String
  }

  type InventoryAudit {
    id: ID!
    auditNumber: String!
    warehouseId: String!
    warehouse: Warehouse!
    locationId: String
    location: WarehouseLocation
    auditDate: String!
    conductedBy: String!
    supervisedBy: String
    status: String!
    notes: String
    createdAt: String!
    updatedAt: String!
    items: [InventoryAuditItem!]!
  }

  type InventoryAuditItem {
    id: ID!
    inventoryAuditId: String!
    inventoryAudit: InventoryAudit!
    productId: String!
    product: Product
    expectedQuantity: Int!
    actualQuantity: Int!
    variance: Int!
    varianceReason: String
    resolved: Boolean!
    resolution: String
    resolvedBy: String
    resolvedAt: String
  }

  type DailySales {
    date: String!
    revenue: Float!
    profit: Float!
    count: Int!
  }

  type CategoryRevenue {
    category: String!
    totalSales: Int!
    totalRevenue: Float!
  }

  type TraditionalItem {
    id: ID!
    name: String!
    amharicName: String
    region: String!
    material: String
    category: String!
    description: String
    culturalNote: String
    imageUrl: String
    costPrice: Float!
    sellingPrice: Float!
    stock: Int!
    minStockLevel: Int!
    status: String!
    profitMargin: Float
    createdAt: String!
    updatedAt: String!
  }

  type SaleItemInput {
    productId: String!
    quantity: Int!
    price: Float!
  }

  input CreateSaleItemInput {
    productId: String!
    quantity: Int!
    price: Float!
  }

  input ReturnItemInput {
    saleItemId: String!
    quantity: Int!
  }

  input ProcurementRequestItemInput {
    productId: String!
    quantity: Int!
    estimatedUnitCost: Float!
    notes: String
  }

  input ReceiveGoodsItemInput {
    purchaseOrderItemId: String!
    quantityReceived: Int!
    batchNumber: String
    manufacturingDate: String
    expiryDate: String
    actualUnitCost: Float
    condition: String
    notes: String
  }

  # CSV Import types
  type ImportValidation {
    isValid: Boolean!
    rowNumber: Int!
    data: JSON
    errors: [String!]!
    warnings: [String!]!
    action: String!
  }

  type ImportPreview {
    totalRows: Int!
    validRows: Int!
    warningRows: Int!
    errorRows: Int!
    createCount: Int!
    updateCount: Int!
    skipCount: Int!
    validations: [ImportValidation!]!
  }

  type ImportResult {
    success: Boolean!
    summary: ImportSummary!
    errors: [ImportError!]!
    importId: String
  }

  type ImportSummary {
    totalProcessed: Int!
    created: Int!
    updated: Int!
    skipped: Int!
    failed: Int!
    stockChanges: Int!
  }

  type ImportError {
    rowNumber: Int!
    sku: String!
    error: String!
  }

  type ImportHistory {
    id: ID!
    fileName: String!
    importType: String!
    userId: String!
    userName: String!
    totalRows: Int!
    created: Int!
    updated: Int!
    failed: Int!
    stockChanges: Int!
    status: String!
    errorMessage: String
    createdAt: String!
  }

  type Query {
    me: User
    users: [User!]!

    products(search: String, categoryId: String, status: String): [Product!]!
    product(id: ID!): Product

    categories: [Category!]!

    suppliers: [Supplier!]!
    supplier(id: ID!): Supplier

    customers: [Customer!]!
    customer(id: ID!): Customer

    sales(startDate: String, endDate: String, customerId: String): [Sale!]!
    sale(id: ID!): Sale

    transactions(productId: String): [Transaction!]!

    activityLogs: [ActivityLog!]!

    dashboardStats: DashboardStats!

    lowStockProducts: [Product!]!

    monthlySalesByDay(year: Int, month: Int, startDate: String, endDate: String): [DailySales!]!
    salesByCategory: [CategoryRevenue!]!

    getImportHistory: [ImportHistory]!

    traditionalItems(search: String, category: String, region: String): [TraditionalItem!]!
    traditionalItem(id: ID!): TraditionalItem

    purchaseOrders: [PurchaseOrder!]!
    purchaseOrder(id: ID!): PurchaseOrder

    branches: [Branch!]!
    branch(id: ID!): Branch

    organizations: [Organization!]!
    organization(id: ID!): Organization
    organizationUnits: [OrganizationUnit!]!
    organizationUnit(id: ID!): OrganizationUnit
    departments: [Department!]!
    department(id: ID!): Department
    warehouses: [Warehouse!]!
    warehouse(id: ID!): Warehouse
    warehouseLocations: [WarehouseLocation!]!
    warehouseLocation(id: ID!): WarehouseLocation

    permissions: [Permission!]!
    permission(id: ID!): Permission
    roles: [Role!]!
    role(id: ID!): Role
    myRoles: [Role!]!
    myPermissions: [Permission!]!
    myOrganizations: [UserOrganization!]!

    # Enhanced Inventory queries (Phase 3)
    itemBatches(productId: String, warehouseId: String, status: String): [ItemBatch!]!
    itemBatch(id: ID!): ItemBatch
    serialNumbers(productId: String, batchId: String, status: String): [SerialNumber!]!
    serialNumber(id: ID!): SerialNumber
    stockTransfers(status: String, fromWarehouseId: String, toWarehouseId: String): [StockTransfer!]!
    stockTransfer(id: ID!): StockTransfer
    inventoryAudits(warehouseId: String, status: String): [InventoryAudit!]!
    inventoryAudit(id: ID!): InventoryAudit
    expiringBatches(days: Int): [ItemBatch!]!
    lowStockBatches(threshold: Int): [ItemBatch!]!

    # Procurement queries (Phase 4 & 5)
    procurementRequests(status: String, departmentId: String, requesterId: String): [ProcurementRequest!]!
    procurementRequest(id: ID!): ProcurementRequest
    myProcurementRequests: [ProcurementRequest!]!
    
    tenders(status: String, procurementRefId: String): [Tender!]!
    tender(id: ID!): Tender
    openTenders: [Tender!]!
    
    bids(tenderId: String, supplierId: String, status: String): [Bid!]!
    bid(id: ID!): Bid
    myBids: [Bid!]!
    
    contracts(status: String, supplierId: String): [Contract!]!
    contract(id: ID!): Contract
    activeContracts: [Contract!]!
    
    goodsReceipts(status: String, warehouseId: String, supplierId: String): [GoodsReceipt!]!
    goodsReceipt(id: ID!): GoodsReceipt

    # Asset Management queries (Phase 7)
    assets(status: String, departmentId: String, warehouseId: String, category: String): [Asset!]!
    asset(id: ID!): Asset
    myAssets: [Asset!]!
    assetAssignments(assetId: String, assignedTo: String, status: String): [AssetAssignment!]!
    assetAssignment(id: ID!): AssetAssignment
    assetMaintenance(assetId: String, status: String): [AssetMaintenance!]!
    assetMaintenanceRecord(id: ID!): AssetMaintenance
    assetDisposals(status: String): [AssetDisposal!]!
    assetDisposal(id: ID!): AssetDisposal
    expiringWarranties(days: Int): [Asset!]!
    assetsDueForMaintenance: [AssetMaintenance!]!

    # Workflow & Approval queries (Phase 7)
    workflows(entityType: String): [Workflow!]!
    workflow(id: ID!): Workflow
    workflowSteps(workflowId: String!): [WorkflowStep!]!
    approvals(entityType: String, entityId: String, status: String): [Approval!]!
    myApprovals: [Approval!]!

    # Audit & Risk queries (Phase 9)
    activityLog(id: ID!): ActivityLog
    entityHistory(entityType: String!, entityId: String!): [ActivityLog!]!
    auditExport(entityType: String, entityId: String, startDate: String, endDate: String): String

    riskIndicators(entityType: String, entityId: String, riskType: String, severity: String, status: String): [RiskIndicator!]!
    riskIndicator(id: ID!): RiskIndicator
    openRisks(severity: String): [RiskIndicator!]!
    highRiskEntities(entityType: String!): [String!]!
    riskSummary: String

    # Reporting & Analytics queries (Phase 10)
    inventoryReport(warehouseId: String, categoryId: String): InventoryReport!
    procurementReport(departmentId: String, startDate: String, endDate: String): ProcurementReport!
    assetReport(departmentId: String, categoryId: String): AssetReport!
    analytics: Analytics!
    exportReport(reportType: String!, filters: String, format: String): String

    # Document queries (Phase 8)
    documents(entityType: String, entityId: String, category: String): [Document!]!
    document(id: ID!): Document
    myDocuments: [Document!]!

    # Notification queries (Phase 11)
    notifications(status: String, type: String, priority: String): [Notification!]!
    notification(id: ID!): Notification
    unreadNotifications: [Notification!]!
    notificationPreference: NotificationPreference!

    # Document mutations (Phase 8)
    deleteDocument(id: ID!): Boolean!
    updateDocument(id: ID!, description: String, category: String, expiryDate: String, accessLevel: String): Document!

    # Notification mutations (Phase 11)
    markNotificationRead(id: ID!): Notification!
    markAllNotificationsRead: Boolean!
    updateNotificationPreference(emailEnabled: Boolean, smsEnabled: Boolean, pushEnabled: Boolean, inventoryAlerts: Boolean, procurementAlerts: Boolean, assetAlerts: Boolean, deadlineAlerts: Boolean, riskAlerts: Boolean): NotificationPreference!
    createNotification(userId: String!, type: String!, title: String!, message: String!, entityType: String, entityId: String, priority: String, actionUrl: String): Notification!
  }

  type Mutation {
    register(name: String!, email: String!, password: String!, role: String): AuthPayload!
    login(email: String!, password: String!): AuthPayload!

    createCategory(name: String!, description: String): Category!
    updateCategory(id: ID!, name: String, description: String): Category!
    deleteCategory(id: ID!): Boolean!

    createSupplier(name: String!, contactName: String, email: String, phone: String, address: String): Supplier!
    updateSupplier(id: ID!, name: String, contactName: String, email: String, phone: String, address: String): Supplier!
    deleteSupplier(id: ID!): Boolean!

    createCustomer(name: String!, email: String, phone: String): Customer!
    updateCustomer(id: ID!, name: String, email: String, phone: String): Customer!
    deleteCustomer(id: ID!): Boolean!

    createProduct(
      name: String!
      sku: String!
      barcode: String
      description: String
      imageUrl: String
      costPrice: Float!
      sellingPrice: Float!
      categoryId: String!
      supplierId: String
      stock: Int
      minStockLevel: Int
      status: String
    ): Product!

    updateProduct(
      id: ID!
      name: String
      sku: String
      barcode: String
      description: String
      imageUrl: String
      costPrice: Float
      sellingPrice: Float
      categoryId: String
      supplierId: String
      minStockLevel: Int
      status: String
    ): Product!

    deleteProduct(id: ID!): Boolean!

    adjustStock(productId: ID!, quantity: Int!, type: String!, notes: String): Transaction!

    createSale(
      customerId: String
      items: [CreateSaleItemInput!]!
      paymentMethod: String
      paymentAmount: Float
      branchId: String
      notes: String
    ): Sale!

    returnSale(saleId: ID!, reason: String, items: [ReturnItemInput!]): SaleReturn!

    createUser(name: String!, email: String!, password: String!, role: String!): User!
    updateUserRole(id: ID!, role: String!): User!
    deleteUser(id: ID!): Boolean!
    updateProfile(name: String, currentPassword: String!, newPassword: String): User!

    createPurchaseOrder(supplierId: String, notes: String, items: [POItemInput!]!): PurchaseOrder!
    updatePurchaseOrderStatus(id: ID!, status: String!): PurchaseOrder!
    receivePurchaseOrder(id: ID!): PurchaseOrder!
    deletePurchaseOrder(id: ID!): Boolean!

    createBranch(name: String!, address: String, phone: String, manager: String): Branch!
    updateBranch(id: ID!, name: String, address: String, phone: String, manager: String, isActive: Boolean): Branch!
    deleteBranch(id: ID!): Boolean!

    createOrganization(name: String!, code: String!, type: String!, description: String, address: String, phone: String, email: String, website: String): Organization!
    updateOrganization(id: ID!, name: String, code: String, type: String, description: String, address: String, phone: String, email: String, website: String, isActive: Boolean): Organization!
    deleteOrganization(id: ID!): Boolean!

    createOrganizationUnit(name: String!, code: String!, type: String!, organizationId: String!, parentId: String, address: String, phone: String, email: String, headOfUnit: String): OrganizationUnit!
    updateOrganizationUnit(id: ID!, name: String, code: String, type: String, parentId: String, address: String, phone: String, email: String, headOfUnit: String, isActive: Boolean): OrganizationUnit!
    deleteOrganizationUnit(id: ID!): Boolean!

    createDepartment(name: String!, code: String!, organizationUnitId: String, headOfDepartment: String, budgetCode: String, description: String): Department!
    updateDepartment(id: ID!, name: String, code: String, organizationUnitId: String, headOfDepartment: String, budgetCode: String, description: String, isActive: Boolean): Department!
    deleteDepartment(id: ID!): Boolean!

    createWarehouse(name: String!, code: String!, organizationUnitId: String, type: String!, address: String, phone: String, manager: String, capacity: Float): Warehouse!
    updateWarehouse(id: ID!, name: String, code: String, organizationUnitId: String, type: String, address: String, phone: String, manager: String, capacity: Float, isActive: Boolean): Warehouse!
    deleteWarehouse(id: ID!): Boolean!

    createWarehouseLocation(name: String!, code: String!, warehouseId: String!, type: String!, capacity: Float): WarehouseLocation!
    updateWarehouseLocation(id: ID!, name: String, code: String, type: String, capacity: Float, isActive: Boolean): WarehouseLocation!
    deleteWarehouseLocation(id: ID!): Boolean!

    # RBAC mutations
    createPermission(name: String!, description: String, module: String!, action: String!, resource: String): Permission!
    updatePermission(id: ID!, name: String, description: String, module: String, action: String, resource: String): Permission!
    deletePermission(id: ID!): Boolean!

    createRole(name: String!, description: String, level: Int, isSystem: Boolean): Role!
    updateRole(id: ID!, name: String, description: String, level: Int, isSystem: Boolean): Role!
    deleteRole(id: ID!): Boolean!

    assignPermissionToRole(roleId: String!, permissionId: String!): RolePermission!
    removePermissionFromRole(roleId: String!, permissionId: String!): Boolean!

    assignRoleToUser(userId: String!, roleId: String!): UserRole!
    removeRoleFromUser(userId: String!, roleId: String!): Boolean!

    assignUserToOrganization(userId: String!, organizationId: String, organizationUnitId: String, departmentId: String, warehouseId: String, isPrimary: Boolean): UserOrganization!
    updateUserOrganization(id: ID!, organizationId: String, organizationUnitId: String, departmentId: String, warehouseId: String, isPrimary: Boolean, isActive: Boolean): UserOrganization!
    removeUserFromOrganization(id: ID!): Boolean!

    # Enhanced Inventory mutations (Phase 3)
    createItemBatch(productId: String!, batchNumber: String!, manufacturingDate: String, expiryDate: String, initialQuantity: Int!, unitCost: Float!, supplierId: String, warehouseId: String, locationId: String): ItemBatch!
    updateItemBatch(id: ID!, currentQuantity: Int, status: String, locationId: String): ItemBatch!
    deleteItemBatch(id: ID!): Boolean!

    createSerialNumber(productId: String!, serialNumber: String!, batchId: String, warehouseId: String, locationId: String): SerialNumber!
    updateSerialNumber(id: ID!, status: String, assignedTo: String, locationId: String): SerialNumber!
    deleteSerialNumber(id: ID!): Boolean!
    assignSerialNumber(id: ID!, assignedTo: String!): SerialNumber!

    createStockTransfer(fromWarehouseId: String!, toWarehouseId: String!, notes: String): StockTransfer!
    addStockTransferItem(stockTransferId: String!, productId: String!, batchId: String, requestedQuantity: Int!): StockTransferItem!
    updateStockTransferItem(id: ID!, approvedQuantity: Int, dispatchedQuantity: Int, receivedQuantity: Int): StockTransferItem!
    approveStockTransfer(id: ID!): StockTransfer!
    dispatchStockTransfer(id: ID!): StockTransfer!
    receiveStockTransfer(id: ID!): StockTransfer!
    cancelStockTransfer(id: ID!): Boolean!

    createInventoryAudit(warehouseId: String!, locationId: String, supervisedBy: String, notes: String): InventoryAudit!
    addInventoryAuditItem(inventoryAuditId: String!, productId: String!, expectedQuantity: Int!, actualQuantity: Int!, varianceReason: String): InventoryAuditItem!
    resolveInventoryAuditItem(id: ID!, resolution: String!): InventoryAuditItem!
    completeInventoryAudit(id: ID!): InventoryAudit!
    cancelInventoryAudit(id: ID!): Boolean!

    # Procurement mutations (Phase 4 & 5)
    createProcurementRequest(departmentId: String, organizationId: String, items: [ProcurementRequestItemInput!], justification: String, urgency: String, requiredBy: String): ProcurementRequest!
    updateProcurementRequest(id: ID!, requiredDate: String, priority: String, justification: String, notes: String): ProcurementRequest!
    addProcurementRequestItem(procurementRequestId: String!, description: String!, quantity: Int!, unitOfMeasure: String!, estimatedUnitCost: Float!, technicalSpecs: String, category: String, notes: String): ProcurementRequestItem!
    updateProcurementRequestItem(id: ID!, quantity: Int, estimatedUnitCost: Float, technicalSpecs: String, notes: String): ProcurementRequestItem!
    deleteProcurementRequestItem(id: ID!): Boolean!
    submitProcurementRequest(id: ID!): ProcurementRequest!
    approveProcurementRequest(id: ID!, comments: String): ProcurementRequest!
    rejectProcurementRequest(id: ID!, comments: String): ProcurementRequest!
    cancelProcurementRequest(id: ID!): Boolean!

    receiveGoods(purchaseOrderId: String!, items: [ReceiveGoodsItemInput!], notes: String, warehouseId: String): GoodsReceipt!

    # CSV Import mutations
    previewProductImport(csvContent: String!): ImportPreview!
    importProducts(csvContent: String!): ImportResult!

    createTender(procurementRefId: String, projectName: String!, procurementCategory: String!, procurementMethod: String!, marketType: String!, submissionDeadline: String!, bidValidityPeriod: Int!, bidSecurity: Float, currency: String, contractType: String!, description: String): Tender!
    updateTender(id: ID!, submissionDeadline: String, bidSecurity: Float, description: String, status: String): Tender!
    addTenderItem(tenderId: String!, description: String!, quantity: Int!, unit: String!, specifications: String): TenderItem!
    updateTenderItem(id: ID!, quantity: Int, specifications: String): TenderItem!
    deleteTenderItem(id: ID!): Boolean!
    addTechnicalRequirement(tenderId: String!, tenderItemId: String, attribute: String!, requirement: String!, type: String!, category: String!, weight: Float): TechnicalRequirement!
    updateTechnicalRequirement(id: ID!, requirement: String, weight: Float): TechnicalRequirement!
    deleteTechnicalRequirement(id: ID!): Boolean!
    publishTender(id: ID!): Tender!
    closeTender(id: ID!): Tender!
    cancelTender(id: ID!): Boolean!

    createBid(tenderId: String!, supplierId: String!, bidSecurity: Float, totalPrice: Float!, deliveryPeriod: Int!, validityPeriod: Int!, notes: String): Bid!
    addBidItem(bidId: String!, tenderItemId: String, description: String!, quantity: Int!, unitPrice: Float!, specifications: String): BidItem!
    updateBidItem(id: ID!, unitPrice: Float, specifications: String): BidItem!
    deleteBidItem(id: ID!): Boolean!
    submitBid(id: ID!): Bid!
    withdrawBid(id: ID!): Boolean!
    qualifyBid(id: ID!): Bid!
    disqualifyBid(id: ID!, reason: String): Bid!

    evaluateTechnicalRequirement(bidId: String!, technicalRequirementId: String!, supplierResponse: String, compliance: Boolean!, score: Float, comments: String): TechnicalEvaluation!
    evaluateFinancial(bidId: String!, deliveryCost: Float, taxes: Float, priceScore: Float, comments: String): FinancialEvaluation!
    selectBid(id: ID!): Bid!

    createContract(tenderId: String, bidId: String, supplierId: String!, startDate: String!, endDate: String!, contractValue: Float!, currency: String, paymentTerms: String, deliveryTerms: String, description: String): Contract!
    updateContract(id: ID!, endDate: String, paymentTerms: String, deliveryTerms: String, description: String, status: String): Contract!
    addContractItem(contractId: String!, description: String!, quantity: Int!, unit: String!, unitPrice: Float!): ContractItem!
    updateContractItem(id: ID!, quantity: Int, unitPrice: Float): ContractItem!
    deleteContractItem(id: ID!): Boolean!
    activateContract(id: ID!): Contract!
    terminateContract(id: ID!, reason: String): Contract!

    createGoodsReceipt(purchaseOrderId: String, contractId: String, supplierId: String!, warehouseId: String!, deliveryNote: String, notes: String): GoodsReceipt!
    addGoodsReceiptItem(goodsReceiptId: String!, productId: String!, orderedQuantity: Int!, receivedQuantity: Int!, acceptedQuantity: Int!, rejectedQuantity: Int, damagedQuantity: Int, batchNumber: String, serialNumbers: String, unitCost: Float): GoodsReceiptItem!
    updateGoodsReceiptItem(id: ID!, acceptedQuantity: Int, rejectedQuantity: Int, damagedQuantity: Int, batchNumber: String, serialNumbers: String): GoodsReceiptItem!
    inspectGoodsReceipt(id: ID!, inspectedBy: String!, inspectionDate: String): GoodsReceipt!
    acceptGoodsReceipt(id: ID!): GoodsReceipt!
    rejectGoodsReceipt(id: ID!, reason: String): GoodsReceipt!

    # Asset Management mutations (Phase 7)
    createAsset(assetNumber: String!, serialNumber: String!, name: String!, description: String, category: String!, model: String, manufacturer: String, purchaseDate: String, purchaseCost: Float!, currentValue: Float, location: String, departmentId: String, warehouseId: String, condition: String, warrantyExpiry: String): Asset!
    updateAsset(id: ID!, name: String, description: String, currentValue: Float, location: String, departmentId: String, warehouseId: String, condition: String, status: String): Asset!
    deleteAsset(id: ID!): Boolean!
    assignAsset(assetId: String!, assignedTo: String!, location: String, departmentId: String, returnDate: String, notes: String): AssetAssignment!
    returnAsset(id: ID!, conditionAfter: String, notes: String): AssetAssignment!
    transferAsset(id: ID!, newLocation: String, newDepartmentId: String, notes: String): AssetAssignment!

    createAssetMaintenance(assetId: String!, maintenanceType: String!, description: String!, scheduledDate: String, technician: String, serviceProvider: String, cost: Float, partsUsed: String, downtime: Float, nextMaintenanceDate: String, notes: String): AssetMaintenance!
    updateAssetMaintenance(id: ID!, completedDate: String, cost: Float, partsUsed: String, downtime: Float, nextMaintenanceDate: String, status: String, notes: String): AssetMaintenance!
    completeAssetMaintenance(id: ID!, notes: String): AssetMaintenance!
    cancelAssetMaintenance(id: ID!): Boolean!

    createAssetDisposal(assetId: String!, disposalType: String!, reason: String, disposalValue: Float, recipient: String, notes: String): AssetDisposal!
    approveAssetDisposal(id: ID!): AssetDisposal!
    completeAssetDisposal(id: ID!): AssetDisposal!
    cancelAssetDisposal(id: ID!): Boolean!

    # Workflow & Approval mutations (Phase 7)
    createWorkflow(name: String!, description: String, entityType: String!): Workflow!
    updateWorkflow(id: ID!, name: String, description: String, isActive: Boolean): Workflow!
    deleteWorkflow(id: ID!): Boolean!
    addWorkflowStep(workflowId: String!, stepNumber: Int!, name: String!, description: String, role: String!, required: Boolean, autoApprove: Boolean): WorkflowStep!
    updateWorkflowStep(id: ID!, name: String, description: String, role: String, required: Boolean, autoApprove: Boolean): WorkflowStep!
    deleteWorkflowStep(id: ID!): Boolean!
    createApproval(entityType: String!, entityId: String!, workflowStepId: String, approverId: String!): Approval!
    approveRequest(approvalId: ID!, comments: String): Approval!
    rejectRequest(approvalId: ID!, comments: String): Approval!
    returnRequest(approvalId: ID!, comments: String): Approval!

    # Audit & Risk mutations (Phase 9)
    createActivityLog(action: String!, entityType: String, entityId: String, details: String, oldValue: String, newValue: String, changes: String): ActivityLog!
    resolveRiskIndicator(id: ID!, resolvedBy: String!, resolution: String): RiskIndicator!
    ignoreRiskIndicator(id: ID!, reason: String): RiskIndicator!
    createRiskIndicator(entityType: String!, entityId: String!, riskType: String!, severity: String!, description: String, confidence: Float, metadata: String): RiskIndicator!
    detectRisks(entityType: String!): [RiskIndicator!]!

    # Document mutations (Phase 8)
    deleteDocument(id: ID!): Boolean!
    updateDocument(id: ID!, description: String, category: String, expiryDate: String, accessLevel: String): Document!

    # Notification mutations (Phase 11)
    markNotificationRead(id: ID!): Notification!
    markAllNotificationsRead: Boolean!
    updateNotificationPreference(emailEnabled: Boolean, smsEnabled: Boolean, pushEnabled: Boolean, inventoryAlerts: Boolean, procurementAlerts: Boolean, assetAlerts: Boolean, deadlineAlerts: Boolean, riskAlerts: Boolean): NotificationPreference!
    createNotification(userId: String!, type: String!, title: String!, message: String!, entityType: String, entityId: String, priority: String, actionUrl: String): Notification!

    createTraditionalItem(
      name: String!
      amharicName: String
      region: String!
      material: String
      category: String!
      description: String
      culturalNote: String
      imageUrl: String
      costPrice: Float!
      sellingPrice: Float!
      stock: Int
      minStockLevel: Int
      status: String
    ): TraditionalItem!

    updateTraditionalItem(
      id: ID!
      name: String
      amharicName: String
      region: String
      material: String
      category: String
      description: String
      culturalNote: String
      imageUrl: String
      costPrice: Float
      sellingPrice: Float
      minStockLevel: Int
      status: String
    ): TraditionalItem!

    deleteTraditionalItem(id: ID!): Boolean!
    adjustTraditionalStock(id: ID!, quantity: Int!, type: String!, notes: String): TraditionalItem!
  }
`;
