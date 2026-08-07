export const typeDefs = `#graphql
  type User {
    id: ID!
    name: String!
    email: String!
    role: String!
    createdAt: String!
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
    createdAt: String!
    updatedAt: String!
    profitMargin: Float
    saleItems: [SaleItem!]!
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
    customerId: String
    customer: Customer
    userId: String!
    user: User
    items: [SaleItem!]!
    returns: [SaleReturn!]!
    createdAt: String!
  }

  type ActivityLog {
    id: ID!
    userId: String!
    user: User
    action: String!
    details: String
    ipAddress: String
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
  }

  type PurchaseOrder {
    id: ID!
    poNumber: String!
    supplierId: String
    supplier: Supplier
    status: String!
    notes: String
    userId: String!
    user: User
    items: [PurchaseOrderItem!]!
    totalCost: Float!
    createdAt: String!
    updatedAt: String!
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

  type DailySales {
    date: String!
    revenue: Float!
    profit: Float!
    count: Int!
  }

  type CategoryRevenue {
    name: String!
    revenue: Float!
    count: Int!
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

    traditionalItems(search: String, category: String, region: String): [TraditionalItem!]!
    traditionalItem(id: ID!): TraditionalItem

    purchaseOrders: [PurchaseOrder!]!
    purchaseOrder(id: ID!): PurchaseOrder
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
    ): Sale!

    returnSale(saleId: ID!, reason: String): SaleReturn!

    createUser(name: String!, email: String!, password: String!, role: String!): User!
    updateUserRole(id: ID!, role: String!): User!
    deleteUser(id: ID!): Boolean!
    updateProfile(name: String, currentPassword: String!, newPassword: String): User!

    createPurchaseOrder(supplierId: String, notes: String, items: [POItemInput!]!): PurchaseOrder!
    updatePurchaseOrderStatus(id: ID!, status: String!): PurchaseOrder!
    receivePurchaseOrder(id: ID!): PurchaseOrder!
    deletePurchaseOrder(id: ID!): Boolean!

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
