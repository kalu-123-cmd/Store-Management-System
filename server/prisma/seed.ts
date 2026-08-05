import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Users
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@store.com' },
    update: {},
    create: { name: 'Admin User', email: 'admin@store.com', password: adminPassword, role: 'ADMIN' },
  });

  const managerPassword = await bcrypt.hash('manager123', 10);
  await prisma.user.upsert({
    where: { email: 'manager@store.com' },
    update: {},
    create: { name: 'Store Manager', email: 'manager@store.com', password: managerPassword, role: 'MANAGER' },
  });

  const cashierPassword = await bcrypt.hash('cashier123', 10);
  await prisma.user.upsert({
    where: { email: 'cashier@store.com' },
    update: {},
    create: { name: 'Cashier One', email: 'cashier@store.com', password: cashierPassword, role: 'CASHIER' },
  });

  // Categories
  const electronics = await prisma.category.upsert({
    where: { name: 'Electronics' }, update: {},
    create: { name: 'Electronics', description: 'Electronic devices and accessories' },
  });
  const clothing = await prisma.category.upsert({
    where: { name: 'Clothing' }, update: {},
    create: { name: 'Clothing', description: 'Apparel and fashion items' },
  });
  const food = await prisma.category.upsert({
    where: { name: 'Food & Beverages' }, update: {},
    create: { name: 'Food & Beverages', description: 'Consumable goods' },
  });
  const furniture = await prisma.category.upsert({
    where: { name: 'Furniture' }, update: {},
    create: { name: 'Furniture', description: 'Home and office furniture' },
  });

  // Suppliers — use upsert keyed on email to be idempotent
  const techSupplier = await prisma.supplier.upsert({
    where: { id: 'supplier-tech-001' },
    update: {},
    create: { id: 'supplier-tech-001', name: 'TechVision Ltd', contactName: 'James Lee', email: 'james@techvision.com', phone: '+1-555-0101', address: '100 Tech Park, San Francisco, CA' },
  });
  const fashionSupplier = await prisma.supplier.upsert({
    where: { id: 'supplier-fashion-001' },
    update: {},
    create: { id: 'supplier-fashion-001', name: 'FashionHub Inc', contactName: 'Sarah Chen', email: 'sarah@fashionhub.com', phone: '+1-555-0202', address: '200 Fashion Blvd, New York, NY' },
  });
  const foodSupplier = await prisma.supplier.upsert({
    where: { id: 'supplier-food-001' },
    update: {},
    create: { id: 'supplier-food-001', name: 'FreshFoods Co', contactName: 'David Kim', email: 'david@freshfoods.com', phone: '+1-555-0303', address: '300 Market St, Chicago, IL' },
  });

  // Customers — upsert on email
  const customer1 = await prisma.customer.upsert({
    where: { id: 'customer-001' },
    update: {},
    create: { id: 'customer-001', name: 'Alice Johnson', email: 'alice@example.com', phone: '+1-555-1001' },
  });
  const customer2 = await prisma.customer.upsert({
    where: { id: 'customer-002' },
    update: {},
    create: { id: 'customer-002', name: 'Bob Smith', email: 'bob@example.com', phone: '+1-555-1002' },
  });
  const customer3 = await prisma.customer.upsert({
    where: { id: 'customer-003' },
    update: {},
    create: { id: 'customer-003', name: 'Carol White', email: 'carol@example.com', phone: '+1-555-1003' },
  });

  // Products — upsert on SKU
  const laptop = await prisma.product.upsert({
    where: { sku: 'TECH-001' }, update: {},
    create: { name: 'MacBook Pro 16"', sku: 'TECH-001', barcode: '123456789001', costPrice: 1800, sellingPrice: 2499, stock: 25, minStockLevel: 5, categoryId: electronics.id, supplierId: techSupplier.id, description: 'Apple MacBook Pro with M3 chip' },
  });
  const phone = await prisma.product.upsert({
    where: { sku: 'TECH-002' }, update: {},
    create: { name: 'iPhone 15 Pro', sku: 'TECH-002', barcode: '123456789002', costPrice: 900, sellingPrice: 1299, stock: 39, minStockLevel: 10, categoryId: electronics.id, supplierId: techSupplier.id, description: 'Latest iPhone with titanium design' },
  });
  const headphones = await prisma.product.upsert({
    where: { sku: 'TECH-003' }, update: {},
    create: { name: 'Sony WH-1000XM5', sku: 'TECH-003', barcode: '123456789003', costPrice: 200, sellingPrice: 349, stock: 7, minStockLevel: 10, categoryId: electronics.id, supplierId: techSupplier.id, description: 'Premium noise-canceling headphones' },
  });
  const tablet = await prisma.product.upsert({
    where: { sku: 'TECH-004' }, update: {},
    create: { name: 'iPad Air M2', sku: 'TECH-004', barcode: '123456789004', costPrice: 450, sellingPrice: 699, stock: 0, minStockLevel: 5, categoryId: electronics.id, supplierId: techSupplier.id, status: 'OUT_OF_STOCK' },
  });
  const watch = await prisma.product.upsert({
    where: { sku: 'TECH-005' }, update: {},
    create: { name: 'Apple Watch Ultra 2', sku: 'TECH-005', barcode: '123456789009', costPrice: 600, sellingPrice: 799, stock: 18, minStockLevel: 5, categoryId: electronics.id, supplierId: techSupplier.id, description: 'Rugged smartwatch for adventure' },
  });
  const shirt = await prisma.product.upsert({
    where: { sku: 'CLO-001' }, update: {},
    create: { name: 'Premium Cotton T-Shirt', sku: 'CLO-001', barcode: '123456789005', costPrice: 15, sellingPrice: 39.99, stock: 150, minStockLevel: 20, categoryId: clothing.id, supplierId: fashionSupplier.id },
  });
  const jeans = await prisma.product.upsert({
    where: { sku: 'CLO-002' }, update: {},
    create: { name: 'Slim Fit Denim Jeans', sku: 'CLO-002', barcode: '123456789006', costPrice: 40, sellingPrice: 89.99, stock: 75, minStockLevel: 15, categoryId: clothing.id, supplierId: fashionSupplier.id },
  });
  const sneakers = await prisma.product.upsert({
    where: { sku: 'CLO-003' }, update: {},
    create: { name: 'Running Sneakers Pro', sku: 'CLO-003', barcode: '123456789010', costPrice: 65, sellingPrice: 129.99, stock: 3, minStockLevel: 8, categoryId: clothing.id, supplierId: fashionSupplier.id },
  });
  const coffee = await prisma.product.upsert({
    where: { sku: 'FOO-001' }, update: {},
    create: { name: 'Arabica Coffee Beans 1kg', sku: 'FOO-001', barcode: '123456789007', costPrice: 12, sellingPrice: 24.99, stock: 200, minStockLevel: 30, categoryId: food.id, supplierId: foodSupplier.id },
  });
  const tea = await prisma.product.upsert({
    where: { sku: 'FOO-002' }, update: {},
    create: { name: 'Green Tea Premium 500g', sku: 'FOO-002', barcode: '123456789011', costPrice: 8, sellingPrice: 18.99, stock: 120, minStockLevel: 20, categoryId: food.id, supplierId: foodSupplier.id },
  });
  const desk = await prisma.product.upsert({
    where: { sku: 'FUR-001' }, update: {},
    create: { name: 'Standing Desk 160cm', sku: 'FUR-001', barcode: '123456789008', costPrice: 350, sellingPrice: 599, stock: 12, minStockLevel: 3, categoryId: furniture.id, description: 'Electric height-adjustable desk' },
  });
  const chair = await prisma.product.upsert({
    where: { sku: 'FUR-002' }, update: {},
    create: { name: 'Ergonomic Office Chair', sku: 'FUR-002', barcode: '123456789012', costPrice: 280, sellingPrice: 449, stock: 9, minStockLevel: 3, categoryId: furniture.id, description: 'Lumbar support mesh chair' },
  });

  // Sales — only create if none exist yet
  const existingSales = await prisma.sale.count();
  if (existingSales === 0) {
    const sale1 = await prisma.sale.create({
      data: {
        invoiceNo: 'INV-1001', totalAmount: 1299, customerId: customer1.id, userId: admin.id,
        items: { create: [{ productId: phone.id, quantity: 1, price: 1299 }] },
      },
    });

    const sale2 = await prisma.sale.create({
      data: {
        invoiceNo: 'INV-1002', totalAmount: 2848, customerId: customer2.id, userId: admin.id,
        items: { create: [
          { productId: laptop.id, quantity: 1, price: 2499 },
          { productId: headphones.id, quantity: 1, price: 349 },
        ]},
      },
    });

    await prisma.sale.create({
      data: {
        invoiceNo: 'INV-1003', totalAmount: 154.97, customerId: customer3.id, userId: admin.id,
        items: { create: [
          { productId: shirt.id, quantity: 2, price: 39.99 },
          { productId: coffee.id, quantity: 3, price: 24.99 },
        ]},
      },
    });

    await prisma.sale.create({
      data: {
        invoiceNo: 'INV-1004', totalAmount: 799, customerId: customer1.id, userId: admin.id,
        items: { create: [{ productId: watch.id, quantity: 1, price: 799 }] },
      },
    });

    await prisma.sale.create({
      data: {
        invoiceNo: 'INV-1005', totalAmount: 449.98, customerId: customer2.id, userId: admin.id,
        items: { create: [
          { productId: jeans.id, quantity: 2, price: 89.99 },
          { productId: shirt.id, quantity: 2, price: 39.99 },
          { productId: tea.id, quantity: 4, price: 18.99 },
        ]},
      },
    });

    // Transactions
    await prisma.transaction.createMany({
      data: [
        { productId: phone.id, quantity: 40, type: 'IN', notes: 'Initial stock', userId: admin.id },
        { productId: laptop.id, quantity: 25, type: 'IN', notes: 'Initial stock', userId: admin.id },
        { productId: headphones.id, quantity: 10, type: 'IN', notes: 'Initial stock', userId: admin.id },
        { productId: shirt.id, quantity: 150, type: 'IN', notes: 'Initial stock', userId: admin.id },
        { productId: coffee.id, quantity: 200, type: 'IN', notes: 'Initial stock', userId: admin.id },
        { productId: watch.id, quantity: 20, type: 'IN', notes: 'Initial stock', userId: admin.id },
        { productId: jeans.id, quantity: 75, type: 'IN', notes: 'Initial stock', userId: admin.id },
        { productId: sneakers.id, quantity: 15, type: 'IN', notes: 'Initial stock', userId: admin.id },
        { productId: sneakers.id, quantity: 12, type: 'OUT', notes: 'Defective batch return', userId: admin.id },
        { productId: phone.id, quantity: 1, type: 'OUT', notes: 'Sale INV-1001', userId: admin.id },
        { productId: laptop.id, quantity: 1, type: 'OUT', notes: 'Sale INV-1002', userId: admin.id },
        { productId: headphones.id, quantity: 1, type: 'OUT', notes: 'Sale INV-1002', userId: admin.id },
        { productId: watch.id, quantity: 1, type: 'OUT', notes: 'Sale INV-1004', userId: admin.id },
      ],
    });

    // Activity logs
    await prisma.activityLog.createMany({
      data: [
        { userId: admin.id, action: 'USER_LOGGED_IN', details: 'Admin logged in from 127.0.0.1' },
        { userId: admin.id, action: 'PRODUCT_CREATED', details: 'Created product: MacBook Pro 16"' },
        { userId: admin.id, action: 'PRODUCT_CREATED', details: 'Created product: iPhone 15 Pro' },
        { userId: admin.id, action: 'PRODUCT_CREATED', details: 'Created product: Sony WH-1000XM5' },
        { userId: admin.id, action: 'SALE_COMPLETED', details: 'Sale INV-1001 for $1299.00' },
        { userId: admin.id, action: 'SALE_COMPLETED', details: 'Sale INV-1002 for $2848.00' },
        { userId: admin.id, action: 'SALE_COMPLETED', details: 'Sale INV-1003 for $154.97' },
        { userId: admin.id, action: 'STOCK_ADJUSTED', details: 'OUT 12 units of Running Sneakers Pro (defective)' },
        { userId: admin.id, action: 'SALE_COMPLETED', details: 'Sale INV-1004 for $799.00' },
        { userId: admin.id, action: 'SALE_COMPLETED', details: 'Sale INV-1005 for $449.98' },
      ],
    });
  }

  console.log('');
  console.log('✅ Database seeded successfully!');
  console.log('');
  console.log('Login credentials:');
  console.log('  Admin:   admin@store.com / admin123');
  console.log('  Manager: manager@store.com / manager123');
  console.log('  Cashier: cashier@store.com / cashier123');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
