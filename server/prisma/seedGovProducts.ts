/**
 * Seed Government Institution Store Products
 * Run: npx tsx prisma/seedGovProducts.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const products = [
  { sku: 'GOV-001', name: 'A4 Copy Paper 80gsm',       category: 'Office Supplies',    stock: 120, minStockLevel: 20, costPrice: 650,  supplier: 'National Office Supplies' },
  { sku: 'GOV-002', name: 'Ballpoint Pen Blue',          category: 'Stationery',         stock: 50,  minStockLevel: 10, costPrice: 180,  supplier: 'Addis Stationery Supplier' },
  { sku: 'GOV-003', name: 'Ballpoint Pen Black',         category: 'Stationery',         stock: 45,  minStockLevel: 10, costPrice: 180,  supplier: 'Addis Stationery Supplier' },
  { sku: 'GOV-004', name: 'File Folder A4',              category: 'Office Supplies',    stock: 200, minStockLevel: 30, costPrice: 35,   supplier: 'Government Office Supply' },
  { sku: 'GOV-005', name: 'Lever Arch File',             category: 'Office Supplies',    stock: 100, minStockLevel: 20, costPrice: 95,   supplier: 'Government Office Supply' },
  { sku: 'GOV-006', name: 'Stapler Medium',              category: 'Office Equipment',   stock: 25,  minStockLevel: 5,  costPrice: 220,  supplier: 'Addis Office Equipment' },
  { sku: 'GOV-007', name: 'Staples No.10',               category: 'Stationery',         stock: 60,  minStockLevel: 10, costPrice: 45,   supplier: 'Addis Stationery Supplier' },
  { sku: 'GOV-008', name: 'Printer Toner HP 85A',        category: 'IT & Printing',      stock: 15,  minStockLevel: 3,  costPrice: 2800, supplier: 'Ethiopian ICT Supplier' },
  { sku: 'GOV-009', name: 'Printer Toner HP 12A',        category: 'IT & Printing',      stock: 12,  minStockLevel: 3,  costPrice: 3200, supplier: 'Ethiopian ICT Supplier' },
  { sku: 'GOV-010', name: 'USB Flash Drive 32GB',        category: 'IT Equipment',       stock: 30,  minStockLevel: 5,  costPrice: 450,  supplier: 'Ethiopian ICT Supplier' },
  { sku: 'GOV-011', name: 'Computer Keyboard',           category: 'IT Equipment',       stock: 20,  minStockLevel: 5,  costPrice: 550,  supplier: 'Ethiopian ICT Supplier' },
  { sku: 'GOV-012', name: 'Computer Mouse',              category: 'IT Equipment',       stock: 25,  minStockLevel: 5,  costPrice: 350,  supplier: 'Ethiopian ICT Supplier' },
  { sku: 'GOV-013', name: 'HDMI Cable',                  category: 'IT Equipment',       stock: 15,  minStockLevel: 3,  costPrice: 250,  supplier: 'Ethiopian ICT Supplier' },
  { sku: 'GOV-014', name: 'Desk Calendar',               category: 'Office Supplies',    stock: 80,  minStockLevel: 15, costPrice: 75,   supplier: 'Government Office Supply' },
  { sku: 'GOV-015', name: 'Official Receipt Book',       category: 'Official Documents', stock: 100, minStockLevel: 20, costPrice: 60,   supplier: 'Government Printing Supplier' },
  { sku: 'GOV-016', name: 'Payment Voucher Book',        category: 'Official Documents', stock: 80,  minStockLevel: 15, costPrice: 65,   supplier: 'Government Printing Supplier' },
  { sku: 'GOV-017', name: 'Purchase Request Form',       category: 'Official Documents', stock: 100, minStockLevel: 20, costPrice: 45,   supplier: 'Government Printing Supplier' },
  { sku: 'GOV-018', name: 'Attendance Register',         category: 'Official Documents', stock: 50,  minStockLevel: 10, costPrice: 90,   supplier: 'Government Printing Supplier' },
  { sku: 'GOV-019', name: 'Cleaning Detergent 1L',       category: 'Cleaning Supplies',  stock: 40,  minStockLevel: 10, costPrice: 120,  supplier: 'General Supply Ethiopia' },
  { sku: 'GOV-020', name: 'Liquid Hand Soap 500ml',      category: 'Cleaning Supplies',  stock: 60,  minStockLevel: 15, costPrice: 85,   supplier: 'General Supply Ethiopia' },
  { sku: 'GOV-021', name: 'Toilet Paper',                category: 'Cleaning Supplies',  stock: 100, minStockLevel: 20, costPrice: 95,   supplier: 'General Supply Ethiopia' },
  { sku: 'GOV-022', name: 'Garbage Bag Large',           category: 'Cleaning Supplies',  stock: 80,  minStockLevel: 15, costPrice: 130,  supplier: 'General Supply Ethiopia' },
  { sku: 'GOV-023', name: 'Drinking Water 1L',           category: 'Refreshments',       stock: 200, minStockLevel: 50, costPrice: 25,   supplier: 'Local Water Supplier' },
  { sku: 'GOV-024', name: 'Coffee',                      category: 'Refreshments',       stock: 30,  minStockLevel: 5,  costPrice: 450,  supplier: 'Local Coffee Supplier' },
  { sku: 'GOV-025', name: 'Sugar',                       category: 'Refreshments',       stock: 50,  minStockLevel: 10, costPrice: 95,   supplier: 'General Supply Ethiopia' },
];

async function main() {
  console.log('Seeding government institution products...');

  // Get or create admin user for audit trail
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminUser) {
    console.error('No admin user found. Run the main seed first: npx tsx prisma/seed.ts');
    process.exit(1);
  }

  let created = 0, updated = 0, skipped = 0;

  for (const p of products) {
    // Find or create category
    let category = await prisma.category.findUnique({ where: { name: p.category } });
    if (!category) {
      category = await prisma.category.create({ data: { name: p.category } });
      console.log(`  Created category: ${p.category}`);
    }

    // Find or create supplier
    let supplier = await prisma.supplier.findFirst({ where: { name: p.supplier } });
    if (!supplier) {
      supplier = await prisma.supplier.create({ data: { name: p.supplier } });
      console.log(`  Created supplier: ${p.supplier}`);
    }

    // Check if product already exists
    const existing = await prisma.product.findUnique({ where: { sku: p.sku } });

    if (existing) {
      // Update existing product
      await prisma.product.update({
        where: { sku: p.sku },
        data: {
          name:          p.name,
          categoryId:    category.id,
          supplierId:    supplier.id,
          costPrice:     p.costPrice,
          sellingPrice:  p.costPrice,  // default selling = cost for government stores
          stock:         p.stock,
          minStockLevel: p.minStockLevel,
          status:        'ACTIVE',
        },
      });
      updated++;
    } else {
      // Create new product
      const newProduct = await prisma.product.create({
        data: {
          name:          p.name,
          sku:           p.sku,
          categoryId:    category.id,
          supplierId:    supplier.id,
          costPrice:     p.costPrice,
          sellingPrice:  p.costPrice,  // default selling = cost for government stores
          stock:         p.stock,
          minStockLevel: p.minStockLevel,
          status:        'ACTIVE',
        },
      });

      // Record initial stock in inventory ledger
      await (prisma as any).inventoryMovement.create({
        data: {
          productId:     newProduct.id,
          movementType:  'STOCK_IN',
          quantity:      p.stock,
          previousStock: 0,
          newStock:      p.stock,
          referenceType: 'ADJUSTMENT',
          unitCost:      p.costPrice,
          userId:        adminUser.id,
          notes:         'Initial stock — Government Institution seed',
        },
      });

      // Legacy transaction record
      await prisma.transaction.create({
        data: {
          productId:       newProduct.id,
          quantity:        p.stock,
          type:            'IN',
          notes:           'Initial stock — Government Institution seed',
          userId:          adminUser.id,
          unitPrice:       p.costPrice,
          subtotal:        p.stock * p.costPrice,
          vatAmount:       0,
          totalAmount:     p.stock * p.costPrice,
          clearanceStatus: 'CLEARED',
        },
      });

      created++;
    }
  }

  // Audit log
  await prisma.activityLog.create({
    data: {
      userId:     adminUser.id,
      action:     'CSV_SYNCHRONIZATION',
      entityType: 'IMPORT',
      details:    `Government institution products seeded: ${created} created, ${updated} updated, ${skipped} skipped`,
    },
  });

  console.log(`\nDone! Created: ${created} | Updated: ${updated} | Skipped: ${skipped}`);
  console.log('Products are now visible in the Products, Inventory, and Dashboard pages.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
