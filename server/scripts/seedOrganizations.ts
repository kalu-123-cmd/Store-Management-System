/**
 * Organization Demo Data Seeder
 * Creates organizations, units, departments, and warehouses.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding organization demo data...\n');

  // ── Organizations (upsert so re-runs are safe) ─────────────────────────────
  const storeOS = await prisma.organization.upsert({
    where: { code: 'STORE-ETH' }, update: {},
    create: {
      name: 'StoreOS Ethiopia HQ', code: 'STORE-ETH', type: 'COMPANY',
      description: 'Main headquarters of StoreOS Ethiopia retail operations.',
      address: 'Bole, Addis Ababa', phone: '+251-911-001001',
      email: 'hq@storeos.et', website: 'https://storeos.et', isActive: true,
    },
  });
  const branch2 = await prisma.organization.upsert({
    where: { code: 'STORE-HWS' }, update: {},
    create: {
      name: 'StoreOS Hawassa Branch', code: 'STORE-HWS', type: 'COMPANY',
      description: 'Southern region retail branch.',
      address: 'Hawassa City Center', phone: '+251-911-002001',
      email: 'hawassa@storeos.et', isActive: true,
    },
  });
  console.log(`  ✅ ${storeOS.name}`);
  console.log(`  ✅ ${branch2.name}`);

  // ── Organization Units (upsert) ────────────────────────────────────────────
  const hqUnit = await prisma.organizationUnit.upsert({
    where: { code: 'UNIT-ADD-HQ' }, update: {},
    create: { name:'Addis Ababa HQ Unit', code:'UNIT-ADD-HQ', type:'DISTRICT', organizationId:storeOS.id, address:'Bole Sub-City', headOfUnit:'Abebe Bekele', isActive:true },
  });
  const salesUnit = await prisma.organizationUnit.upsert({
    where: { code: 'UNIT-SALES' }, update: {},
    create: { name:'Sales & Retail Division', code:'UNIT-SALES', type:'DEPARTMENT', organizationId:storeOS.id, parentId:hqUnit.id, headOfUnit:'Tigist Haile', isActive:true },
  });
  const opsUnit = await prisma.organizationUnit.upsert({
    where: { code: 'UNIT-OPS' }, update: {},
    create: { name:'Operations Division', code:'UNIT-OPS', type:'DEPARTMENT', organizationId:storeOS.id, parentId:hqUnit.id, headOfUnit:'Mulugeta Alemu', isActive:true },
  });
  const hwsUnit = await prisma.organizationUnit.upsert({
    where: { code: 'UNIT-HWS' }, update: {},
    create: { name:'Hawassa Regional Unit', code:'UNIT-HWS', type:'REGION', organizationId:branch2.id, address:'Hawassa', headOfUnit:'Yohannes Tekle', isActive:true },
  });
  console.log(`  ✅ Units created: HQ, Sales, Ops, Hawassa`);

  // ── Departments (upsert) ──────────────────────────────────────────────────
  const depts = [
    { name:'Finance Department',        code:'DEPT-FIN',  unitId:hqUnit.id,   head:'Solomon Girma',   budget:'BUD-2026-FIN' },
    { name:'Human Resources',           code:'DEPT-HR',   unitId:hqUnit.id,   head:'Marta Tesfaye',   budget:'BUD-2026-HR'  },
    { name:'Retail Sales Team',         code:'DEPT-RTL',  unitId:salesUnit.id,head:'Dawit Bekele',    budget:'BUD-2026-RTL' },
    { name:'Digital & E-Commerce',      code:'DEPT-DIG',  unitId:salesUnit.id,head:'Sara Kebede',     budget:'BUD-2026-DIG' },
    { name:'Procurement & Supply',      code:'DEPT-PRO',  unitId:opsUnit.id,  head:'Yonas Tadesse',   budget:'BUD-2026-PRO' },
    { name:'Logistics & Distribution',  code:'DEPT-LOG',  unitId:opsUnit.id,  head:'Hana Mekonnen',   budget:'BUD-2026-LOG' },
    { name:'IT & Infrastructure',       code:'DEPT-IT',   unitId:hqUnit.id,   head:'Bereket Wolde',   budget:'BUD-2026-IT'  },
    { name:'Hawassa Sales',             code:'DEPT-HWS',  unitId:hwsUnit.id,  head:'Liya Abera',      budget:'BUD-2026-HWS' },
  ];
  for (const d of depts) {
    await prisma.department.upsert({
      where: { code: d.code }, update: {},
      create: { name:d.name, code:d.code, organizationUnitId:d.unitId, headOfDepartment:d.head, budgetCode:d.budget, isActive:true },
    });
  }
  console.log(`  ✅ ${depts.length} departments created`);

  // ── Warehouses (upsert) ────────────────────────────────────────────────────
  const whs = [
    { name:'Central Warehouse Bole',     code:'WH-ADD-001', type:'CENTRAL',      unitId:opsUnit.id,  addr:'Bole Industrial Zone',    mgr:'Tadesse Bekele', cap:2000 },
    { name:'Retail Stock Room - HQ',     code:'WH-ADD-002', type:'DEPARTMENTAL', unitId:salesUnit.id,addr:'Bole, Ground Floor',       mgr:'Lemlem Girma',   cap:300  },
    { name:'Electronics Storage Unit',   code:'WH-ADD-003', type:'DEPARTMENTAL', unitId:opsUnit.id,  addr:'Bole, Annex Building',     mgr:'Kebede Alemu',   cap:500  },
    { name:'Hawassa Regional Warehouse', code:'WH-HWS-001', type:'REGIONAL',     unitId:hwsUnit.id,  addr:'Hawassa Industrial Area',  mgr:'Tesfaye Mamo',   cap:1200 },
    { name:'Cold Storage Unit',          code:'WH-ADD-004', type:'CENTRAL',      unitId:opsUnit.id,  addr:'Akaki, Addis Ababa',       mgr:'Birtukan Yalew', cap:400  },
  ];
  for (const w of whs) {
    await prisma.warehouse.upsert({
      where: { code: w.code }, update: {},
      create: { name:w.name, code:w.code, type:w.type, organizationUnitId:w.unitId, address:w.addr, manager:w.mgr, capacity:w.cap, isActive:true },
    });
  }
  console.log(`  ✅ ${whs.length} warehouses created`);

  console.log('\n✅ Organization data seeded!');
  console.log('  2 organizations · 4 units · 8 departments · 5 warehouses');
}

main().catch(e=>{ console.error(e); process.exit(1); }).finally(()=>prisma.$disconnect());
