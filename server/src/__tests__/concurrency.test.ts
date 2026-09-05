/**
 * SmartStore OS — Concurrency Test
 *
 * Verifies that simultaneous sales against a single remaining unit of stock
 * produce exactly one success and one failure, with no negative stock and
 * no duplicate inventory deductions.
 *
 * This is the critical anti-overselling test.
 *
 * Expected result:
 *   Stock = 1
 *   Cashier A → Sale for 1 unit  ─┐ run concurrently
 *   Cashier B → Sale for 1 unit  ─┘
 *   → Exactly 1 succeeds
 *   → Exactly 1 fails (stock depleted)
 *   → Final stock = 0
 *   → No negative stock
 *   → Exactly 1 SALE ledger movement (not 2)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createAtomicSale } from '../services/atomicSaleService';

// Use the same test database as integration tests (or a separate one)
process.env.DATABASE_URL     = 'file:./prisma/concurrency-test.db';
process.env.DATABASE_PROVIDER = 'sqlite';

const prisma = new PrismaClient();

before(async () => {
  const { execSync } = await import('child_process');
  execSync(
    'npx prisma db push --accept-data-loss --skip-generate',
    { stdio: 'pipe', env: { ...process.env, DATABASE_URL: 'file:./prisma/concurrency-test.db' } }
  );
});

after(async () => {
  await prisma.$disconnect();
  const { unlink } = await import('fs/promises');
  await unlink('./prisma/concurrency-test.db').catch(() => {});
  await unlink('./prisma/concurrency-test.db-journal').catch(() => {});
});

describe('Concurrency — simultaneous sale of last unit', () => {
  it('only one of two concurrent sales succeeds (no overselling)', async () => {
    // Setup: 1 unit in stock
    const category = await prisma.category.create({ data: { name: `ConcCat-${Date.now()}` } });
    const product  = await prisma.product.create({
      data: {
        name:         'Last Unit Product',
        sku:          `CONC-${Date.now()}`,
        costPrice:    50,
        sellingPrice: 100,
        stock:        1,           // exactly 1 unit
        minStockLevel: 0,
        status:       'ACTIVE',
        categoryId:   category.id,
      },
    });

    const cashierA = await prisma.user.create({
      data: { name: 'Cashier A', email: `ca-${Date.now()}@test.com`, password: await bcrypt.hash('x', 4), role: 'CASHIER' },
    });
    const cashierB = await prisma.user.create({
      data: { name: 'Cashier B', email: `cb-${Date.now()}@test.com`, password: await bcrypt.hash('x', 4), role: 'CASHIER' },
    });

    const saleArgs = (cashierId: string) => ({
      items:         [{ productId: product.id, quantity: 1, price: 100 }],
      paymentMethod: 'CASH' as const,
      paymentAmount: 115,
      cashierId,
    });

    // Run both sales concurrently
    const [resultA, resultB] = await Promise.all([
      createAtomicSale(prisma, saleArgs(cashierA.id)),
      createAtomicSale(prisma, saleArgs(cashierB.id)),
    ]);

    const successes = [resultA, resultB].filter(r => r.success);
    const failures  = [resultA, resultB].filter(r => !r.success);

    // CRITICAL: exactly one must succeed
    assert.equal(
      successes.length, 1,
      `Expected exactly 1 success but got ${successes.length}. ResultA: ${resultA.success}/${resultA.error}, ResultB: ${resultB.success}/${resultB.error}`
    );
    assert.equal(failures.length, 1, `Expected exactly 1 failure but got ${failures.length}`);

    // Stock must be exactly 0 — not negative
    const finalProduct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    assert.equal(
      finalProduct.stock, 0,
      `Expected stock=0 but got ${finalProduct.stock} — possible oversell!`
    );
    assert.ok(finalProduct.stock >= 0, 'Stock went NEGATIVE — overselling detected!');

    // Exactly 1 SALE ledger movement (not 2)
    const movements = await (prisma as any).inventoryMovement.findMany({
      where: { productId: product.id, movementType: 'SALE' },
    });
    assert.equal(
      movements.length, 1,
      `Expected 1 SALE ledger entry but found ${movements.length} — duplicate deduction!`
    );
    assert.equal(movements[0].quantity, -1);
    assert.equal(movements[0].newStock, 0);

    // Exactly 1 SaleItem in the database
    const allSales = await prisma.sale.findMany({
      where: { items: { some: { productId: product.id } } },
      include: { items: true },
    });
    assert.equal(
      allSales.length, 1,
      `Expected 1 sale record but found ${allSales.length}`
    );
  });

  it('concurrent adjustment and sale do not produce negative stock', async () => {
    const { adjustStockWithLedger } = await import('../services/inventoryLedgerService');

    const category = await prisma.category.create({ data: { name: `RaceCat-${Date.now()}` } });
    const product  = await prisma.product.create({
      data: {
        name:         'Race Product',
        sku:          `RACE-${Date.now()}`,
        costPrice:    20,
        sellingPrice: 50,
        stock:        2,
        minStockLevel: 0,
        status:       'ACTIVE',
        categoryId:   category.id,
      },
    });
    const cashier = await prisma.user.create({
      data: { name: 'Race Cashier', email: `rc-${Date.now()}@test.com`, password: 'x', role: 'CASHIER' },
    });
    const manager = await prisma.user.create({
      data: { name: 'Race Manager', email: `rm-${Date.now()}@test.com`, password: 'x', role: 'MANAGER' },
    });

    // One sale (2 units) + one OUT adjustment (2 units) at the same time
    // At most one can succeed — the other must fail to prevent stock going negative
    const [saleResult, adjustResult] = await Promise.allSettled([
      createAtomicSale(prisma, {
        items: [{ productId: product.id, quantity: 2, price: 50 }],
        paymentMethod: 'CASH',
        paymentAmount: 115,
        cashierId: cashier.id,
      }),
      adjustStockWithLedger(prisma, {
        productId: product.id,
        quantity:  2,
        type:      'OUT',
        userId:    manager.id,
        notes:     'Race condition test',
      }),
    ]);

    const finalProduct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });

    // Stock must never go below zero
    assert.ok(
      finalProduct.stock >= 0,
      `Stock went negative (${finalProduct.stock}) — concurrency protection failed!`
    );

    // At least one of the two operations must have succeeded
    const succeeded =
      (saleResult.status === 'fulfilled' && saleResult.value.success) ||
      (adjustResult.status === 'fulfilled');
    assert.ok(succeeded, 'Both operations failed — at least one should succeed');
  });
});
