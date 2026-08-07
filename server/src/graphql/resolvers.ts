import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_jwt_key_12345';

function requireAuth(user: any) {
  if (!user) throw new Error('Not authenticated');
}

function requireRole(user: any, ...roles: string[]) {
  requireAuth(user);
  if (!roles.includes(user.role)) throw new Error('Not authorized');
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
      return prisma.user.findUnique({ where: { id: user.id } });
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

    activityLogs: async (_: any, __: any, { prisma, user }: any) => {
      requireRole(user, 'ADMIN', 'MANAGER');
      const logs = await prisma.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { user: true } });
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
  },
};
