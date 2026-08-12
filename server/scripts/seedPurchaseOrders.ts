/**
 * Demo Purchase Orders Seeder
 * Inserts 8 purchase orders in various states for demo purposes.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding purchase orders...\n');

  // ── Get admin user ──────────────────────────────────────────────────────────
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('No admin user found. Run npm run seed first.');

  // ── Get suppliers ───────────────────────────────────────────────────────────
  const techSupp      = await prisma.supplier.findFirst({ where: { name: 'TechVision Ltd' } });
  const fashionSupp   = await prisma.supplier.findFirst({ where: { name: 'FashionHub Inc' } });
  const foodSupp      = await prisma.supplier.findFirst({ where: { name: 'FreshFoods Co' } });
  const householdSupp = await prisma.supplier.findFirst({ where: { name: 'Habesha Supplies' } });

  // ── Get products by SKU ─────────────────────────────────────────────────────
  const bysku = async (sku: string) => {
    const p = await prisma.product.findUnique({ where: { sku } });
    if (!p) throw new Error(`Product not found: ${sku}`);
    return p;
  };

  const [
    laptop, phone, headphones, watch,
    shirt, jeans, sneakers,
    coffee, tea,
    elc007, elc008, elc009, elc010, elc017, elc027, elc029, elc030,
    inv001, inv005, inv007, inv008, inv013,
    inv017, inv018, inv019, inv020, inv025, inv026,
  ] = await Promise.all([
    bysku('TECH-001'), bysku('TECH-002'), bysku('TECH-003'), bysku('TECH-005'),
    bysku('CLO-001'),  bysku('CLO-002'),  bysku('CLO-003'),
    bysku('FOO-001'),  bysku('FOO-002'),
    bysku('ELC-007'),  bysku('ELC-008'),  bysku('ELC-009'),  bysku('ELC-010'),
    bysku('ELC-017'),  bysku('ELC-027'),  bysku('ELC-029'),  bysku('ELC-030'),
    bysku('INV-001'),  bysku('INV-005'),  bysku('INV-007'),  bysku('INV-008'),
    bysku('INV-013'),  bysku('INV-017'),  bysku('INV-018'),  bysku('INV-019'),
    bysku('INV-020'),  bysku('INV-025'),  bysku('INV-026'),
  ]);

  // Check if POs already exist
  const existing = await prisma.purchaseOrder.count();
  if (existing > 0) {
    console.log(`Found ${existing} purchase orders already in DB — skipping.`);
    return;
  }

  // ── Helper: create PO + items + optional status change ────────────────────
  type POItem = { productId: string; quantity: number; unitCost: number };

  async function createPO(opts: {
    supplierId: string | null;
    notes: string;
    items: POItem[];
    status: 'DRAFT' | 'SENT' | 'RECEIVED' | 'CANCELLED';
    poNumber: string;
  }) {
    const totalCost = opts.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber:   opts.poNumber,
        supplierId: opts.supplierId,
        userId:     admin.id,
        notes:      opts.notes,
        status:     'DRAFT',
        items: {
          create: opts.items.map(i => ({
            productId: i.productId,
            quantity:  i.quantity,
            unitCost:  i.unitCost,
          })),
        },
      },
    });

    // Advance status
    if (opts.status === 'SENT' || opts.status === 'RECEIVED' || opts.status === 'CANCELLED') {
      await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: opts.status === 'RECEIVED' ? 'SENT' : opts.status } });
    }

    // If RECEIVED — update product stock
    if (opts.status === 'RECEIVED') {
      for (const item of opts.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data:  { stock: { increment: item.quantity } },
        });
        await prisma.transaction.create({
          data: {
            productId:   item.productId,
            quantity:    item.quantity,
            type:        'IN',
            notes:       `PO RECEIVED — ${opts.poNumber}`,
            userId:      admin.id,
            unitPrice:   item.unitCost,
            subtotal:    item.quantity * item.unitCost,
            vatAmount:   item.quantity * item.unitCost * 0.15,
            totalAmount: item.quantity * item.unitCost * 1.15,
          },
        });
      }
      await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: 'RECEIVED' } });
    }

    await prisma.activityLog.create({
      data: {
        userId:     admin.id,
        entityType: 'PURCHASE_ORDER',
        entityId:   po.id,
        action:     `PO_${opts.status}`,
        oldValue:   '{}',
        newValue:   JSON.stringify({ poNumber: opts.poNumber, totalCost, status: opts.status }),
        details:    `Purchase Order ${opts.poNumber} — ETB ${totalCost.toLocaleString()} — ${opts.status}`,
      },
    });

    console.log(`  ✅ ${opts.poNumber} — ${opts.status} — ETB ${totalCost.toLocaleString()}`);
    return po;
  }

  // ── PO 1: Electronics restock — RECEIVED ───────────────────────────────────
  await createPO({
    poNumber:   'PO-2026-001',
    supplierId: techSupp!.id,
    notes:      'Urgent electronics restock — low stock alert on headphones & peripherals',
    status:     'RECEIVED',
    items: [
      { productId: headphones.id, quantity: 20, unitCost: 4500 },
      { productId: elc007.id,     quantity: 30, unitCost: 580  },
      { productId: elc009.id,     quantity: 40, unitCost: 550  },
      { productId: elc010.id,     quantity: 15, unitCost: 1400 },
    ],
  });

  // ── PO 2: Clothing restock — RECEIVED ──────────────────────────────────────
  await createPO({
    poNumber:   'PO-2026-002',
    supplierId: fashionSupp!.id,
    notes:      'Monthly clothing restock — summer collection',
    status:     'RECEIVED',
    items: [
      { productId: shirt.id,    quantity: 100, unitCost: 350  },
      { productId: jeans.id,    quantity: 50,  unitCost: 900  },
      { productId: sneakers.id, quantity: 20,  unitCost: 1200 },
    ],
  });

  // ── PO 3: Food & Beverages — RECEIVED ──────────────────────────────────────
  await createPO({
    poNumber:   'PO-2026-003',
    supplierId: foodSupp!.id,
    notes:      'Weekly food supplies — coffee and tea restock',
    status:     'RECEIVED',
    items: [
      { productId: coffee.id, quantity: 150, unitCost: 500 },
      { productId: tea.id,    quantity: 80,  unitCost: 280 },
    ],
  });

  // ── PO 4: Household essentials — SENT ──────────────────────────────────────
  await createPO({
    poNumber:   'PO-2026-004',
    supplierId: householdSupp!.id,
    notes:      'Household essentials replenishment — awaiting delivery',
    status:     'SENT',
    items: [
      { productId: inv001.id, quantity: 50, unitCost: 55  },
      { productId: inv005.id, quantity: 60, unitCost: 40  },
      { productId: inv007.id, quantity: 30, unitCost: 180 },
      { productId: inv008.id, quantity: 40, unitCost: 65  },
      { productId: inv013.id, quantity: 25, unitCost: 380 },
    ],
  });

  // ── PO 5: Premium devices — SENT ───────────────────────────────────────────
  await createPO({
    poNumber:   'PO-2026-005',
    supplierId: techSupp!.id,
    notes:      'Q3 premium devices order — MacBook, iPhone, Apple Watch',
    status:     'SENT',
    items: [
      { productId: laptop.id, quantity: 10, unitCost: 28000 },
      { productId: phone.id,  quantity: 15, unitCost: 18000 },
      { productId: watch.id,  quantity: 8,  unitCost: 9000  },
    ],
  });

  // ── PO 6: Computer peripherals — DRAFT ─────────────────────────────────────
  await createPO({
    poNumber:   'PO-2026-006',
    supplierId: techSupp!.id,
    notes:      'Computer peripherals restock — pending manager approval',
    status:     'DRAFT',
    items: [
      { productId: elc008.id, quantity: 20, unitCost: 750  },
      { productId: elc017.id, quantity: 25, unitCost: 600  },
      { productId: elc027.id, quantity: 10, unitCost: 1600 },
      { productId: elc029.id, quantity: 5,  unitCost: 6000 },
      { productId: elc030.id, quantity: 15, unitCost: 880  },
    ],
  });

  // ── PO 7: Kitchen & Stationery — DRAFT ─────────────────────────────────────
  await createPO({
    poNumber:   'PO-2026-007',
    supplierId: householdSupp!.id,
    notes:      'Kitchen and stationery restock for next quarter',
    status:     'DRAFT',
    items: [
      { productId: inv017.id, quantity: 50,  unitCost: 35  },
      { productId: inv018.id, quantity: 100, unitCost: 7   },
      { productId: inv019.id, quantity: 60,  unitCost: 25  },
      { productId: inv020.id, quantity: 20,  unitCost: 280 },
      { productId: inv025.id, quantity: 15,  unitCost: 550 },
      { productId: inv026.id, quantity: 10,  unitCost: 380 },
    ],
  });

  // ── PO 8: Seasonal fashion — CANCELLED ─────────────────────────────────────
  await createPO({
    poNumber:   'PO-2026-008',
    supplierId: fashionSupp!.id,
    notes:      'Seasonal winter collection — cancelled due to budget reallocation',
    status:     'CANCELLED',
    items: [
      { productId: shirt.id, quantity: 200, unitCost: 350 },
      { productId: jeans.id, quantity: 100, unitCost: 900 },
    ],
  });

  console.log('\n✅ Purchase orders seeded successfully!');
  console.log('  PO-2026-001  Electronics restock       RECEIVED');
  console.log('  PO-2026-002  Clothing restock           RECEIVED');
  console.log('  PO-2026-003  Food & Beverages           RECEIVED');
  console.log('  PO-2026-004  Household essentials       SENT');
  console.log('  PO-2026-005  Premium devices            SENT');
  console.log('  PO-2026-006  Computer peripherals       DRAFT');
  console.log('  PO-2026-007  Kitchen & Stationery       DRAFT');
  console.log('  PO-2026-008  Seasonal collection        CANCELLED');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
