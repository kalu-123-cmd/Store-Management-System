import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { sendSaleReceipt, sendLowStockAlert } from '../email';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_jwt_key_12345';

function requireAuth(user: any) {
  if (!user) throw new Error('Not authenticated');
}

function requireRole(user: any, ...roles: string[]) {
  requireAuth(user);
  if (!roles.includes(user.role)) throw new Error('Not authorized');
}

function requirePermission(user: any, permission: string) {
  requireAuth(user);
  // TODO: Implement proper permission checking once we have the permission system
  // For now, just check if user is ADMIN or has the required role
  if (user.role !== 'ADMIN') {
    throw new Error('Not authorized');
  }
}

// ── Helper: map TraditionalItem DB record to GraphQL type ──────────────────
function mapItem(item: any) {
  return {
    ...item,
    profitMargin: item.sellingPrice > 0
      ? ((item.sellingPrice - item.costPrice) / item.sellingPrice) * 100
      : 0,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export const resolvers = {
  Query: {
    me: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      const userData = await prisma.user.findUnique({ 
        where: { id: user.id },
        include: { organization: true, userRoles: { include: { role: true } }, userOrganizations: true }
      });
      return {
        ...userData,
        createdAt: userData.createdAt.toISOString(),
        userRoles: userData.userRoles.map((ur: any) => ({
          ...ur,
          assignedAt: ur.assignedAt.toISOString(),
        })),
        userOrganizations: userData.userOrganizations.map((uo: any) => ({
          ...uo,
          assignedAt: uo.assignedAt.toISOString(),
        })),
      };
    },
    users: async (_: any, __: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN');
      return prisma.user.findMany();
    },

    products: async (_: any, { search, categoryId, status }: any, { prisma, user }: any) => {
      requireAuth(user);
      const where: any = {};
      if (search) where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ];
      if (categoryId) where.categoryId = categoryId;
      if (status) where.status = status;
      const products = await prisma.product.findMany({
        where,
        include: { category: true, supplier: true, saleItems: true },
      });
      return products.map((p: any) => ({
        ...p,
        profitMargin: ((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }));
    },

    product: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      const p = await prisma.product.findUnique({
        where: { id },
        include: { category: true, supplier: true, saleItems: true },
      });
      if (!p) throw new Error('Product not found');
      return {
        ...p,
        profitMargin: ((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };
    },

    categories: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      const cats = await prisma.category.findMany({ include: { _count: { select: { products: true } } } });
      return cats.map((c: any) => ({ ...c, productCount: c._count.products }));
    },

    suppliers: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.supplier.findMany();
    },
    supplier: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.supplier.findUnique({ where: { id } });
    },

    customers: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      const customers = await prisma.customer.findMany({
        include: { sales: { include: { items: true } } },
      });
      return customers.map((c: any) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        totalSpent: c.sales.reduce((sum: number, s: any) => sum + s.totalAmount, 0),
        purchaseCount: c.sales.length,
      }));
    },
    customer: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      const c = await prisma.customer.findUnique({
        where: { id },
        include: {
          sales: {
            include: { items: { include: { product: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      if (!c) throw new Error('Customer not found');
      return {
        ...c,
        createdAt: c.createdAt.toISOString(),
        totalSpent: c.sales.reduce((sum: number, s: any) => sum + s.totalAmount, 0),
        purchaseCount: c.sales.length,
        sales: c.sales.map((s: any) => ({ ...s, createdAt: s.createdAt.toISOString() })),
      };
    },

    sales: async (_: any, { startDate, endDate, customerId }: any, { prisma, user }: any) => {
      requireAuth(user);
      const where: any = {};
      if (startDate) where.createdAt = { gte: new Date(startDate) };
      if (endDate) where.createdAt = { ...(where.createdAt || {}), lte: new Date(endDate) };
      if (customerId) where.customerId = customerId;
      const sales = await prisma.sale.findMany({
        where, orderBy: { createdAt: 'desc' },
        include: { items: { include: { product: true } }, customer: true, user: true, returns: true },
      });
      return sales.map((s: any) => ({ ...s, createdAt: s.createdAt.toISOString() }));
    },

    sale: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      const s = await prisma.sale.findUnique({
        where: { id },
        include: { items: { include: { product: true } }, customer: true, user: true },
      });
      if (!s) throw new Error('Sale not found');
      return { ...s, createdAt: s.createdAt.toISOString() };
    },

    transactions: async (_: any, { productId }: any, { prisma, user }: any) => {
      requireAuth(user);
      const where: any = {};
      if (productId) where.productId = productId;
      const txns = await prisma.transaction.findMany({ where, orderBy: { createdAt: 'desc' }, include: { product: true } });
      return txns.map((t: any) => ({ ...t, createdAt: t.createdAt.toISOString() }));
    },

    activityLogs: async (_: any, { userId, action, entityType, entityId, startDate, endDate }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      const where: any = {};
      if (userId) where.userId = userId;
      if (action) where.action = action;
      if (entityType) where.entityType = entityType;
      if (entityId) where.entityId = entityId;
      if (startDate) where.createdAt = { gte: new Date(startDate) };
      if (endDate) where.createdAt = { lte: new Date(endDate) };
      const logs = await prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: { user: true },
      });
      return logs.map((l: any) => ({ ...l, createdAt: l.createdAt.toISOString() }));
    },

    dashboardStats: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [products, categories, suppliers, customers, todaySalesAgg, monthlySales] = await Promise.all([
        prisma.product.findMany(),
        prisma.category.count(),
        prisma.supplier.count(),
        prisma.customer.count(),
        prisma.sale.aggregate({ _sum: { totalAmount: true }, where: { createdAt: { gte: startOfDay } } }),
        prisma.sale.findMany({ where: { createdAt: { gte: startOfMonth } }, include: { items: { include: { product: true } } } }),
      ]);

      const inventoryValue = products.reduce((sum: number, p: any) => sum + p.costPrice * p.stock, 0);
      const monthlyRevenue = monthlySales.reduce((sum: number, s: any) => sum + s.totalAmount, 0);
      const monthlyProfit = monthlySales.reduce((sum: number, s: any) => {
        return sum + s.items.reduce((isum: number, item: any) => isum + (item.price - item.product.costPrice) * item.quantity, 0);
      }, 0);
      const lowStockCount = products.filter((p: any) => p.stock > 0 && p.stock <= p.minStockLevel).length;
      const outOfStockCount = products.filter((p: any) => p.stock === 0).length;

      return {
        totalProducts: products.length,
        totalCategories: categories,
        totalSuppliers: suppliers,
        totalCustomers: customers,
        inventoryValue,
        todaySales: todaySalesAgg._sum.totalAmount || 0,
        monthlyRevenue,
        monthlyProfit,
        lowStockCount,
        outOfStockCount,
      };
    },

    lowStockProducts: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      const all = await prisma.product.findMany({
        include: { category: true, supplier: true, saleItems: true },
      });
      return all
        .filter((p: any) => p.stock <= p.minStockLevel)
        .map((p: any) => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          profitMargin: ((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100,
        }));
    },

    monthlySalesByDay: async (_: any, { year, month, startDate, endDate }: any, { prisma, user }: any) => {
      requireAuth(user);
      let start: Date;
      let end: Date;

      if (startDate || endDate) {
        // Use explicit date range when provided (from Reports filter)
        const now = new Date();
        start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
        end   = endDate   ? new Date(endDate + 'T23:59:59') : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      } else {
        // Default: current calendar month
        const now = new Date();
        const y = year ?? now.getFullYear();
        const m = month ?? now.getMonth(); // 0-indexed
        start = new Date(y, m, 1);
        end   = new Date(y, m + 1, 0, 23, 59, 59);
      }

      const sales = await prisma.sale.findMany({
        where: { createdAt: { gte: start, lte: end } },
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: 'asc' },
      });

      const byDay: Record<string, { revenue: number; profit: number; count: number }> = {};
      for (const s of sales) {
        const dateKey = s.createdAt.toISOString().slice(0, 10);
        if (!byDay[dateKey]) byDay[dateKey] = { revenue: 0, profit: 0, count: 0 };
        byDay[dateKey].revenue += s.totalAmount;
        byDay[dateKey].count += 1;
        byDay[dateKey].profit += s.items.reduce(
          (sum: number, item: any) => sum + (item.price - item.product.costPrice) * item.quantity,
          0
        );
      }

      return Object.entries(byDay).map(([date, v]) => ({ date, ...v }));
    },

    salesByCategory: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      const saleItems = await prisma.saleItem.findMany({
        include: { product: { include: { category: true } } },
      });

      const byCategory: Record<string, { name: string; revenue: number; count: number }> = {};
      for (const item of saleItems) {
        const catName = item.product?.category?.name ?? 'Uncategorized';
        if (!byCategory[catName]) byCategory[catName] = { name: catName, revenue: 0, count: 0 };
        byCategory[catName].revenue += item.price * item.quantity;
        byCategory[catName].count += item.quantity;
      }

      return Object.values(byCategory).sort((a, b) => b.revenue - a.revenue);
    },

    // ── Branch queries ──────────────────────────────────────────────────────

    branches: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      const branches = await prisma.branch.findMany({ orderBy: { name: 'asc' } });
      return branches.map((b: any) => ({ ...b, createdAt: b.createdAt.toISOString() }));
    },

    branch: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      const b = await prisma.branch.findUnique({ where: { id } });
      if (!b) throw new Error('Branch not found');
      return { ...b, createdAt: b.createdAt.toISOString() };
    },

    // ── Organization queries ─────────────────────────────────────────────────

    organizations: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.organization.findMany({
        include: { units: true, users: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    organization: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.organization.findUnique({
        where: { id },
        include: { units: true, users: true },
      });
    },
    organizationUnits: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.organizationUnit.findMany({
        include: { organization: true, parent: true, children: true, departments: true, warehouses: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    organizationUnit: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.organizationUnit.findUnique({
        where: { id },
        include: { organization: true, parent: true, children: true, departments: true, warehouses: true },
      });
    },
    departments: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.department.findMany({
        include: { organizationUnit: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    department: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.department.findUnique({
        where: { id },
        include: { organizationUnit: true },
      });
    },
    warehouses: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.warehouse.findMany({
        include: { organizationUnit: true, locations: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    warehouse: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.warehouse.findUnique({
        where: { id },
        include: { organizationUnit: true, locations: true },
      });
    },
    warehouseLocations: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.warehouseLocation.findMany({
        include: { warehouse: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    warehouseLocation: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.warehouseLocation.findUnique({
        where: { id },
        include: { warehouse: true },
      });
    },

    // ── RBAC queries ─────────────────────────────────────────────────────────────

    permissions: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.permission.findMany({
        orderBy: { module: 'asc', action: 'asc' },
      });
    },
    permission: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.permission.findUnique({ where: { id } });
    },
    roles: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.role.findMany({
        include: { permissions: true },
        orderBy: { level: 'desc' },
      });
    },
    role: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.role.findUnique({
        where: { id },
        include: { permissions: true },
      });
    },
    myRoles: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      const userRoles = await prisma.userRole.findMany({
        where: { userId: user.id },
        include: { role: { include: { permissions: true } } },
        orderBy: { assignedAt: 'desc' },
      });
      return userRoles.map((ur: any) => ({
        ...ur.role,
        assignedAt: ur.assignedAt.toISOString(),
      }));
    },
    myPermissions: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      const userRoles = await prisma.userRole.findMany({
        where: { userId: user.id },
        include: { role: { include: { permissions: true } } },
      });
      const permissions = new Set();
      userRoles.forEach((ur: any) => {
        ur.role.permissions.forEach((p: any) => permissions.add(p.name));
      });
      return Array.from(permissions);
    },
    myOrganizations: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.userOrganization.findMany({
        where: { userId: user.id },
        include: { organization: true, organizationUnit: true, department: true, warehouse: true },
        orderBy: { isPrimary: 'desc', assignedAt: 'desc' },
      });
    },

    // Enhanced Inventory queries (Phase 3)

    itemBatches: async (_: any, { productId, warehouseId, status }: any, { prisma, user }: any) => {
      requireAuth(user);
      const where: any = {};
      if (productId) where.productId = productId;
      if (warehouseId) where.warehouseId = warehouseId;
      if (status) where.status = status;
      return prisma.itemBatch.findMany({
        where,
        include: { product: true, supplier: true, warehouse: true, location: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    itemBatch: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.itemBatch.findUnique({
        where: { id },
        include: { product: true, supplier: true, warehouse: true, location: true, serialNumbers: true },
      });
    },
    serialNumbers: async (_: any, { productId, batchId, status }: any, { prisma, user }: any) => {
      requireAuth(user);
      const where: any = {};
      if (productId) where.productId = productId;
      if (batchId) where.batchId = batchId;
      if (status) where.status = status;
      return prisma.serialNumber.findMany({
        where,
        include: { product: true, batch: true, warehouse: true, location: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    serialNumber: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.serialNumber.findUnique({
        where: { id },
        include: { product: true, batch: true, warehouse: true, location: true },
      });
    },
    stockTransfers: async (_: any, { status, fromWarehouseId, toWarehouseId }: any, { prisma, user }: any) => {
      requireAuth(user);
      const where: any = {};
      if (status) where.status = status;
      if (fromWarehouseId) where.fromWarehouseId = fromWarehouseId;
      if (toWarehouseId) where.toWarehouseId = toWarehouseId;
      return prisma.stockTransfer.findMany({
        where,
        include: { fromWarehouse: true, toWarehouse: true, items: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    stockTransfer: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.stockTransfer.findUnique({
        where: { id },
        include: { fromWarehouse: true, toWarehouse: true, items: { include: { product: true, batch: true } } },
      });
    },
    inventoryAudits: async (_: any, { warehouseId, status }: any, { prisma, user }: any) => {
      requireAuth(user);
      const where: any = {};
      if (warehouseId) where.warehouseId = warehouseId;
      if (status) where.status = status;
      return prisma.inventoryAudit.findMany({
        where,
        include: { warehouse: true, location: true, items: { include: { product: true } } },
        orderBy: { createdAt: 'desc' },
      });
    },
    inventoryAudit: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.inventoryAudit.findUnique({
        where: { id },
        include: { warehouse: true, location: true, items: { include: { product: true } } },
      });
    },
    expiringBatches: async (_: any, { days = 30 }: any, { prisma, user }: any) => {
      requireAuth(user);
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + days);
      return prisma.itemBatch.findMany({
        where: {
          expiryDate: { lte: expiryDate },
          status: 'ACTIVE',
          currentQuantity: { gt: 0 },
        },
        include: { product: true, warehouse: true },
        orderBy: { expiryDate: 'asc' },
      });
    },
    lowStockBatches: async (_: any, { threshold = 10 }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.itemBatch.findMany({
        where: {
          currentQuantity: { lte: threshold },
          status: 'ACTIVE',
        },
        include: { product: true, warehouse: true },
        orderBy: { currentQuantity: 'asc' },
      });
    },

    // Procurement queries (Phase 4 & 5)

    procurementRequests: async (_: any, { status, departmentId, requesterId }: any, { prisma, user }: any) => {
      requireAuth(user);
      const where: any = {};
      if (status) where.status = status;
      if (departmentId) where.departmentId = departmentId;
      if (requesterId) where.requesterId = requesterId;
      return prisma.procurementRequest.findMany({
        where,
        include: { organization: true, department: true, requester: true, items: true, approvals: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    procurementRequest: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.procurementRequest.findUnique({
        where: { id },
        include: { organization: true, department: true, requester: true, items: true, approvals: true, tenders: true },
      });
    },
    myProcurementRequests: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.procurementRequest.findMany({
        where: { requesterId: user.id },
        include: { organization: true, department: true, items: true },
        orderBy: { createdAt: 'desc' },
      });
    },

    tenders: async (_: any, { status, procurementRefId }: any, { prisma, user }: any) => {
      requireAuth(user);
      const where: any = {};
      if (status) where.status = status;
      if (procurementRefId) where.procurementRefId = procurementRefId;
      return prisma.tender.findMany({
        where,
        include: { procurementRef: true, items: true, bids: true, contracts: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    tender: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.tender.findUnique({
        where: { id },
        include: { procurementRef: true, items: { include: { technicalRequirements: true } }, bids: { include: { supplier: true } }, contracts: true, technicalRequirements: true },
      });
    },
    openTenders: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.tender.findMany({
        where: { status: 'OPEN', submissionDeadline: { gte: new Date() } },
        include: { procurementRef: true, items: true },
        orderBy: { submissionDeadline: 'asc' },
      });
    },

    bids: async (_: any, { tenderId, supplierId, status }: any, { prisma, user }: any) => {
      requireAuth(user);
      const where: any = {};
      if (tenderId) where.tenderId = tenderId;
      if (supplierId) where.supplierId = supplierId;
      if (status) where.status = status;
      return prisma.bid.findMany({
        where,
        include: { tender: true, supplier: true, items: true, technicalEvaluations: true, financialEvaluation: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    bid: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.bid.findUnique({
        where: { id },
        include: { tender: true, supplier: true, items: true, technicalEvaluations: { include: { technicalRequirement: true, evaluator: true } }, financialEvaluation: true },
      });
    },
    myBids: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.bid.findMany({
        where: { supplier: { name: { contains: user.name } } },
        include: { tender: true, supplier: true },
        orderBy: { createdAt: 'desc' },
      });
    },

    contracts: async (_: any, { status, supplierId }: any, { prisma, user }: any) => {
      requireAuth(user);
      const where: any = {};
      if (status) where.status = status;
      if (supplierId) where.supplierId = supplierId;
      return prisma.contract.findMany({
        where,
        include: { tender: true, bid: true, supplier: true, items: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    contract: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.contract.findUnique({
        where: { id },
        include: { tender: true, bid: true, supplier: true, items: true, purchaseOrders: true, goodsReceipts: true },
      });
    },
    activeContracts: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.contract.findMany({
        where: { status: 'ACTIVE', endDate: { gte: new Date() } },
        include: { supplier: true, items: true },
        orderBy: { endDate: 'asc' },
      });
    },

    goodsReceipts: async (_: any, { status, warehouseId, supplierId }: any, { prisma, user }: any) => {
      requireAuth(user);
      const where: any = {};
      if (status) where.status = status;
      if (warehouseId) where.warehouseId = warehouseId;
      if (supplierId) where.supplierId = supplierId;
      return prisma.goodsReceipt.findMany({
        where,
        include: { purchaseOrder: true, contract: true, supplier: true, warehouse: true, items: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    goodsReceipt: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.goodsReceipt.findUnique({
        where: { id },
        include: { purchaseOrder: true, contract: true, supplier: true, warehouse: true, items: { include: { product: true } } },
      });
    },

    // Asset Management queries (Phase 7)

    assets: async (_: any, { status, departmentId, warehouseId, category }: any, { prisma, user }: any) => {
      requireAuth(user);
      const where: any = {};
      if (status) where.status = status;
      if (departmentId) where.departmentId = departmentId;
      if (warehouseId) where.warehouseId = warehouseId;
      if (category) where.category = category;
      return prisma.asset.findMany({
        where,
        include: { department: true, warehouse: true, assignments: true, maintenance: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    asset: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.asset.findUnique({
        where: { id },
        include: { department: true, warehouse: true, assignments: true, maintenance: true, disposals: true },
      });
    },
    myAssets: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.asset.findMany({
        where: { assignedTo: user.id },
        include: { department: true, warehouse: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    assetAssignments: async (_: any, { assetId, assignedTo, status }: any, { prisma, user }: any) => {
      requireAuth(user);
      const where: any = {};
      if (assetId) where.assetId = assetId;
      if (assignedTo) where.assignedTo = assignedTo;
      if (status) where.status = status;
      return prisma.assetAssignment.findMany({
        where,
        include: { asset: true, department: true },
        orderBy: { assignedDate: 'desc' },
      });
    },
    assetAssignment: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.assetAssignment.findUnique({
        where: { id },
        include: { asset: true, department: true },
      });
    },
    assetMaintenance: async (_: any, { assetId, status }: any, { prisma, user }: any) => {
      requireAuth(user);
      const where: any = {};
      if (assetId) where.assetId = assetId;
      if (status) where.status = status;
      return prisma.assetMaintenance.findMany({
        where,
        include: { asset: true },
        orderBy: { scheduledDate: 'asc' },
      });
    },
    assetMaintenanceRecord: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.assetMaintenance.findUnique({
        where: { id },
        include: { asset: true },
      });
    },
    assetDisposals: async (_: any, { status }: any, { prisma, user }: any) => {
      requireAuth(user);
      const where: any = {};
      if (status) where.status = status;
      return prisma.assetDisposal.findMany({
        where,
        include: { asset: true },
        orderBy: { disposalDate: 'desc' },
      });
    },
    assetDisposal: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.assetDisposal.findUnique({
        where: { id },
        include: { asset: true },
      });
    },
    expiringWarranties: async (_: any, { days = 30 }: any, { prisma, user }: any) => {
      requireAuth(user);
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + days);
      return prisma.asset.findMany({
        where: {
          warrantyExpiry: { lte: expiryDate },
          status: { in: ['IN_STOCK', 'IN_USE', 'ASSIGNED'] },
        },
        include: { department: true, warehouse: true },
        orderBy: { warrantyExpiry: 'asc' },
      });
    },
    assetsDueForMaintenance: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.assetMaintenance.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledDate: { lte: new Date() },
        },
        include: { asset: true },
        orderBy: { scheduledDate: 'asc' },
      });
    },

    // Workflow & Approval queries (Phase 7)

    workflows: async (_: any, { entityType }: any, { prisma, user }: any) => {
      requireAuth(user);
      const where: any = {};
      if (entityType) where.entityType = entityType;
      return prisma.workflow.findMany({
        where,
        include: { steps: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    workflow: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.workflow.findUnique({
        where: { id },
        include: { steps: { orderBy: { stepNumber: 'asc' } } },
      });
    },
    workflowSteps: async (_: any, { workflowId }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.workflowStep.findMany({
        where: { workflowId },
        include: { workflow: true, approvals: true },
        orderBy: { stepNumber: 'asc' },
      });
    },
    approvals: async (_: any, { entityType, entityId, status }: any, { prisma, user }: any) => {
      requireAuth(user);
      const where: any = {};
      if (entityType) where.entityType = entityType;
      if (entityId) where.entityId = entityId;
      if (status) where.status = status;
      return prisma.approval.findMany({
        where,
        include: { approver: true, workflowStep: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    myApprovals: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.approval.findMany({
        where: { approverId: user.id, status: 'PENDING' },
        include: { workflowStep: true },
        orderBy: { createdAt: 'desc' },
      });
    },

    // Audit & Risk queries (Phase 9)

    activityLog: async (_: any, { id }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      const log = await prisma.activityLog.findUnique({
        where: { id },
        include: { user: true },
      });
      return log ? { ...log, createdAt: log.createdAt.toISOString() } : null;
    },
    entityHistory: async (_: any, { entityType, entityId }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      const logs = await prisma.activityLog.findMany({
        where: { entityType, entityId },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      });
      return logs.map((l: any) => ({ ...l, createdAt: l.createdAt.toISOString() }));
    },
    auditExport: async (_: any, { entityType, entityId, startDate, endDate }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      const where: any = {};
      if (entityType) where.entityType = entityType;
      if (entityId) where.entityId = entityId;
      if (startDate) where.createdAt = { gte: new Date(startDate) };
      if (endDate) where.createdAt = { lte: new Date(endDate) };
      
      const logs = await prisma.activityLog.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      });
      
      // Simple CSV export
      const headers = ['ID', 'User', 'Action', 'Entity Type', 'Entity ID', 'Details', 'IP Address', 'Created At'];
      const rows = logs.map((log: any) => [
        log.id,
        log.user?.name || 'System',
        log.action,
        log.entityType || 'N/A',
        log.entityId || 'N/A',
        log.details || 'N/A',
        log.ipAddress || 'N/A',
        log.createdAt.toISOString(),
      ]);
      
      const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      return csv;
    },

    riskIndicators: async (_: any, { entityType, entityId, riskType, severity, status }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      const where: any = {};
      if (entityType) where.entityType = entityType;
      if (entityId) where.entityId = entityId;
      if (riskType) where.riskType = riskType;
      if (severity) where.severity = severity;
      if (status) where.status = status;
      return prisma.riskIndicator.findMany({
        where,
        orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
      });
    },
    riskIndicator: async (_: any, { id }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      return prisma.riskIndicator.findUnique({ where: { id } });
    },
    openRisks: async (_: any, { severity }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      const where: any = { status: 'OPEN' };
      if (severity) where.severity = severity;
      return prisma.riskIndicator.findMany({
        where,
        orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
      });
    },
    highRiskEntities: async (_: any, { entityType }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      const risks = await prisma.riskIndicator.groupBy({
        by: ['entityId'],
        where: { entityType, status: 'OPEN', severity: { in: ['HIGH', 'CRITICAL'] } },
        _count: { id: true },
      });
      return risks.map((r: any) => r.entityId);
    },
    riskSummary: async (_: any, __: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      const summary = await prisma.riskIndicator.groupBy({
        by: ['riskType', 'severity', 'status'],
        _count: { id: true },
      });
      
      const total = await prisma.riskIndicator.count({ where: { status: 'OPEN' } });
      const critical = await prisma.riskIndicator.count({ where: { status: 'OPEN', severity: 'CRITICAL' } });
      const high = await prisma.riskIndicator.count({ where: { status: 'OPEN', severity: 'HIGH' } });
      
      return JSON.stringify({
        totalOpen: total,
        critical: critical,
        high: high,
        byType: summary,
      });
    },

    // Reporting & Analytics queries (Phase 10)

    inventoryReport: async (_: any, { warehouseId, categoryId }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      
      const where: any = { status: 'ACTIVE' };
      if (warehouseId) where.warehouseId = warehouseId;
      if (categoryId) where.categoryId = categoryId;
      
      const products = await prisma.product.findMany({ where });
      const batches = await prisma.itemBatch.findMany({ 
        where: { status: 'ACTIVE', expiryDate: { lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) } },
        include: { product: true }
      });
      
      const totalProducts = products.length;
      const activeProducts = products.filter(p => p.status === 'ACTIVE').length;
      const lowStockProducts = products.filter(p => p.stock <= p.minStockLevel).length;
      const outOfStockProducts = products.filter(p => p.stock === 0).length;
      const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
      const totalStockValue = products.reduce((sum, p) => sum + (p.stock * p.costPrice), 0);
      
      // Category summary
      const categoryMap = new Map();
      products.forEach(p => {
        const cat = categoryMap.get(p.categoryId) || { category: 'Uncategorized', productCount: 0, totalStock: 0, totalValue: 0, lowStockCount: 0 };
        cat.productCount++;
        cat.totalStock += p.stock;
        cat.totalValue += p.stock * p.costPrice;
        if (p.stock <= p.minStockLevel) cat.lowStockCount++;
        categoryMap.set(p.categoryId, cat);
      });
      
      // Warehouse summary
      const warehouseMap = new Map();
      products.forEach(p => {
        if (p.warehouseId) {
          const wh = warehouseMap.get(p.warehouseId) || { warehouseId: p.warehouseId, warehouseName: 'Unknown', productCount: 0, totalStock: 0, totalValue: 0, lowStockCount: 0 };
          wh.productCount++;
          wh.totalStock += p.stock;
          wh.totalValue += p.stock * p.costPrice;
          if (p.stock <= p.minStockLevel) wh.lowStockCount++;
          warehouseMap.set(p.warehouseId, wh);
        }
      });
      
      // Expiring items
      const expiringItems = batches.map(b => {
        const daysToExpiry = Math.floor((new Date(b.expiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        return {
          productId: b.productId,
          productName: b.product?.name || 'Unknown',
          batchNumber: b.batchNumber,
          expiryDate: b.expiryDate.toISOString(),
          quantity: b.currentQuantity,
          value: b.currentQuantity * b.unitCost,
          daysToExpiry,
        };
      }).filter(item => item.daysToExpiry <= 90);
      
      return {
        totalProducts,
        activeProducts,
        lowStockProducts,
        outOfStockProducts,
        totalStockValue,
        totalStock,
        byCategory: Array.from(categoryMap.values()),
        byWarehouse: Array.from(warehouseMap.values()),
        expiringItems,
      };
    },
    procurementReport: async (_: any, { departmentId, startDate, endDate }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      
      const where: any = {};
      if (departmentId) where.departmentId = departmentId;
      if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
      if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
      
      const requests = await prisma.procurementRequest.findMany({ where });
      const totalRequests = requests.length;
      const approvedRequests = requests.filter(r => r.status === 'APPROVED').length;
      const pendingRequests = requests.filter(r => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW').length;
      const rejectedRequests = requests.filter(r => r.status === 'REJECTED').length;
      const totalSpent = requests.filter(r => r.status === 'APPROVED').reduce((sum, r) => sum + r.estimatedTotal, 0);
      
      // Simple average processing time (placeholder - would need actual tracking)
      const averageProcessingTime = 5.0; // days
      
      // Department summary
      const deptMap = new Map();
      requests.forEach(r => {
        if (r.departmentId) {
          const dept = deptMap.get(r.departmentId) || { departmentId: r.departmentId, departmentName: 'Unknown', requestCount: 0, approvedCount: 0, totalSpent: 0 };
          dept.requestCount++;
          if (r.status === 'APPROVED') dept.approvedCount++;
          dept.totalSpent += r.estimatedTotal;
          deptMap.set(r.departmentId, dept);
        }
      });
      
      // Category summary (from items)
      const categoryMap = new Map();
      const allItems = await prisma.procurementRequestItem.findMany();
      allItems.forEach(item => {
        if (item.category) {
          const cat = categoryMap.get(item.category) || { category: item.category, requestCount: 0, totalSpent: 0 };
          cat.requestCount++;
          cat.totalSpent += item.estimatedTotal;
          categoryMap.set(item.category, cat);
        }
      });
      
      // Top suppliers (placeholder - would need actual contract data)
      const topSuppliers = [];
      
      return {
        totalRequests,
        approvedRequests,
        pendingRequests,
        rejectedRequests,
        totalSpent,
        averageProcessingTime,
        byDepartment: Array.from(deptMap.values()),
        byCategory: Array.from(categoryMap.values()),
        topSuppliers,
      };
    },
    assetReport: async (_: any, { departmentId, categoryId }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      
      const where: any = {};
      if (departmentId) where.departmentId = departmentId;
      if (categoryId) where.category = categoryId;
      
      const assets = await prisma.asset.findMany({ where });
      const maintenance = await prisma.assetMaintenance.findMany({ where: { status: 'COMPLETED' } });
      const overdueMaintenance = await prisma.assetMaintenance.findMany({ 
        where: { status: 'SCHEDULED', scheduledDate: { lte: new Date() } }
      });
      
      const totalAssets = assets.length;
      const totalValue = assets.reduce((sum, a) => sum + a.purchaseCost, 0);
      const depreciatedValue = assets.reduce((sum, a) => sum + a.currentValue, 0);
      const inUseAssets = assets.filter(a => a.status === 'IN_USE' || a.status === 'ASSIGNED').length;
      const inStockAssets = assets.filter(a => a.status === 'IN_STOCK').length;
      const maintenanceAssets = assets.filter(a => a.status === 'MAINTENANCE').length;
      const retiredAssets = assets.filter(a => a.status === 'RETIRED' || a.status === 'DISPOSED').length;
      const maintenanceCost = maintenance.reduce((sum, m) => sum + (m.cost || 0), 0);
      
      // Category summary
      const categoryMap = new Map();
      assets.forEach(a => {
        const cat = categoryMap.get(a.category) || { category: a.category, assetCount: 0, totalValue: 0, depreciatedValue: 0 };
        cat.assetCount++;
        cat.totalValue += a.purchaseCost;
        cat.depreciatedValue += a.currentValue;
        categoryMap.set(a.category, cat);
      });
      
      // Department summary
      const deptMap = new Map();
      assets.forEach(a => {
        if (a.departmentId) {
          const dept = deptMap.get(a.departmentId) || { departmentId: a.departmentId, departmentName: 'Unknown', assetCount: 0, totalValue: 0 };
          dept.assetCount++;
          dept.totalValue += a.purchaseCost;
          deptMap.set(a.departmentId, dept);
        }
      });
      
      return {
        totalAssets,
        totalValue,
        depreciatedValue,
        inUseAssets,
        inStockAssets,
        maintenanceAssets,
        retiredAssets,
        byCategory: Array.from(categoryMap.values()),
        byDepartment: Array.from(deptMap.values()),
        maintenanceCost,
        overdueMaintenance: overdueMaintenance.length,
      };
    },
    analytics: async (_: any, __: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      
      // Simple trend data (placeholder - would need historical data)
      const inventoryTrends = [
        { period: 'Jan', value: 100000, change: 5000, changePercent: 5.0 },
        { period: 'Feb', value: 105000, change: 5000, changePercent: 5.0 },
        { period: 'Mar', value: 110000, change: 5000, changePercent: 4.76 },
      ];
      
      const procurementTrends = [
        { period: 'Jan', value: 50000, change: 2000, changePercent: 4.17 },
        { period: 'Feb', value: 52000, change: 2000, changePercent: 4.0 },
        { period: 'Mar', value: 54000, change: 2000, changePercent: 3.85 },
      ];
      
      const assetTrends = [
        { period: 'Jan', value: 200000, change: 10000, changePercent: 5.26 },
        { period: 'Feb', value: 210000, change: 10000, changePercent: 5.0 },
        { period: 'Mar', value: 220000, change: 10000, changePercent: 4.76 },
      ];
      
      // Simple forecast (placeholder - would need ML/algorithms)
      const forecast = {
        inventoryForecast: [
          { period: 'Apr', predictedValue: 115000, lowerBound: 110000, upperBound: 120000 },
          { period: 'May', predictedValue: 120000, lowerBound: 115000, upperBound: 125000 },
        ],
        procurementForecast: [
          { period: 'Apr', predictedValue: 56000, lowerBound: 54000, upperBound: 58000 },
          { period: 'May', predictedValue: 58000, lowerBound: 56000, upperBound: 60000 },
        ],
        confidence: 0.85,
      };
      
      // Insights based on current data
      const insights = [];
      const lowStock = await prisma.product.count({ where: { stock: { lte: 5 } } });
      if (lowStock > 0) {
        insights.push({
          type: 'INVENTORY',
          title: 'Low Stock Alert',
          description: `${lowStock} products are at or below minimum stock level`,
          severity: 'HIGH',
          actionable: true,
          metadata: JSON.stringify({ productCount: lowStock }),
        });
      }
      
      const overdueMaintenance = await prisma.assetMaintenance.count({ 
        where: { status: 'SCHEDULED', scheduledDate: { lte: new Date() } }
      });
      if (overdueMaintenance > 0) {
        insights.push({
          type: 'ASSET',
          title: 'Overdue Maintenance',
          description: `${overdueMaintenance} maintenance tasks are overdue`,
          severity: 'HIGH',
          actionable: true,
          metadata: JSON.stringify({ maintenanceCount: overdueMaintenance }),
        });
      }
      
      return {
        inventoryTrends,
        procurementTrends,
        assetTrends,
        forecast,
        insights,
      };
    },
    exportReport: async (_: any, { reportType, filters, format }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      
      let data: any[] = [];
      let headers: string[] = [];
      
      switch (reportType) {
        case 'INVENTORY':
          data = await prisma.product.findMany({ include: { category: true, warehouse: true } });
          headers = ['ID', 'Name', 'SKU', 'Stock', 'Cost Price', 'Selling Price', 'Category', 'Warehouse'];
          break;
        case 'PROCUREMENT':
          data = await prisma.procurementRequest.findMany({ include: { department: true, requester: true } });
          headers = ['ID', 'Request Number', 'Department', 'Requester', 'Total', 'Status', 'Created At'];
          break;
        case 'ASSET':
          data = await prisma.asset.findMany({ include: { department: true, warehouse: true } });
          headers = ['ID', 'Asset Number', 'Serial Number', 'Name', 'Category', 'Value', 'Status', 'Department'];
          break;
        default:
          throw new Error('Unknown report type');
      }
      
      // Simple CSV export
      const rows = data.map((item: any) => {
        switch (reportType) {
          case 'INVENTORY':
            return [
              item.id,
              item.name,
              item.sku,
              item.stock,
              item.costPrice,
              item.sellingPrice,
              item.category?.name || 'N/A',
              item.warehouse?.name || 'N/A',
            ];
          case 'PROCUREMENT':
            return [
              item.id,
              item.requestNumber,
              item.department?.name || 'N/A',
              item.requester?.name || 'N/A',
              item.estimatedTotal,
              item.status,
              item.createdAt.toISOString(),
            ];
          case 'ASSET':
            return [
              item.id,
              item.assetNumber,
              item.serialNumber,
              item.name,
              item.category,
              item.purchaseCost,
              item.status,
              item.department?.name || 'N/A',
            ];
          default:
            return [];
        }
      });
      
      const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      return csv;
    },

    // Document queries (Phase 8)

    documents: async (_: any, { entityType, entityId, category }: any, { prisma, user }: any) => {
      requireAuth(user);
      const where: any = {};
      if (entityType) where.entityType = entityType;
      if (entityId) where.entityId = entityId;
      if (category) where.category = category;
      
      // Filter by access level
      if (user.role !== 'ADMIN') {
        where.OR = [
          { accessLevel: 'PUBLIC' },
          { accessLevel: 'INTERNAL' },
          { uploadedBy: user.id },
        ];
      }
      
      return prisma.document.findMany({
        where,
        include: { parentDocument: true },
        orderBy: { uploadedAt: 'desc' },
      });
    },
    document: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      const doc = await prisma.document.findUnique({
        where: { id },
        include: { parentDocument: true, versions: true },
      });
      
      // Check access level
      if (doc && doc.accessLevel === 'RESTRICTED' && user.role !== 'ADMIN' && doc.uploadedBy !== user.id) {
        throw new Error('Access denied');
      }
      
      if (doc && doc.accessLevel === 'CONFIDENTIAL' && user.role !== 'ADMIN') {
        throw new Error('Access denied');
      }
      
      return doc;
    },
    myDocuments: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.document.findMany({
        where: { uploadedBy: user.id },
        include: { parentDocument: true },
        orderBy: { uploadedAt: 'desc' },
      });
    },

    // Notification queries (Phase 11)

    notifications: async (_: any, { status, type, priority }: any, { prisma, user }: any) => {
      requireAuth(user);
      const where: any = { userId: user.id };
      if (status) where.isRead = status === 'READ';
      if (type) where.type = type;
      if (priority) where.priority = priority;
      
      return prisma.notification.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    notification: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.notification.findFirst({
        where: { id, userId: user.id },
        include: { user: true },
      });
    },
    unreadNotifications: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.notification.findMany({
        where: { userId: user.id, isRead: false },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      });
    },
    notificationPreference: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      let pref = await prisma.notificationPreference.findUnique({
        where: { userId: user.id },
      });
      
      if (!pref) {
        pref = await prisma.notificationPreference.create({
          data: { userId: user.id },
        });
      }
      
      return pref;
    },

    // ── PurchaseOrder queries ───────────────────────────────────────────────

    purchaseOrders: async (_: any, __: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      const orders = await prisma.purchaseOrder.findMany({
        orderBy: { createdAt: 'desc' },
        include: { supplier: true, user: true, items: { include: { product: true } } },
      });
      return orders.map((o: any) => ({
        ...o,
        totalCost: o.items.reduce((s: number, i: any) => s + i.unitCost * i.quantity, 0),
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      }));
    },

    purchaseOrder: async (_: any, { id }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      const o = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: { supplier: true, user: true, items: { include: { product: true } } },
      });
      if (!o) throw new Error('Purchase order not found');
      return { ...o, totalCost: o.items.reduce((s: number, i: any) => s + i.unitCost * i.quantity, 0), createdAt: o.createdAt.toISOString(), updatedAt: o.updatedAt.toISOString() };
    },

    // ── TraditionalItem queries ─────────────────────────────────────────────

    traditionalItems: async (_: any, { search, category, region }: any, { prisma, user }: any) => {
      requireAuth(user);
      const where: any = {};
      if (category) where.category = category;
      if (region)   where.region   = { contains: region };
      if (search)   where.OR = [
        { name:         { contains: search } },
        { amharicName:  { contains: search } },
        { region:       { contains: search } },
        { material:     { contains: search } },
      ];
      const items = await prisma.traditionalItem.findMany({ where, orderBy: { name: 'asc' } });
      return items.map(mapItem);
    },

    traditionalItem: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      const item = await prisma.traditionalItem.findUnique({ where: { id } });
      if (!item) throw new Error('Item not found');
      return mapItem(item);
    },
  },

  Mutation: {
    register: async (_: any, { name, email, password, role }: any, { prisma }: any) => {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({ data: { name, email, password: hashedPassword, role: role || 'CASHIER' } });
      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      return { token, user: { ...user, createdAt: user.createdAt.toISOString() } };
    },

    login: async (_: any, { email, password }: any, { prisma }: any) => {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) throw new Error('Invalid credentials');
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) throw new Error('Invalid credentials');
      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      return { token, user: { ...user, createdAt: user.createdAt.toISOString() } };
    },

    createCategory: async (_: any, { name, description }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      return prisma.category.create({ data: { name, description } });
    },
    updateCategory: async (_: any, { id, name, description }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      return prisma.category.update({ where: { id }, data: { name, description } });
    },
    deleteCategory: async (_: any, { id }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN');
      await prisma.category.delete({ where: { id } });
      return true;
    },

    createSupplier: async (_: any, args: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      return prisma.supplier.create({
        data: {
          name:        args.name,
          contactName: args.contactName || null,
          email:       args.email       || null,
          phone:       args.phone       || null,
          address:     args.address     || null,
        },
      });
    },
    updateSupplier: async (_: any, { id, ...data }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      return prisma.supplier.update({ where: { id }, data });
    },
    deleteSupplier: async (_: any, { id }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN');
      await prisma.supplier.delete({ where: { id } });
      return true;
    },

    createCustomer: async (_: any, args: any, { prisma, user }: any) => {
      requireAuth(user);
      const c = await prisma.customer.create({ data: args });
      return { ...c, createdAt: c.createdAt.toISOString(), totalSpent: 0, purchaseCount: 0 };
    },
    updateCustomer: async (_: any, { id, ...data }: any, { prisma, user }: any) => {
      requireAuth(user);
      const c = await prisma.customer.update({ where: { id }, data });
      return { ...c, createdAt: c.createdAt.toISOString(), totalSpent: 0, purchaseCount: 0 };
    },
    deleteCustomer: async (_: any, { id }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      await prisma.customer.delete({ where: { id } });
      return true;
    },

    createProduct: async (_: any, args: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');

      // Check for duplicate SKU before attempting insert
      const existing = await prisma.product.findUnique({ where: { sku: args.sku } });
      if (existing) throw new Error(`SKU "${args.sku}" already exists. Please use a different SKU.`);

      // Check duplicate barcode only if one was provided
      if (args.barcode) {
        const barcodeExists = await prisma.product.findUnique({ where: { barcode: args.barcode } });
        if (barcodeExists) throw new Error(`Barcode "${args.barcode}" is already assigned to "${barcodeExists.name}".`);
      }

      const data: any = {
        name:          args.name,
        sku:           args.sku,
        costPrice:     args.costPrice,
        sellingPrice:  args.sellingPrice,
        categoryId:    args.categoryId,
        stock:         args.stock         ?? 0,
        minStockLevel: args.minStockLevel ?? 10,
        status:        args.status        ?? 'ACTIVE',
        description:   args.description   || null,
        imageUrl:      args.imageUrl      || null,
        barcode:       args.barcode       || null,
        supplierId:    args.supplierId    || null,
      };

      const p = await prisma.product.create({
        data,
        include: { category: true, supplier: true, saleItems: true },
      });
      await prisma.activityLog.create({ data: { userId: user.id, action: 'PRODUCT_CREATED', details: `Created product: ${p.name}` } });
      return { ...p, profitMargin: ((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() };
    },

    updateProduct: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');

      // Check SKU uniqueness if SKU is being changed
      if (args.sku) {
        const skuConflict = await prisma.product.findFirst({
          where: { sku: args.sku, NOT: { id } },
        });
        if (skuConflict) throw new Error(`SKU "${args.sku}" is already used by "${skuConflict.name}".`);
      }

      // Check barcode uniqueness if barcode is being changed
      if (args.barcode) {
        const barcodeConflict = await prisma.product.findFirst({
          where: { barcode: args.barcode, NOT: { id } },
        });
        if (barcodeConflict) throw new Error(`Barcode "${args.barcode}" is already assigned to "${barcodeConflict.name}".`);
      }

      const data: any = { ...args };
      if ('barcode'     in data) data.barcode     = data.barcode     || null;
      if ('imageUrl'    in data) data.imageUrl    = data.imageUrl    || null;
      if ('description' in data) data.description = data.description || null;
      if ('supplierId'  in data) data.supplierId  = data.supplierId  || null;

      const p = await prisma.product.update({
        where: { id },
        data,
        include: { category: true, supplier: true, saleItems: true },
      });
      await prisma.activityLog.create({ data: { userId: user.id, action: 'PRODUCT_UPDATED', details: `Updated product: ${p.name}` } });
      return { ...p, profitMargin: ((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() };
    },

    deleteProduct: async (_: any, { id }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      const p = await prisma.product.findUnique({
        where: { id },
        include: { saleItems: true, transactions: true },
      });
      if (!p) throw new Error('Product not found');

      // If product has sales history, mark as INACTIVE instead of hard-deleting
      if (p.saleItems.length > 0) {
        await prisma.product.update({ where: { id }, data: { status: 'INACTIVE' } });
        await prisma.activityLog.create({ data: { userId: user.id, action: 'PRODUCT_DEACTIVATED', details: `Deactivated product: ${p.name} (has sales history)` } });
        return true;
      }

      // Safe to hard-delete — remove transactions first
      if (p.transactions.length > 0) {
        await prisma.transaction.deleteMany({ where: { productId: id } });
      }
      await prisma.product.delete({ where: { id } });
      await prisma.activityLog.create({ data: { userId: user.id, action: 'PRODUCT_DELETED', details: `Deleted product: ${p.name}` } });
      return true;
    },

    adjustStock: async (_: any, { productId, quantity, type, notes }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) throw new Error('Product not found');

      let newStock = product.stock;
      if (type === 'IN') newStock += quantity;
      else if (type === 'OUT') newStock -= quantity;
      else if (type === 'ADJUSTMENT') newStock = quantity;

      if (newStock < 0) throw new Error('Insufficient stock');

      await prisma.product.update({ where: { id: productId }, data: { stock: newStock } });
      const txn = await prisma.transaction.create({
        data: { productId, quantity, type, notes, userId: user.id },
        include: { product: true },
      });
      await prisma.activityLog.create({ data: { userId: user.id, action: 'STOCK_ADJUSTED', details: `${type} ${quantity} units of ${product.name}` } });

      // Check if any product is now at or below threshold and alert
      const updatedProduct = await prisma.product.findUnique({ where: { id: productId } });
      if (updatedProduct && updatedProduct.stock <= updatedProduct.minStockLevel) {
        sendLowStockAlert([updatedProduct]).catch(() => {});
      }

      return { ...txn, createdAt: txn.createdAt.toISOString() };
    },

    createSale: async (_: any, { customerId, items }: any, { prisma, user }: any) => {
      requireAuth(user);

      for (const item of items) {
        const product = await prisma.product.findUnique({ where: { id: item.productId } });
        if (!product) throw new Error(`Product ${item.productId} not found`);
        if (product.stock < item.quantity) throw new Error(`Insufficient stock for ${product.name}`);
      }

      // Generate sequential invoice number INV-0001, INV-0002 …
      const lastSale = await prisma.sale.findFirst({ orderBy: { createdAt: 'desc' } });
      let nextNum = 1;
      if (lastSale?.invoiceNo) {
        const match = lastSale.invoiceNo.match(/INV-(\d+)$/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      const invoiceNo = `INV-${String(nextNum).padStart(4, '0')}`;
      const totalAmount = items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

      const sale = await prisma.sale.create({
        data: {
          invoiceNo,
          totalAmount,
          customerId: customerId || null,
          userId: user.id,
          items: { create: items.map((i: any) => ({ productId: i.productId, quantity: i.quantity, price: i.price })) },
        },
        include: { items: { include: { product: true } }, customer: true, user: true, returns: true },
      });

      for (const item of items) {
        await prisma.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
        await prisma.transaction.create({ data: { productId: item.productId, quantity: item.quantity, type: 'OUT', notes: `Sale ${invoiceNo}`, userId: user.id } });
      }

      await prisma.activityLog.create({ data: { userId: user.id, action: 'SALE_COMPLETED', details: `Sale ${invoiceNo} for $${totalAmount}` } });

      // Send receipt email if customer has email address
      sendSaleReceipt({ ...sale, createdAt: sale.createdAt.toISOString() }).catch(() => {});

      return { ...sale, createdAt: sale.createdAt.toISOString() };
    },

    returnSale: async (_: any, { saleId, reason }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');

      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: { items: { include: { product: true } }, returns: true },
      });
      if (!sale) throw new Error('Sale not found');

      const alreadyReturned = sale.returns.length > 0;
      if (alreadyReturned) throw new Error('This sale has already been returned');

      // Restore stock for each item
      for (const item of sale.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
        await prisma.transaction.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            type: 'IN',
            notes: `Return of ${sale.invoiceNo}`,
            userId: user.id,
          },
        });
      }

      const saleReturn = await prisma.saleReturn.create({
        data: {
          saleId: sale.id,
          refundAmount: sale.totalAmount,
          reason: reason || null,
          userId: user.id,
        },
        include: { sale: true, user: true },
      });

      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: 'SALE_RETURNED',
          details: `Returned ${sale.invoiceNo} — refund $${sale.totalAmount}`,
        },
      });

      return { ...saleReturn, createdAt: saleReturn.createdAt.toISOString() };
    },

    updateProfile: async (_: any, { name, currentPassword, newPassword }: any, { prisma, user }: any) => {
      requireAuth(user);
      const existing = await prisma.user.findUnique({ where: { id: user.id } });
      if (!existing) throw new Error('User not found');
      const valid = await bcrypt.compare(currentPassword, existing.password);
      if (!valid) throw new Error('Current password is incorrect');
      const data: any = {};
      if (name) data.name = name;
      if (newPassword) {
        if (newPassword.length < 6) throw new Error('New password must be at least 6 characters');
        data.password = await bcrypt.hash(newPassword, 10);
      }
      const updated = await prisma.user.update({ where: { id: user.id }, data });
      await prisma.activityLog.create({ data: { userId: user.id, action: 'PROFILE_UPDATED', details: 'User updated their profile' } });
      return { ...updated, createdAt: updated.createdAt.toISOString() };
    },

    createUser: async (_: any, { name, email, password, role }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN');
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await prisma.user.create({
        data: { name, email, password: hashedPassword, role },
      });
      await prisma.activityLog.create({ data: { userId: user.id, action: 'USER_CREATED', details: `Created user: ${name} (${role})` } });
      return { ...newUser, createdAt: newUser.createdAt.toISOString() };
    },

    updateUserRole: async (_: any, { id, role }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN');
      if (id === user.id) throw new Error('You cannot change your own role');
      const updated = await prisma.user.update({ where: { id }, data: { role } });
      await prisma.activityLog.create({ data: { userId: user.id, action: 'USER_ROLE_CHANGED', details: `Changed role of user ${updated.name} to ${role}` } });
      return { ...updated, createdAt: updated.createdAt.toISOString() };
    },

    deleteUser: async (_: any, { id }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN');
      if (id === user.id) throw new Error('You cannot delete yourself');
      const target = await prisma.user.findUnique({ where: { id } });
      if (!target) throw new Error('User not found');
      await prisma.user.delete({ where: { id } });
      await prisma.activityLog.create({ data: { userId: user.id, action: 'USER_DELETED', details: `Deleted user: ${target.name}` } });
      return true;
    },

    // ── PurchaseOrder mutations ─────────────────────────────────────────────

    createPurchaseOrder: async (_: any, { supplierId, notes, items }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');

      // Auto-generate PO number: PO-0001, PO-0002 …
      const last = await prisma.purchaseOrder.findFirst({ orderBy: { createdAt: 'desc' } });
      let nextNum = 1;
      if (last?.poNumber) {
        const match = last.poNumber.match(/PO-(\d+)$/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      const poNumber = `PO-${String(nextNum).padStart(4, '0')}`;

      const order = await prisma.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: supplierId || null,
          notes: notes || null,
          userId: user.id,
          status: 'DRAFT',
          items: { create: items.map((i: any) => ({ productId: i.productId, quantity: i.quantity, unitCost: i.unitCost })) },
        },
        include: { supplier: true, user: true, items: { include: { product: true } } },
      });
      await prisma.activityLog.create({ data: { userId: user.id, action: 'PO_CREATED', details: `Created Purchase Order ${poNumber}` } });
      return { ...order, totalCost: order.items.reduce((s: number, i: any) => s + i.unitCost * i.quantity, 0), createdAt: order.createdAt.toISOString(), updatedAt: order.updatedAt.toISOString() };
    },

    updatePurchaseOrderStatus: async (_: any, { id, status }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      const order = await prisma.purchaseOrder.update({
        where: { id },
        data: { status },
        include: { supplier: true, user: true, items: { include: { product: true } } },
      });
      await prisma.activityLog.create({ data: { userId: user.id, action: 'PO_STATUS_CHANGED', details: `PO ${order.poNumber} → ${status}` } });
      return { ...order, totalCost: order.items.reduce((s: number, i: any) => s + i.unitCost * i.quantity, 0), createdAt: order.createdAt.toISOString(), updatedAt: order.updatedAt.toISOString() };
    },

    receivePurchaseOrder: async (_: any, { id }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      const order = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: { items: { include: { product: true } } },
      });
      if (!order) throw new Error('Purchase order not found');
      if (order.status === 'RECEIVED') throw new Error('Already received');

      // Add stock for each item
      for (const item of order.items) {
        await prisma.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
        await prisma.transaction.create({ data: { productId: item.productId, quantity: item.quantity, type: 'IN', notes: `PO ${order.poNumber}`, userId: user.id } });
      }

      const updated = await prisma.purchaseOrder.update({
        where: { id },
        data: { status: 'RECEIVED' },
        include: { supplier: true, user: true, items: { include: { product: true } } },
      });
      await prisma.activityLog.create({ data: { userId: user.id, action: 'PO_RECEIVED', details: `Received Purchase Order ${order.poNumber} — stock updated` } });
      return { ...updated, totalCost: updated.items.reduce((s: number, i: any) => s + i.unitCost * i.quantity, 0), createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() };
    },

    deletePurchaseOrder: async (_: any, { id }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN');
      const order = await prisma.purchaseOrder.findUnique({ where: { id } });
      if (!order) throw new Error('Not found');
      if (order.status === 'RECEIVED') throw new Error('Cannot delete a received purchase order');
      await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      await prisma.purchaseOrder.delete({ where: { id } });
      return true;
    },

    createBranch: async (_: any, args: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN');
      const b = await prisma.branch.create({ data: { name: args.name, address: args.address || null, phone: args.phone || null, manager: args.manager || null } });
      await prisma.activityLog.create({ data: { userId: user.id, action: 'BRANCH_CREATED', details: `Created branch: ${b.name}` } });
      return { ...b, createdAt: b.createdAt.toISOString() };
    },

    updateBranch: async (_: any, { id, ...data }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN');
      const b = await prisma.branch.update({ where: { id }, data: { ...data, address: data.address || null, phone: data.phone || null, manager: data.manager || null } });
      return { ...b, createdAt: b.createdAt.toISOString() };
    },

    deleteBranch: async (_: any, { id }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN');
      const b = await prisma.branch.findUnique({ where: { id } });
      if (!b) throw new Error('Branch not found');
      await prisma.branch.delete({ where: { id } });
      await prisma.activityLog.create({ data: { userId: user.id, action: 'BRANCH_DELETED', details: `Deleted branch: ${b.name}` } });
      return true;
    },

    // ── TraditionalItem mutations ──────────────────────────────────────────

    createTraditionalItem: async (_: any, args: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      const item = await prisma.traditionalItem.create({
        data: {
          name:          args.name,
          region:        args.region,
          category:      args.category,
          costPrice:     args.costPrice,
          sellingPrice:  args.sellingPrice,
          stock:         args.stock         ?? 0,
          minStockLevel: args.minStockLevel ?? 5,
          status:        args.status        ?? 'ACTIVE',
          amharicName:   args.amharicName   || null,
          material:      args.material      || null,
          description:   args.description   || null,
          culturalNote:  args.culturalNote  || null,
          imageUrl:      args.imageUrl      || null,
        },
      });
      await prisma.activityLog.create({ data: { userId: user.id, action: 'TRADITIONAL_ITEM_CREATED', details: `Created traditional item: ${item.name}` } });
      return mapItem(item);
    },

    updateTraditionalItem: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      const data: any = { ...args };
      if ('imageUrl'    in data) data.imageUrl    = data.imageUrl    || null;
      if ('description' in data) data.description = data.description || null;
      if ('culturalNote' in data) data.culturalNote = data.culturalNote || null;
      if ('material'    in data) data.material    = data.material    || null;
      if ('amharicName' in data) data.amharicName = data.amharicName || null;
      const item = await prisma.traditionalItem.update({ where: { id }, data });
      await prisma.activityLog.create({ data: { userId: user.id, action: 'TRADITIONAL_ITEM_UPDATED', details: `Updated traditional item: ${item.name}` } });
      return mapItem(item);
    },

    deleteTraditionalItem: async (_: any, { id }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      const item = await prisma.traditionalItem.findUnique({ where: { id } });
      if (!item) throw new Error('Item not found');
      await prisma.traditionalItem.delete({ where: { id } });
      await prisma.activityLog.create({ data: { userId: user.id, action: 'TRADITIONAL_ITEM_DELETED', details: `Deleted traditional item: ${item.name}` } });
      return true;
    },

    adjustTraditionalStock: async (_: any, { id, quantity, type, notes }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      const item = await prisma.traditionalItem.findUnique({ where: { id } });
      if (!item) throw new Error('Item not found');
      let newStock = item.stock;
      if (type === 'IN') newStock += quantity;
      else if (type === 'OUT') newStock -= quantity;
      else if (type === 'SET') newStock = quantity;
      if (newStock < 0) throw new Error('Insufficient stock');
      const updated = await prisma.traditionalItem.update({ where: { id }, data: { stock: newStock } });
      return mapItem(updated);
    },

    // ── Organization mutations ─────────────────────────────────────────────────────

    createOrganization: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'organization.manage');
      return prisma.organization.create({
        data: {
          name: args.name,
          code: args.code,
          type: args.type,
          description: args.description || null,
          address: args.address || null,
          phone: args.phone || null,
          email: args.email || null,
          website: args.website || null,
        },
      });
    },
    updateOrganization: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'organization.manage');
      return prisma.organization.update({
        where: { id },
        data: args,
      });
    },
    deleteOrganization: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'organization.manage');
      await prisma.organization.delete({ where: { id } });
      return true;
    },

    createOrganizationUnit: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'organization.manage');
      return prisma.organizationUnit.create({
        data: {
          name: args.name,
          code: args.code,
          type: args.type,
          organizationId: args.organizationId,
          parentId: args.parentId || null,
          address: args.address || null,
          phone: args.phone || null,
          email: args.email || null,
          headOfUnit: args.headOfUnit || null,
        },
      });
    },
    updateOrganizationUnit: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'organization.manage');
      return prisma.organizationUnit.update({
        where: { id },
        data: args,
      });
    },
    deleteOrganizationUnit: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'organization.manage');
      await prisma.organizationUnit.delete({ where: { id } });
      return true;
    },

    createDepartment: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'department.manage');
      return prisma.department.create({
        data: {
          name: args.name,
          code: args.code,
          organizationUnitId: args.organizationUnitId || null,
          headOfDepartment: args.headOfDepartment || null,
          budgetCode: args.budgetCode || null,
          description: args.description || null,
        },
      });
    },
    updateDepartment: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'department.manage');
      return prisma.department.update({
        where: { id },
        data: args,
      });
    },
    deleteDepartment: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'department.manage');
      await prisma.department.delete({ where: { id } });
      return true;
    },

    createWarehouse: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'warehouse.manage');
      return prisma.warehouse.create({
        data: {
          name: args.name,
          code: args.code,
          organizationUnitId: args.organizationUnitId || null,
          type: args.type,
          address: args.address || null,
          phone: args.phone || null,
          manager: args.manager || null,
          capacity: args.capacity || null,
        },
      });
    },
    updateWarehouse: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'warehouse.manage');
      return prisma.warehouse.update({
        where: { id },
        data: args,
      });
    },
    deleteWarehouse: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'warehouse.manage');
      await prisma.warehouse.delete({ where: { id } });
      return true;
    },

    createWarehouseLocation: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'warehouse.manage');
      return prisma.warehouseLocation.create({
        data: {
          name: args.name,
          code: args.code,
          warehouseId: args.warehouseId,
          type: args.type,
          capacity: args.capacity || null,
        },
      });
    },
    updateWarehouseLocation: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'warehouse.manage');
      return prisma.warehouseLocation.update({
        where: { id },
        data: args,
      });
    },
    deleteWarehouseLocation: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'warehouse.manage');
      await prisma.warehouseLocation.delete({ where: { id } });
      return true;
    },

    // ── RBAC mutations ─────────────────────────────────────────────────────────────

    createPermission: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'role.manage');
      return prisma.permission.create({
        data: {
          name: args.name,
          description: args.description || null,
          module: args.module,
          action: args.action,
          resource: args.resource || null,
        },
      });
    },
    updatePermission: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'role.manage');
      return prisma.permission.update({
        where: { id },
        data: args,
      });
    },
    deletePermission: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'role.manage');
      await prisma.permission.delete({ where: { id } });
      return true;
    },

    createRole: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'role.manage');
      return prisma.role.create({
        data: {
          name: args.name,
          description: args.description || null,
          level: args.level || 0,
          isSystem: args.isSystem || false,
        },
      });
    },
    updateRole: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'role.manage');
      return prisma.role.update({
        where: { id },
        data: args,
      });
    },
    deleteRole: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'role.manage');
      const role = await prisma.role.findUnique({ where: { id } });
      if (role?.isSystem) throw new Error('Cannot delete system roles');
      await prisma.role.delete({ where: { id } });
      return true;
    },

    assignPermissionToRole: async (_: any, { roleId, permissionId }: any, { prisma, user }: any) => {
      requirePermission(user, 'role.manage');
      return prisma.rolePermission.create({
        data: { roleId, permissionId },
        include: { role: true, permission: true },
      });
    },
    removePermissionFromRole: async (_: any, { roleId, permissionId }: any, { prisma, user }: any) => {
      requirePermission(user, 'role.manage');
      await prisma.rolePermission.deleteMany({
        where: { roleId, permissionId },
      });
      return true;
    },

    assignRoleToUser: async (_: any, { userId, roleId }: any, { prisma, user }: any) => {
      requirePermission(user, 'user.manage');
      return prisma.userRole.create({
        data: { userId, roleId, assignedBy: user.id },
        include: { user: true, role: true },
      });
    },
    removeRoleFromUser: async (_: any, { userId, roleId }: any, { prisma, user }: any) => {
      requirePermission(user, 'user.manage');
      await prisma.userRole.deleteMany({
        where: { userId, roleId },
      });
      return true;
    },

    assignUserToOrganization: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'user.manage');
      return prisma.userOrganization.create({
        data: {
          userId: args.userId,
          organizationId: args.organizationId || null,
          organizationUnitId: args.organizationUnitId || null,
          departmentId: args.departmentId || null,
          warehouseId: args.warehouseId || null,
          isPrimary: args.isPrimary || false,
          assignedBy: user.id,
        },
        include: { organization: true, organizationUnit: true, department: true, warehouse: true },
      });
    },
    updateUserOrganization: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'user.manage');
      return prisma.userOrganization.update({
        where: { id },
        data: args,
        include: { organization: true, organizationUnit: true, department: true, warehouse: true },
      });
    },
    removeUserFromOrganization: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'user.manage');
      await prisma.userOrganization.delete({ where: { id } });
      return true;
    },

    // Enhanced Inventory mutations (Phase 3)

    createItemBatch: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'inventory.create');
      return prisma.itemBatch.create({
        data: {
          productId: args.productId,
          batchNumber: args.batchNumber,
          manufacturingDate: args.manufacturingDate ? new Date(args.manufacturingDate) : null,
          expiryDate: args.expiryDate ? new Date(args.expiryDate) : null,
          initialQuantity: args.initialQuantity,
          currentQuantity: args.initialQuantity,
          unitCost: args.unitCost,
          supplierId: args.supplierId || null,
          warehouseId: args.warehouseId || null,
          locationId: args.locationId || null,
        },
        include: { product: true, supplier: true, warehouse: true, location: true },
      });
    },
    updateItemBatch: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'inventory.update');
      return prisma.itemBatch.update({
        where: { id },
        data: args,
        include: { product: true, supplier: true, warehouse: true, location: true },
      });
    },
    deleteItemBatch: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'inventory.delete');
      await prisma.itemBatch.delete({ where: { id } });
      return true;
    },

    createSerialNumber: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'inventory.create');
      return prisma.serialNumber.create({
        data: {
          productId: args.productId,
          serialNumber: args.serialNumber,
          batchId: args.batchId || null,
          warehouseId: args.warehouseId || null,
          locationId: args.locationId || null,
        },
        include: { product: true, batch: true, warehouse: true, location: true },
      });
    },
    updateSerialNumber: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'inventory.update');
      return prisma.serialNumber.update({
        where: { id },
        data: args,
        include: { product: true, batch: true, warehouse: true, location: true },
      });
    },
    deleteSerialNumber: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'inventory.delete');
      await prisma.serialNumber.delete({ where: { id } });
      return true;
    },
    assignSerialNumber: async (_: any, { id, assignedTo }: any, { prisma, user }: any) => {
      requirePermission(user, 'inventory.update');
      return prisma.serialNumber.update({
        where: { id },
        data: { assignedTo, assignedAt: new Date(), status: 'ASSIGNED' },
        include: { product: true, batch: true, warehouse: true, location: true },
      });
    },

    createStockTransfer: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'inventory.transfer');
      const transferNumber = `ST-${Date.now()}`;
      return prisma.stockTransfer.create({
        data: {
          transferNumber,
          fromWarehouseId: args.fromWarehouseId,
          toWarehouseId: args.toWarehouseId,
          requestedBy: user.id,
          notes: args.notes || null,
        },
        include: { fromWarehouse: true, toWarehouse: true },
      });
    },
    addStockTransferItem: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'inventory.transfer');
      return prisma.stockTransferItem.create({
        data: {
          stockTransferId: args.stockTransferId,
          productId: args.productId,
          batchId: args.batchId || null,
          requestedQuantity: args.requestedQuantity,
        },
        include: { stockTransfer: true, product: true, batch: true },
      });
    },
    updateStockTransferItem: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'inventory.transfer');
      return prisma.stockTransferItem.update({
        where: { id },
        data: args,
        include: { stockTransfer: true, product: true, batch: true },
      });
    },
    approveStockTransfer: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'inventory.approve');
      return prisma.stockTransfer.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy: user.id,
          approvedAt: new Date(),
        },
        include: { fromWarehouse: true, toWarehouse: true, items: true },
      });
    },
    dispatchStockTransfer: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'inventory.transfer');
      const transfer = await prisma.stockTransfer.findUnique({
        where: { id },
        include: { items: true },
      });
      if (transfer?.status !== 'APPROVED') throw new Error('Transfer must be approved before dispatching');
      
      // Update item statuses and deduct from source warehouse
      for (const item of transfer.items) {
        await prisma.stockTransferItem.update({
          where: { id: item.id },
          data: { dispatchedQuantity: item.approvedQuantity || item.requestedQuantity },
        });
      }
      
      return prisma.stockTransfer.update({
        where: { id },
        data: { status: 'DISPATCHED' },
        include: { fromWarehouse: true, toWarehouse: true, items: true },
      });
    },
    receiveStockTransfer: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'inventory.transfer');
      const transfer = await prisma.stockTransfer.findUnique({
        where: { id },
        include: { items: true },
      });
      if (transfer?.status !== 'DISPATCHED') throw new Error('Transfer must be dispatched before receiving');
      
      // Update item statuses and add to destination warehouse
      for (const item of transfer.items) {
        const quantity = item.approvedQuantity || item.requestedQuantity;
        await prisma.stockTransferItem.update({
          where: { id: item.id },
          data: { receivedQuantity: quantity },
        });
        
        // Update batch quantities
        if (item.batchId) {
          await prisma.itemBatch.update({
            where: { id: item.batchId },
            data: { currentQuantity: { decrement: quantity } },
          });
        }
      }
      
      return prisma.stockTransfer.update({
        where: { id },
        data: { status: 'RECEIVED' },
        include: { fromWarehouse: true, toWarehouse: true, items: true },
      });
    },
    cancelStockTransfer: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'inventory.transfer');
      await prisma.stockTransfer.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      return true;
    },

    createInventoryAudit: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'inventory.audit');
      const auditNumber = `AUD-${Date.now()}`;
      return prisma.inventoryAudit.create({
        data: {
          auditNumber,
          warehouseId: args.warehouseId,
          locationId: args.locationId || null,
          conductedBy: user.id,
          supervisedBy: args.supervisedBy || null,
          notes: args.notes || null,
        },
        include: { warehouse: true, location: true },
      });
    },
    addInventoryAuditItem: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'inventory.audit');
      const variance = args.actualQuantity - args.expectedQuantity;
      return prisma.inventoryAuditItem.create({
        data: {
          inventoryAuditId: args.inventoryAuditId,
          productId: args.productId,
          expectedQuantity: args.expectedQuantity,
          actualQuantity: args.actualQuantity,
          variance,
          varianceReason: args.varianceReason || null,
        },
        include: { inventoryAudit: true, product: true },
      });
    },
    resolveInventoryAuditItem: async (_: any, { id, resolution }: any, { prisma, user }: any) => {
      requirePermission(user, 'inventory.audit');
      return prisma.inventoryAuditItem.update({
        where: { id },
        data: {
          resolved: true,
          resolution,
          resolvedBy: user.id,
          resolvedAt: new Date(),
        },
        include: { inventoryAudit: true, product: true },
      });
    },
    completeInventoryAudit: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'inventory.audit');
      return prisma.inventoryAudit.update({
        where: { id },
        data: { status: 'COMPLETED' },
        include: { warehouse: true, location: true, items: { include: { product: true } } },
      });
    },
    cancelInventoryAudit: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'inventory.audit');
      await prisma.inventoryAudit.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      return true;
    },

    // Procurement mutations (Phase 4 & 5)

    createProcurementRequest: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'procurement.create');
      const requestNumber = `PR-${Date.now()}`;
      return prisma.procurementRequest.create({
        data: {
          requestNumber,
          departmentId: args.departmentId || null,
          requesterId: user.id,
          requiredDate: new Date(args.requiredDate),
          priority: args.priority || 'NORMAL',
          justification: args.justification || null,
          notes: args.notes || null,
          estimatedTotal: 0,
        },
        include: { organization: true, department: true, requester: true },
      });
    },
    updateProcurementRequest: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'procurement.update');
      const data: any = { ...args };
      if (args.requiredDate) data.requiredDate = new Date(args.requiredDate);
      return prisma.procurementRequest.update({
        where: { id },
        data,
        include: { organization: true, department: true, requester: true, items: true },
      });
    },
    addProcurementRequestItem: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'procurement.create');
      const estimatedTotal = args.quantity * args.estimatedUnitCost;
      const item = await prisma.procurementRequestItem.create({
        data: {
          procurementRequestId: args.procurementRequestId,
          description: args.description,
          quantity: args.quantity,
          unitOfMeasure: args.unitOfMeasure,
          estimatedUnitCost: args.estimatedUnitCost,
          estimatedTotal,
          technicalSpecs: args.technicalSpecs || null,
          category: args.category || null,
          notes: args.notes || null,
        },
        include: { procurementRequest: true },
      });
      
      // Update request total
      const request = await prisma.procurementRequest.findUnique({
        where: { id: args.procurementRequestId },
        include: { items: true },
      });
      const total = request?.items.reduce((sum: number, item: any) => sum + item.estimatedTotal, 0) || 0;
      await prisma.procurementRequest.update({
        where: { id: args.procurementRequestId },
        data: { estimatedTotal: total },
      });
      
      return item;
    },
    updateProcurementRequestItem: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'procurement.update');
      const data: any = { ...args };
      if (args.quantity !== undefined || args.estimatedUnitCost !== undefined) {
        const item = await prisma.procurementRequestItem.findUnique({ where: { id } });
        const quantity = args.quantity ?? item?.quantity;
        const unitCost = args.estimatedUnitCost ?? item?.estimatedUnitCost;
        data.estimatedTotal = quantity * unitCost;
      }
      const updated = await prisma.procurementRequestItem.update({
        where: { id },
        data,
        include: { procurementRequest: true },
      });
      
      // Update request total
      const request = await prisma.procurementRequest.findUnique({
        where: { id: updated.procurementRequestId },
        include: { items: true },
      });
      const total = request?.items.reduce((sum: number, item: any) => sum + item.estimatedTotal, 0) || 0;
      await prisma.procurementRequest.update({
        where: { id: updated.procurementRequestId },
        data: { estimatedTotal: total },
      });
      
      return updated;
    },
    deleteProcurementRequestItem: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'procurement.delete');
      const item = await prisma.procurementRequestItem.findUnique({ where: { id } });
      await prisma.procurementRequestItem.delete({ where: { id } });
      
      // Update request total
      if (item) {
        const request = await prisma.procurementRequest.findUnique({
          where: { id: item.procurementRequestId },
          include: { items: true },
        });
        const total = request?.items.reduce((sum: number, item: any) => sum + item.estimatedTotal, 0) || 0;
        await prisma.procurementRequest.update({
          where: { id: item.procurementRequestId },
          data: { estimatedTotal: total },
        });
      }
      
      return true;
    },
    submitProcurementRequest: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'procurement.create');
      return prisma.procurementRequest.update({
        where: { id },
        data: { status: 'SUBMITTED' },
        include: { organization: true, department: true, requester: true, items: true },
      });
    },
    approveProcurementRequest: async (_: any, { id, comments }: any, { prisma, user }: any) => {
      requirePermission(user, 'procurement.approve');
      return prisma.procurementRequest.update({
        where: { id },
        data: { status: 'APPROVED' },
        include: { organization: true, department: true, requester: true, items: true },
      });
    },
    rejectProcurementRequest: async (_: any, { id, comments }: any, { prisma, user }: any) => {
      requirePermission(user, 'procurement.approve');
      return prisma.procurementRequest.update({
        where: { id },
        data: { status: 'REJECTED' },
        include: { organization: true, department: true, requester: true, items: true },
      });
    },
    cancelProcurementRequest: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'procurement.delete');
      await prisma.procurementRequest.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      return true;
    },

    createTender: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'tender.create');
      const tenderNumber = `T-${Date.now()}`;
      return prisma.tender.create({
        data: {
          tenderNumber,
          procurementRefId: args.procurementRefId || null,
          projectName: args.projectName,
          procurementCategory: args.procurementCategory,
          procurementMethod: args.procurementMethod,
          marketType: args.marketType,
          submissionDeadline: new Date(args.submissionDeadline),
          bidValidityPeriod: args.bidValidityPeriod,
          bidSecurity: args.bidSecurity || null,
          currency: args.currency || 'ETB',
          contractType: args.contractType,
          description: args.description || null,
        },
        include: { procurementRef: true },
      });
    },
    updateTender: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'tender.manage');
      const data: any = { ...args };
      if (args.submissionDeadline) data.submissionDeadline = new Date(args.submissionDeadline);
      return prisma.tender.update({
        where: { id },
        data,
        include: { procurementRef: true, items: true },
      });
    },
    addTenderItem: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'tender.create');
      return prisma.tenderItem.create({
        data: {
          tenderId: args.tenderId,
          description: args.description,
          quantity: args.quantity,
          unit: args.unit,
          specifications: args.specifications || null,
        },
        include: { tender: true },
      });
    },
    updateTenderItem: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'tender.manage');
      return prisma.tenderItem.update({
        where: { id },
        data: args,
        include: { tender: true },
      });
    },
    deleteTenderItem: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'tender.manage');
      await prisma.tenderItem.delete({ where: { id } });
      return true;
    },
    addTechnicalRequirement: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'tender.manage');
      return prisma.technicalRequirement.create({
        data: {
          tenderId: args.tenderId,
          tenderItemId: args.tenderItemId || null,
          attribute: args.attribute,
          requirement: args.requirement,
          type: args.type,
          category: args.category,
          weight: args.weight || 1.0,
        },
        include: { tender: true, tenderItem: true },
      });
    },
    updateTechnicalRequirement: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'tender.manage');
      return prisma.technicalRequirement.update({
        where: { id },
        data: args,
        include: { tender: true, tenderItem: true },
      });
    },
    deleteTechnicalRequirement: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'tender.manage');
      await prisma.technicalRequirement.delete({ where: { id } });
      return true;
    },
    publishTender: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'tender.manage');
      return prisma.tender.update({
        where: { id },
        data: { status: 'PUBLISHED' },
        include: { procurementRef: true, items: true },
      });
    },
    closeTender: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'tender.manage');
      return prisma.tender.update({
        where: { id },
        data: { status: 'CLOSED' },
        include: { procurementRef: true, items: true },
      });
    },
    cancelTender: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'tender.manage');
      await prisma.tender.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      return true;
    },

    createBid: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'tender.manage');
      const bidNumber = `B-${Date.now()}`;
      return prisma.bid.create({
        data: {
          bidNumber,
          tenderId: args.tenderId,
          supplierId: args.supplierId,
          bidSecurity: args.bidSecurity || null,
          totalPrice: args.totalPrice,
          deliveryPeriod: args.deliveryPeriod,
          validityPeriod: args.validityPeriod,
          notes: args.notes || null,
        },
        include: { tender: true, supplier: true },
      });
    },
    addBidItem: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'tender.manage');
      const totalPrice = args.quantity * args.unitPrice;
      return prisma.bidItem.create({
        data: {
          bidId: args.bidId,
          tenderItemId: args.tenderItemId || null,
          description: args.description,
          quantity: args.quantity,
          unitPrice: args.unitPrice,
          totalPrice,
          specifications: args.specifications || null,
        },
        include: { bid: true, tenderItem: true },
      });
    },
    updateBidItem: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'tender.manage');
      const data: any = { ...args };
      if (args.quantity !== undefined || args.unitPrice !== undefined) {
        const item = await prisma.bidItem.findUnique({ where: { id } });
        const quantity = args.quantity ?? item?.quantity;
        const unitPrice = args.unitPrice ?? item?.unitPrice;
        data.totalPrice = quantity * unitPrice;
      }
      return prisma.bidItem.update({
        where: { id },
        data,
        include: { bid: true, tenderItem: true },
      });
    },
    deleteBidItem: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'tender.manage');
      await prisma.bidItem.delete({ where: { id } });
      return true;
    },
    submitBid: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'tender.manage');
      return prisma.bid.update({
        where: { id },
        data: { status: 'SUBMITTED' },
        include: { tender: true, supplier: true },
      });
    },
    withdrawBid: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'tender.manage');
      await prisma.bid.update({
        where: { id },
        data: { status: 'WITHDRAWN' },
      });
      return true;
    },
    qualifyBid: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'tender.evaluate');
      return prisma.bid.update({
        where: { id },
        data: { status: 'QUALIFIED' },
        include: { tender: true, supplier: true },
      });
    },
    disqualifyBid: async (_: any, { id, reason }: any, { prisma, user }: any) => {
      requirePermission(user, 'tender.evaluate');
      return prisma.bid.update({
        where: { id },
        data: { status: 'DISQUALIFIED', notes: reason },
        include: { tender: true, supplier: true },
      });
    },

    evaluateTechnicalRequirement: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'tender.evaluate');
      return prisma.technicalEvaluation.create({
        data: {
          bidId: args.bidId,
          technicalRequirementId: args.technicalRequirementId,
          supplierResponse: args.supplierResponse || null,
          compliance: args.compliance,
          score: args.score || null,
          evaluatorId: user.id,
          comments: args.comments || null,
        },
        include: { bid: true, technicalRequirement: true, evaluator: true },
      });
    },
    evaluateFinancial: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'tender.evaluate');
      const bid = await prisma.bid.findUnique({ where: { id: args.bidId } });
      const totalEvaluatedPrice = (bid?.totalPrice || 0) + (args.deliveryCost || 0) + (args.taxes || 0);
      return prisma.financialEvaluation.upsert({
        where: { bidId: args.bidId },
        update: {
          deliveryCost: args.deliveryCost,
          taxes: args.taxes,
          totalEvaluatedPrice,
          priceScore: args.priceScore,
          comments: args.comments,
          evaluatorId: user.id,
        },
        create: {
          bidId: args.bidId,
          bidPrice: bid?.totalPrice || 0,
          deliveryCost: args.deliveryCost || null,
          taxes: args.taxes || null,
          totalEvaluatedPrice,
          priceScore: args.priceScore || null,
          evaluatorId: user.id,
          comments: args.comments || null,
        },
        include: { bid: true, evaluator: true },
      });
    },
    selectBid: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'tender.award');
      const bid = await prisma.bid.findUnique({ where: { id }, include: { tender: true } });
      
      // Update tender status
      if (bid?.tenderId) {
        await prisma.tender.update({
          where: { id: bid.tenderId },
          data: { status: 'AWARDED' },
        });
      }
      
      return prisma.bid.update({
        where: { id },
        data: { status: 'SELECTED' },
        include: { tender: true, supplier: true },
      });
    },

    createContract: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'procurement.manage');
      const contractNumber = `C-${Date.now()}`;
      return prisma.contract.create({
        data: {
          contractNumber,
          tenderId: args.tenderId || null,
          bidId: args.bidId || null,
          supplierId: args.supplierId,
          startDate: new Date(args.startDate),
          endDate: new Date(args.endDate),
          contractValue: args.contractValue,
          currency: 'ETB',
          paymentTerms: args.paymentTerms || null,
          deliveryTerms: args.deliveryTerms || null,
          description: args.description || null,
        },
        include: { tender: true, bid: true, supplier: true },
      });
    },
    updateContract: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'procurement.manage');
      const data: any = { ...args };
      if (args.endDate) data.endDate = new Date(args.endDate);
      return prisma.contract.update({
        where: { id },
        data,
        include: { tender: true, bid: true, supplier: true },
      });
    },
    addContractItem: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'procurement.manage');
      const totalPrice = args.quantity * args.unitPrice;
      return prisma.contractItem.create({
        data: {
          contractId: args.contractId,
          description: args.description,
          quantity: args.quantity,
          unit: args.unit,
          unitPrice: args.unitPrice,
          totalPrice,
        },
        include: { contract: true },
      });
    },
    updateContractItem: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'procurement.manage');
      const data: any = { ...args };
      if (args.quantity !== undefined || args.unitPrice !== undefined) {
        const item = await prisma.contractItem.findUnique({ where: { id } });
        const quantity = args.quantity ?? item?.quantity;
        const unitPrice = args.unitPrice ?? item?.unitPrice;
        data.totalPrice = quantity * unitPrice;
      }
      return prisma.contractItem.update({
        where: { id },
        data,
        include: { contract: true },
      });
    },
    deleteContractItem: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'procurement.manage');
      await prisma.contractItem.delete({ where: { id } });
      return true;
    },
    activateContract: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'procurement.manage');
      return prisma.contract.update({
        where: { id },
        data: { status: 'ACTIVE' },
        include: { tender: true, bid: true, supplier: true },
      });
    },
    terminateContract: async (_: any, { id, reason }: any, { prisma, user }: any) => {
      requirePermission(user, 'procurement.manage');
      return prisma.contract.update({
        where: { id },
        data: { status: 'TERMINATED', description: reason },
        include: { tender: true, bid: true, supplier: true },
      });
    },

    createGoodsReceipt: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'procurement.manage');
      const receiptNumber = `GR-${Date.now()}`;
      return prisma.goodsReceipt.create({
        data: {
          receiptNumber,
          purchaseOrderId: args.purchaseOrderId || null,
          contractId: args.contractId || null,
          supplierId: args.supplierId,
          warehouseId: args.warehouseId,
          deliveryNote: args.deliveryNote || null,
          receivedBy: user.id,
          notes: args.notes || null,
        },
        include: { purchaseOrder: true, contract: true, supplier: true, warehouse: true },
      });
    },
    addGoodsReceiptItem: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'procurement.manage');
      return prisma.goodsReceiptItem.create({
        data: {
          goodsReceiptId: args.goodsReceiptId,
          productId: args.productId,
          orderedQuantity: args.orderedQuantity,
          receivedQuantity: args.receivedQuantity,
          acceptedQuantity: args.acceptedQuantity,
          rejectedQuantity: args.rejectedQuantity || 0,
          damagedQuantity: args.damagedQuantity || 0,
          batchNumber: args.batchNumber || null,
          serialNumbers: args.serialNumbers || null,
          unitCost: args.unitCost,
        },
        include: { goodsReceipt: true, product: true },
      });
    },
    updateGoodsReceiptItem: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'procurement.manage');
      return prisma.goodsReceiptItem.update({
        where: { id },
        data: args,
        include: { goodsReceipt: true, product: true },
      });
    },
    inspectGoodsReceipt: async (_: any, { id, inspectedBy, inspectionDate }: any, { prisma, user }: any) => {
      requirePermission(user, 'procurement.manage');
      return prisma.goodsReceipt.update({
        where: { id },
        data: {
          inspectedBy,
          inspectionDate: inspectionDate ? new Date(inspectionDate) : new Date(),
          status: 'INSPECTED',
        },
        include: { supplier: true, warehouse: true, items: true },
      });
    },
    acceptGoodsReceipt: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'procurement.manage');
      const receipt = await prisma.goodsReceipt.findUnique({
        where: { id },
        include: { items: true },
      });
      
      // Update product stock
      for (const item of receipt?.items || []) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.acceptedQuantity } },
        });
      }
      
      return prisma.goodsReceipt.update({
        where: { id },
        data: { status: 'ACCEPTED' },
        include: { supplier: true, warehouse: true, items: true },
      });
    },
    rejectGoodsReceipt: async (_: any, { id, reason }: any, { prisma, user }: any) => {
      requirePermission(user, 'procurement.manage');
      return prisma.goodsReceipt.update({
        where: { id },
        data: { status: 'REJECTED', notes: reason },
        include: { supplier: true, warehouse: true, items: true },
      });
    },

    // Asset Management mutations (Phase 7)

    createAsset: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'asset.manage');
      const data: any = {
        assetNumber: args.assetNumber,
        serialNumber: args.serialNumber,
        name: args.name,
        category: args.category,
        purchaseCost: args.purchaseCost,
        currentValue: args.currentValue || args.purchaseCost,
      };
      if (args.description) data.description = args.description;
      if (args.model) data.model = args.model;
      if (args.manufacturer) data.manufacturer = args.manufacturer;
      if (args.purchaseDate) data.purchaseDate = new Date(args.purchaseDate);
      if (args.location) data.location = args.location;
      if (args.departmentId) data.departmentId = args.departmentId;
      if (args.warehouseId) data.warehouseId = args.warehouseId;
      if (args.condition) data.condition = args.condition;
      if (args.warrantyExpiry) data.warrantyExpiry = new Date(args.warrantyExpiry);
      
      return prisma.asset.create({
        data,
        include: { department: true, warehouse: true },
      });
    },
    updateAsset: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'asset.manage');
      const data: any = { ...args };
      if (args.warrantyExpiry) data.warrantyExpiry = new Date(args.warrantyExpiry);
      return prisma.asset.update({
        where: { id },
        data,
        include: { department: true, warehouse: true },
      });
    },
    deleteAsset: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'asset.manage');
      await prisma.asset.delete({ where: { id } });
      return true;
    },
    assignAsset: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'asset.assign');
      const assignment = await prisma.assetAssignment.create({
        data: {
          assetId: args.assetId,
          assignedTo: args.assignedTo,
          assignedBy: user.id,
          location: args.location || null,
          departmentId: args.departmentId || null,
          returnDate: args.returnDate ? new Date(args.returnDate) : null,
          notes: args.notes || null,
        },
        include: { asset: true, department: true },
      });
      
      // Update asset status
      await prisma.asset.update({
        where: { id: args.assetId },
        data: { status: 'ASSIGNED', assignedTo: args.assignedTo },
      });
      
      return assignment;
    },
    returnAsset: async (_: any, { id, conditionAfter, notes }: any, { prisma, user }: any) => {
      requirePermission(user, 'asset.assign');
      const assignment = await prisma.assetAssignment.update({
        where: { id },
        data: {
          status: 'RETURNED',
          conditionAfter,
          notes,
        },
        include: { asset: true },
      });
      
      // Update asset status
      await prisma.asset.update({
        where: { id: assignment.assetId },
        data: { status: 'IN_STOCK', assignedTo: null },
      });
      
      return assignment;
    },
    transferAsset: async (_: any, { id, newLocation, newDepartmentId, notes }: any, { prisma, user }: any) => {
      requirePermission(user, 'asset.assign');
      const assignment = await prisma.assetAssignment.update({
        where: { id },
        data: {
          status: 'TRANSFERRED',
          location: newLocation,
          departmentId: newDepartmentId,
          notes,
        },
        include: { asset: true },
      });
      
      return assignment;
    },

    createAssetMaintenance: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'asset.maintain');
      const data: any = {
        assetId: args.assetId,
        maintenanceType: args.maintenanceType,
        description: args.description,
      };
      if (args.scheduledDate) data.scheduledDate = new Date(args.scheduledDate);
      if (args.technician) data.technician = args.technician;
      if (args.serviceProvider) data.serviceProvider = args.serviceProvider;
      if (args.cost) data.cost = args.cost;
      if (args.partsUsed) data.partsUsed = args.partsUsed;
      if (args.downtime) data.downtime = args.downtime;
      if (args.nextMaintenanceDate) data.nextMaintenanceDate = new Date(args.nextMaintenanceDate);
      if (args.notes) data.notes = args.notes;
      
      return prisma.assetMaintenance.create({
        data,
        include: { asset: true },
      });
    },
    updateAssetMaintenance: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'asset.maintain');
      const data: any = { ...args };
      if (args.completedDate) data.completedDate = new Date(args.completedDate);
      if (args.nextMaintenanceDate) data.nextMaintenanceDate = new Date(args.nextMaintenanceDate);
      return prisma.assetMaintenance.update({
        where: { id },
        data,
        include: { asset: true },
      });
    },
    completeAssetMaintenance: async (_: any, { id, notes }: any, { prisma, user }: any) => {
      requirePermission(user, 'asset.maintain');
      const maintenance = await prisma.assetMaintenance.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedDate: new Date(),
          notes,
        },
        include: { asset: true },
      });
      
      // Update asset status back to available
      await prisma.asset.update({
        where: { id: maintenance.assetId },
        data: { status: 'IN_STOCK' },
      });
      
      return maintenance;
    },
    cancelAssetMaintenance: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'asset.maintain');
      await prisma.assetMaintenance.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      return true;
    },

    createAssetDisposal: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'asset.dispose');
      return prisma.assetDisposal.create({
        data: {
          assetId: args.assetId,
          disposalType: args.disposalType,
          reason: args.reason || null,
          disposalValue: args.disposalValue || null,
          recipient: args.recipient || null,
          notes: args.notes || null,
          disposedBy: user.id,
        },
        include: { asset: true },
      });
    },
    approveAssetDisposal: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'asset.dispose');
      const disposal = await prisma.assetDisposal.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy: user.id,
        },
        include: { asset: true },
      });
      
      // Update asset status
      await prisma.asset.update({
        where: { id: disposal.assetId },
        data: { status: 'RETIRED' },
      });
      
      return disposal;
    },
    completeAssetDisposal: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'asset.dispose');
      const disposal = await prisma.assetDisposal.update({
        where: { id },
        data: { status: 'COMPLETED' },
        include: { asset: true },
      });
      
      // Update asset status to disposed
      await prisma.asset.update({
        where: { id: disposal.assetId },
        data: { status: 'DISPOSED' },
      });
      
      return disposal;
    },
    cancelAssetDisposal: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'asset.dispose');
      await prisma.assetDisposal.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      return true;
    },

    // Workflow & Approval mutations (Phase 7)

    createWorkflow: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'audit.manage');
      return prisma.workflow.create({
        data: {
          name: args.name,
          description: args.description || null,
          entityType: args.entityType,
        },
        include: { steps: true },
      });
    },
    updateWorkflow: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'audit.manage');
      return prisma.workflow.update({
        where: { id },
        data: args,
        include: { steps: true },
      });
    },
    deleteWorkflow: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'audit.manage');
      await prisma.workflow.delete({ where: { id } });
      return true;
    },
    addWorkflowStep: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'audit.manage');
      return prisma.workflowStep.create({
        data: {
          workflowId: args.workflowId,
          stepNumber: args.stepNumber,
          name: args.name,
          description: args.description || null,
          role: args.role,
          required: args.required,
          autoApprove: args.autoApprove,
        },
        include: { workflow: true },
      });
    },
    updateWorkflowStep: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requirePermission(user, 'audit.manage');
      return prisma.workflowStep.update({
        where: { id },
        data: args,
        include: { workflow: true },
      });
    },
    deleteWorkflowStep: async (_: any, { id }: any, { prisma, user }: any) => {
      requirePermission(user, 'audit.manage');
      await prisma.workflowStep.delete({ where: { id } });
      return true;
    },
    createApproval: async (_: any, args: any, { prisma, user }: any) => {
      requirePermission(user, 'approval.review');
      return prisma.approval.create({
        data: {
          entityType: args.entityType,
          entityId: args.entityId,
          workflowStepId: args.workflowStepId || null,
          approverId: args.approverId,
        },
        include: { approver: true, workflowStep: true },
      });
    },
    approveRequest: async (_: any, { approvalId, comments }: any, { prisma, user }: any) => {
      requirePermission(user, 'approval.approve');
      const approval = await prisma.approval.update({
        where: { id: approvalId },
        data: {
          status: 'APPROVED',
          decisionDate: new Date(),
          comments,
          approverId: user.id,
        },
        include: { approver: true, workflowStep: true },
      });
      
      // Update entity status if needed
      // This would be expanded based on entity type
      
      return approval;
    },
    rejectRequest: async (_: any, { approvalId, comments }: any, { prisma, user }: any) => {
      requirePermission(user, 'approval.approve');
      const approval = await prisma.approval.update({
        where: { id: approvalId },
        data: {
          status: 'REJECTED',
          decisionDate: new Date(),
          comments,
          approverId: user.id,
        },
        include: { approver: true, workflowStep: true },
      });
      
      return approval;
    },
    returnRequest: async (_: any, { approvalId, comments }: any, { prisma, user }: any) => {
      requirePermission(user, 'approval.approve');
      const approval = await prisma.approval.update({
        where: { id: approvalId },
        data: {
          status: 'RETURNED',
          decisionDate: new Date(),
          comments,
          approverId: user.id,
        },
        include: { approver: true, workflowStep: true },
      });
      
      return approval;
    },

    // Audit & Risk mutations (Phase 9)

    createActivityLog: async (_: any, args: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      return prisma.activityLog.create({
        data: {
          userId: user.id,
          action: args.action,
          entityType: args.entityType || null,
          entityId: args.entityId || null,
          details: args.details || null,
          oldValue: args.oldValue || null,
          newValue: args.newValue || null,
          changes: args.changes || null,
        },
        include: { user: true },
      });
    },
    resolveRiskIndicator: async (_: any, { id, resolvedBy, resolution }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      return prisma.riskIndicator.update({
        where: { id },
        data: {
          status: 'RESOLVED',
          resolvedBy,
          resolvedAt: new Date(),
          description: resolution,
        },
      });
    },
    ignoreRiskIndicator: async (_: any, { id, reason }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      return prisma.riskIndicator.update({
        where: { id },
        data: {
          status: 'IGNORED',
          description: reason,
        },
      });
    },
    createRiskIndicator: async (_: any, args: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      return prisma.riskIndicator.create({
        data: {
          entityType: args.entityType,
          entityId: args.entityId,
          riskType: args.riskType,
          severity: args.severity || 'LOW',
          description: args.description || null,
          confidence: args.confidence || null,
          metadata: args.metadata || null,
        },
      });
    },
    detectRisks: async (_: any, { entityType }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      const detectedRisks = [];
      
      // Stock out risk detection
      if (entityType === 'PRODUCT' || entityType === 'ALL') {
        const lowStockProducts = await prisma.product.findMany({
          where: { stock: { lte: 5 }, status: 'ACTIVE' },
        });
        
        for (const product of lowStockProducts) {
          const severity = product.stock === 0 ? 'CRITICAL' : product.stock <= 2 ? 'HIGH' : 'MEDIUM';
          detectedRisks.push({
            entityType: 'PRODUCT',
            entityId: product.id,
            riskType: 'STOCK_OUT',
            severity,
            description: `Product ${product.name} has low stock (${product.stock})`,
            confidence: 1.0,
          });
        }
      }
      
      // Expiry risk detection
      if (entityType === 'PRODUCT' || entityType === 'ALL') {
        const expiringBatches = await prisma.itemBatch.findMany({
          where: {
            expiryDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
            status: 'ACTIVE',
            currentQuantity: { gt: 0 },
          },
        });
        
        for (const batch of expiringBatches) {
          const daysToExpiry = Math.floor((new Date(batch.expiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
          const severity = daysToExpiry <= 7 ? 'CRITICAL' : daysToExpiry <= 14 ? 'HIGH' : 'MEDIUM';
          detectedRisks.push({
            entityType: 'ITEM_BATCH',
            entityId: batch.id,
            riskType: 'EXPIRY',
            severity,
            description: `Batch ${batch.batchNumber} expires in ${daysToExpiry} days`,
            confidence: 1.0,
          });
        }
      }
      
      // Warranty expiry risk
      if (entityType === 'ASSET' || entityType === 'ALL') {
        const expiringWarranties = await prisma.asset.findMany({
          where: {
            warrantyExpiry: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
            status: { in: ['IN_STOCK', 'IN_USE', 'ASSIGNED'] },
          },
        });
        
        for (const asset of expiringWarranties) {
          const daysToExpiry = Math.floor((new Date(asset.warrantyExpiry).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
          const severity = daysToExpiry <= 7 ? 'CRITICAL' : daysToExpiry <= 14 ? 'HIGH' : 'MEDIUM';
          detectedRisks.push({
            entityType: 'ASSET',
            entityId: asset.id,
            riskType: 'WARRANTY',
            severity,
            description: `Asset ${asset.name} warranty expires in ${daysToExpiry} days`,
            confidence: 1.0,
          });
        }
      }
      
      // Overdue maintenance
      if (entityType === 'ASSET' || entityType === 'ALL') {
        const overdueMaintenance = await prisma.assetMaintenance.findMany({
          where: {
            status: 'SCHEDULED',
            scheduledDate: { lte: new Date() },
          },
        });
        
        for (const maintenance of overdueMaintenance) {
          const daysOverdue = Math.floor((Date.now() - new Date(maintenance.scheduledDate).getTime()) / (24 * 60 * 60 * 1000));
          const severity = daysOverdue >= 30 ? 'CRITICAL' : daysOverdue >= 14 ? 'HIGH' : 'MEDIUM';
          detectedRisks.push({
            entityType: 'ASSET_MAINTENANCE',
            entityId: maintenance.id,
            riskType: 'DELAY',
            severity,
            description: `Maintenance overdue by ${daysOverdue} days`,
            confidence: 0.9,
          });
        }
      }
      
      // Create detected risks
      for (const risk of detectedRisks) {
        await prisma.riskIndicator.create({
          data: risk,
        });
      }
      
      return detectedRisks;
    },

    // Document mutations (Phase 8)

    deleteDocument: async (_: any, { id }: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN');
      const doc = await prisma.document.findUnique({ where: { id } });
      if (!doc) throw new Error('Document not found');
      
      await prisma.document.delete({ where: { id } });
      return true;
    },
    updateDocument: async (_: any, { id, ...args }: any, { prisma, user }: any) => {
      requireAuth(user);
      const doc = await prisma.document.findUnique({ where: { id } });
      if (!doc) throw new Error('Document not found');
      
      // Check access
      if (doc.uploadedBy !== user.id && user.role !== 'ADMIN') {
        throw new Error('Access denied');
      }
      
      const data: any = { ...args };
      if (args.expiryDate) data.expiryDate = new Date(args.expiryDate);
      
      return prisma.document.update({
        where: { id },
        data,
      });
    },

    // Notification mutations (Phase 11)

    markNotificationRead: async (_: any, { id }: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.notification.update({
        where: { id, userId: user.id },
        data: { isRead: true, readAt: new Date() },
      });
    },
    markAllNotificationsRead: async (_: any, __: any, { prisma, user }: any) => {
      requireAuth(user);
      await prisma.notification.updateMany({
        where: { userId: user.id, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
      return true;
    },
    updateNotificationPreference: async (_: any, args: any, { prisma, user }: any) => {
      requireAuth(user);
      return prisma.notificationPreference.upsert({
        where: { userId: user.id },
        update: args,
        create: { userId: user.id, ...args },
      });
    },
    createNotification: async (_: any, args: any, { prisma, user }: any) => {
      requireAuth(user);
      requireRole(user, 'ADMIN', 'MANAGER');
      
      return prisma.notification.create({
        data: {
          userId: args.userId,
          type: args.type,
          title: args.title,
          message: args.message,
          entityType: args.entityType || null,
          entityId: args.entityId || null,
          priority: args.priority || 'NORMAL',
          actionUrl: args.actionUrl || null,
        },
        include: { user: true },
      });
    },
  },
};
