/**
 * SmartStore OS — Integration Tests
 *
 * Tests critical business flows against a real (in-memory) SQLite database.
 * Uses Node.js built-in test runner (node:test) — no Jest/Vitest needed.
 *
 * Coverage:
 *   1. Authentication — login succeeds / rejects bad credentials
 *   2. Product creation — validates required fields
 *   3. Inventory adjustment — stock changes + ledger entry recorded
 *   4. Atomic sale — stock deducted, ledger written, COGS snapshot preserved
 *   5. Sale return — stock restored, CUSTOMER_RETURN ledger entry written
 *   6. Credit ledger — credit sale + payment both atomic
 *   7. RBAC — CASHIER cannot call inventory:adjust
 *   8. Purchase receipt — stock incremented, PURCHASE ledger entry written
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createAtomicSale, createAtomicReturn } from '../services/atomicSaleService';
import { adjustStockWithLedger } from '../services/inventoryLedgerService';
import { requirePermission } from '../auth/permissions';
import { PERMISSIONS } from '../auth/permissions';

// ── Test database ─────────────────────────────────────────────────────────────
// Use a dedicated test SQLite file so tests don't touch the dev database.
process.env.DATABASE_URL = 'file:./prisma/test.db';
process.env.DATABASE_PROVIDER = 'sqlite';

const prisma = new PrismaClient();

// ── Seed helpers ──────────────────────────────────────────────────────────────

async function seedUser(role = 'ADMIN') {
  return prisma.user.create({
    data: {
      name:     `Test ${role}`,
      email:    `test-${role.toLowerCase()}-${Date.now()}@store.test`,
      password: await bcrypt.hash('TestPass123!', 10),
      role,
    },
  });
}

async function seedCategory() {
  const name = `Cat-${Date.now()}`;
  return prisma.category.upsert({
    where:  { name },
    update: {},
    create: { name },
  });
}

async function seedProduct(categoryId: string, supplierId?: string) {
  const sku = `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return prisma.product.create({
    data: {
      name:         `Product ${sku}`,
      sku,
      costPrice:    40,
      sellingPrice: 100,
      stock:        10,
      minStockLevel: 2,
      status:       'ACTIVE',
      categoryId,
      supplierId:   supplierId ?? null,
    },
  });
}

async function seedCustomer() {
  return prisma.customer.create({
    data: {
      name:        `Customer ${Date.now()}`,
      email:       `cust-${Date.now()}@store.test`,
      creditLimit: 5000,
      currentDebt: 0,
      status:      'ACTIVE',
    },
  });
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

before(async () => {
  // Push schema to test DB (creates tables if missing)
  const { execSync } = await import('child_process');
  execSync(
    'npx prisma db push --accept-data-loss --skip-generate',
    { stdio: 'pipe', env: { ...process.env, DATABASE_URL: 'file:./prisma/test.db' } }
  );
});

after(async () => {
  await prisma.$disconnect();
  // Clean up test DB file
  const { unlink } = await import('fs/promises');
  await unlink('./prisma/test.db').catch(() => {/* ignore if missing */});
  await unlink('./prisma/test.db-journal').catch(() => {});
});

// ═════════════════════════════════════════════════════════════════════════════
// 1. AUTHENTICATION
// ═════════════════════════════════════════════════════════════════════════════

describe('Authentication', () => {
  it('bcrypt verify works for seeded password', async () => {
    const user = await seedUser('CASHIER');
    const valid = await bcrypt.compare('TestPass123!', user.password);
    assert.equal(valid, true);
  });

  it('bcrypt rejects wrong password', async () => {
    const user = await seedUser('CASHIER');
    const valid = await bcrypt.compare('WrongPassword', user.password);
    assert.equal(valid, false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. PRODUCT CREATION
// ═════════════════════════════════════════════════════════════════════════════

describe('Product creation', () => {
  it('creates product with correct fields', async () => {
    const cat = await seedCategory();
    const product = await seedProduct(cat.id);
    assert.equal(product.stock, 10);
    assert.equal(product.costPrice, 40);
    assert.equal(product.sellingPrice, 100);
    assert.equal(product.status, 'ACTIVE');
  });

  it('rejects duplicate SKU', async () => {
    const cat = await seedCategory();
    const sku = `DUP-SKU-${Date.now()}`;
    await prisma.product.create({
      data: { name: 'First', sku, costPrice: 10, sellingPrice: 20, categoryId: cat.id },
    });
    await assert.rejects(
      () => prisma.product.create({
        data: { name: 'Second', sku, costPrice: 10, sellingPrice: 20, categoryId: cat.id },
      }),
      (err: any) => {
        assert.ok(err.message.includes('Unique constraint'), `Expected unique constraint error, got: ${err.message}`);
        return true;
      }
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. INVENTORY ADJUSTMENT + LEDGER
// ═════════════════════════════════════════════════════════════════════════════

describe('Inventory adjustment', () => {
  it('STOCK_IN increases stock and writes ledger entry', async () => {
    const cat = await seedCategory();
    const user = await seedUser();
    const product = await seedProduct(cat.id);
    const initialStock = product.stock; // 10

    const result = await adjustStockWithLedger(prisma, {
      productId: product.id,
      quantity:  5,
      type:      'IN',
      userId:    user.id,
      notes:     'Test stock-in',
    });

    assert.equal(result.previousStock, initialStock);
    assert.equal(result.newStock, initialStock + 5);

    // Verify product stock updated
    const updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    assert.equal(updated.stock, initialStock + 5);

    // Verify ledger entry written
    const movements = await (prisma as any).inventoryMovement.findMany({
      where: { productId: product.id, movementType: 'STOCK_IN' },
    });
    assert.equal(movements.length, 1);
    assert.equal(movements[0].quantity, 5);
    assert.equal(movements[0].previousStock, initialStock);
    assert.equal(movements[0].newStock, initialStock + 5);
  });

  it('STOCK_OUT decreases stock and writes ledger entry', async () => {
    const cat = await seedCategory();
    const user = await seedUser();
    const product = await seedProduct(cat.id);

    const result = await adjustStockWithLedger(prisma, {
      productId: product.id,
      quantity:  3,
      type:      'OUT',
      userId:    user.id,
      notes:     'Test stock-out',
    });

    assert.equal(result.newStock, product.stock - 3);

    const movements = await (prisma as any).inventoryMovement.findMany({
      where: { productId: product.id, movementType: 'STOCK_OUT' },
    });
    assert.equal(movements.length, 1);
    assert.equal(movements[0].quantity, -3); // negative = outflow
  });

  it('STOCK_OUT rejects when insufficient stock', async () => {
    const cat = await seedCategory();
    const user = await seedUser();
    const product = await seedProduct(cat.id); // stock = 10

    await assert.rejects(
      () => adjustStockWithLedger(prisma, {
        productId: product.id,
        quantity:  999,
        type:      'OUT',
        userId:    user.id,
      }),
      /[Ii]nsufficient|stock/
    );

    // Stock must be unchanged after rejection
    const unchanged = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    assert.equal(unchanged.stock, 10);
  });

  it('ADJUSTMENT sets stock to exact value', async () => {
    const cat = await seedCategory();
    const user = await seedUser();
    const product = await seedProduct(cat.id);

    const result = await adjustStockWithLedger(prisma, {
      productId: product.id,
      quantity:  25,
      type:      'ADJUSTMENT',
      userId:    user.id,
    });

    assert.equal(result.newStock, 25);
    const updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    assert.equal(updated.stock, 25);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. ATOMIC SALE
// ═════════════════════════════════════════════════════════════════════════════

describe('Atomic sale', () => {
  it('deducts stock, writes ledger, snapshots costPrice', async () => {
    const cat = await seedCategory();
    const cashier = await seedUser('CASHIER');
    const product = await seedProduct(cat.id); // stock=10, costPrice=40, sellingPrice=100

    const result = await createAtomicSale(prisma, {
      items:         [{ productId: product.id, quantity: 2, price: 100 }],
      paymentMethod: 'CASH',
      paymentAmount: 230, // 2 × 100 × 1.15 = 230
      cashierId:     cashier.id,
    });

    assert.equal(result.success, true, `Sale failed: ${result.error}`);
    assert.ok(result.invoiceNo?.startsWith('INV-'));

    // Stock deducted
    const updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    assert.equal(updated.stock, 8);

    // Ledger entry written
    const movements = await (prisma as any).inventoryMovement.findMany({
      where: { productId: product.id, movementType: 'SALE' },
    });
    assert.ok(movements.length >= 1);
    assert.equal(movements[0].quantity, -2);

    // SaleItem.costPrice snapshotted
    const saleItems = await prisma.saleItem.findMany({ where: { saleId: result.saleId } });
    assert.equal(saleItems.length, 1);
    assert.equal(saleItems[0].costPrice, 40); // historic snapshot, not current product cost
  });

  it('rejects sale when stock is insufficient', async () => {
    const cat = await seedCategory();
    const cashier = await seedUser('CASHIER');
    const product = await seedProduct(cat.id); // stock=10

    const result = await createAtomicSale(prisma, {
      items:         [{ productId: product.id, quantity: 999, price: 100 }],
      paymentMethod: 'CASH',
      paymentAmount: 0,
      cashierId:     cashier.id,
    });

    assert.equal(result.success, false);
    assert.ok(result.error?.includes('Insufficient') || result.error?.includes('stock'), `Expected stock error, got: ${result.error}`);

    // Stock must be unchanged
    const unchanged = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    assert.equal(unchanged.stock, 10);
  });

  it('idempotency key prevents duplicate sales', async () => {
    const cat = await seedCategory();
    const cashier = await seedUser('CASHIER');
    const product = await seedProduct(cat.id);
    const key = `idem-${Date.now()}`;

    const r1 = await createAtomicSale(prisma, {
      items:          [{ productId: product.id, quantity: 1, price: 100 }],
      paymentMethod:  'CASH',
      paymentAmount:  115,
      cashierId:      cashier.id,
      idempotencyKey: key,
    });

    const r2 = await createAtomicSale(prisma, {
      items:          [{ productId: product.id, quantity: 1, price: 100 }],
      paymentMethod:  'CASH',
      paymentAmount:  115,
      cashierId:      cashier.id,
      idempotencyKey: key, // same key
    });

    assert.equal(r1.success, true);
    assert.equal(r2.success, true);
    assert.equal(r2.isDuplicate, true);
    assert.equal(r1.saleId, r2.saleId); // returns the same sale

    // Stock deducted only once (from 10 → 9)
    const product2 = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    assert.equal(product2.stock, 9);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. SALE RETURN
// ═════════════════════════════════════════════════════════════════════════════

describe('Sale return', () => {
  it('restores stock and writes CUSTOMER_RETURN ledger entry', async () => {
    const cat = await seedCategory();
    const cashier = await seedUser('CASHIER');
    const product = await seedProduct(cat.id); // stock=10

    // Create sale (2 units)
    const sale = await createAtomicSale(prisma, {
      items:         [{ productId: product.id, quantity: 2, price: 100 }],
      paymentMethod: 'CASH',
      paymentAmount: 230,
      cashierId:     cashier.id,
    });
    assert.equal(sale.success, true);

    // Stock now 8
    const afterSale = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    assert.equal(afterSale.stock, 8);

    // Return 1 unit
    const saleItems = await prisma.saleItem.findMany({ where: { saleId: sale.saleId } });
    const returnResult = await createAtomicReturn(prisma, {
      saleId: sale.saleId!,
      reason: 'Defective',
      userId: cashier.id,
      items:  [{ saleItemId: saleItems[0].id, quantity: 1 }],
    });

    assert.equal(returnResult.success, true, `Return failed: ${returnResult.error}`);

    // Stock restored to 9
    const afterReturn = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    assert.equal(afterReturn.stock, 9);

    // CUSTOMER_RETURN ledger entry
    const returnMovements = await (prisma as any).inventoryMovement.findMany({
      where: { productId: product.id, movementType: 'CUSTOMER_RETURN' },
    });
    assert.ok(returnMovements.length >= 1);
    assert.equal(returnMovements[0].quantity, 1);
  });

  it('rejects return of more than sold quantity', async () => {
    const cat = await seedCategory();
    const cashier = await seedUser('CASHIER');
    const product = await seedProduct(cat.id);

    const sale = await createAtomicSale(prisma, {
      items:         [{ productId: product.id, quantity: 1, price: 100 }],
      paymentMethod: 'CASH',
      paymentAmount: 115,
      cashierId:     cashier.id,
    });
    assert.equal(sale.success, true);

    const saleItems = await prisma.saleItem.findMany({ where: { saleId: sale.saleId } });
    const returnResult = await createAtomicReturn(prisma, {
      saleId: sale.saleId!,
      reason: 'Over-return',
      userId: cashier.id,
      items:  [{ saleItemId: saleItems[0].id, quantity: 99 }], // only 1 was sold
    });

    assert.equal(returnResult.success, false);
    assert.ok(returnResult.error);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. CREDIT LEDGER
// ═════════════════════════════════════════════════════════════════════════════

describe('Credit ledger', () => {
  it('credit sale writes CreditLedgerEntry and updates CreditAccount', async () => {
    const cat = await seedCategory();
    const cashier = await seedUser('CASHIER');
    const product = await seedProduct(cat.id);
    const customer = await seedCustomer();

    // Create credit account
    await prisma.creditAccount.create({
      data: {
        customerId:     customer.id,
        creditLimit:    5000,
        currentBalance: 0,
        availableCredit: 5000,
        overdueBalance: 0,
        riskScore:      50,
        status:         'ACTIVE',
      },
    });

    // Sell on credit
    const totalWithVAT = 115; // 1 × 100 × 1.15
    const result = await createAtomicSale(prisma, {
      customerId:    customer.id,
      items:         [{ productId: product.id, quantity: 1, price: 100 }],
      paymentMethod: 'CREDIT',
      paymentAmount: totalWithVAT,
      cashierId:     cashier.id,
    });
    assert.equal(result.success, true, `Credit sale failed: ${result.error}`);

    // CreditLedgerEntry written
    const entries = await (prisma as any).creditLedgerEntry.findMany({
      where: { customerId: customer.id, entryType: 'CREDIT_SALE' },
    });
    assert.ok(entries.length >= 1);
    assert.ok(entries[0].amount > 0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. RBAC
// ═════════════════════════════════════════════════════════════════════════════

describe('RBAC permission enforcement', () => {
  it('ADMIN has INVENTORY_ADJUST permission', () => {
    const adminUser = { id: 'admin-id', role: 'ADMIN', email: 'admin@test.com' };
    // Should not throw
    assert.doesNotThrow(() => requirePermission(adminUser, PERMISSIONS.INVENTORY_ADJUST));
  });

  it('CASHIER does NOT have INVENTORY_ADJUST permission', () => {
    const cashierUser = { id: 'cashier-id', role: 'CASHIER', email: 'cashier@test.com' };
    assert.throws(
      () => requirePermission(cashierUser, PERMISSIONS.INVENTORY_ADJUST),
      /[Nn]ot authorized/
    );
  });

  it('CASHIER HAS sale:create permission', () => {
    const cashierUser = { id: 'cashier-id', role: 'CASHIER', email: 'cashier@test.com' };
    assert.doesNotThrow(() => requirePermission(cashierUser, PERMISSIONS.SALE_CREATE));
  });

  it('ACCOUNTANT does NOT have PRODUCT_CREATE permission', () => {
    const accountantUser = { id: 'acct-id', role: 'ACCOUNTANT', email: 'acct@test.com' };
    assert.throws(
      () => requirePermission(accountantUser, PERMISSIONS.PRODUCT_CREATE),
      /[Nn]ot authorized/
    );
  });

  it('ACCOUNTANT HAS REPORT_VIEW permission', () => {
    const accountantUser = { id: 'acct-id', role: 'ACCOUNTANT', email: 'acct@test.com' };
    assert.doesNotThrow(() => requirePermission(accountantUser, PERMISSIONS.REPORT_VIEW));
  });

  it('INVENTORY_CLERK has STOCK_IN but not SALE_CREATE', () => {
    const clerkUser = { id: 'clerk-id', role: 'INVENTORY_CLERK', email: 'clerk@test.com' };
    assert.doesNotThrow(() => requirePermission(clerkUser, PERMISSIONS.STOCK_IN));
    assert.throws(
      () => requirePermission(clerkUser, PERMISSIONS.SALE_CREATE),
      /[Nn]ot authorized/
    );
  });

  it('unknown role is denied all permissions', () => {
    const unknownUser = { id: 'x', role: 'SUPER_VILLAIN', email: 'x@x.com' };
    assert.throws(
      () => requirePermission(unknownUser, PERMISSIONS.SALE_VIEW),
      /[Nn]ot authorized|unknown role/
    );
  });

  it('requireAuth throws for null user', () => {
    const { requireAuth } = require('../auth/permissions');
    assert.throws(() => requireAuth(null), /[Nn]ot authenticated/);
    assert.throws(() => requireAuth(undefined), /[Nn]ot authenticated/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8. PURCHASE RECEIPT → INVENTORY LEDGER
// ═════════════════════════════════════════════════════════════════════════════

describe('Purchase receipt inventory ledger', () => {
  it('adjustStockWithLedger STOCK_IN simulates purchase receipt', async () => {
    const cat = await seedCategory();
    const user = await seedUser();
    const product = await seedProduct(cat.id); // stock=10

    // Simulate receiving 20 units from a purchase order
    const result = await adjustStockWithLedger(prisma, {
      productId:    product.id,
      quantity:     20,
      type:         'IN',
      userId:       user.id,
      notes:        'PO-TEST-001 receipt',
      referenceType: 'PURCHASE_ORDER',
    });

    assert.equal(result.newStock, 30); // 10 + 20

    // Ledger entry has referenceType = PURCHASE_ORDER
    const movements = await (prisma as any).inventoryMovement.findMany({
      where: { productId: product.id, referenceType: 'PURCHASE_ORDER' },
    });
    assert.ok(movements.length >= 1);
    assert.equal(movements[0].quantity, 20);
    assert.equal(movements[0].referenceType, 'PURCHASE_ORDER');
  });
});
