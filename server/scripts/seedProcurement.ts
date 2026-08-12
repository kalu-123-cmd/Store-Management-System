/**
 * Procurement Demo Data Seeder
 * Inserts procurement requests, tenders, and contracts for demo.
 * Also generates an Excel file you can import manually.
 */

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding procurement demo data...\n');

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('No admin user. Run npm run seed first.');

  const suppliers = await prisma.supplier.findMany();
  const techSupp      = suppliers.find(s => s.name === 'TechVision Ltd');
  const fashionSupp   = suppliers.find(s => s.name === 'FashionHub Inc');
  const foodSupp      = suppliers.find(s => s.name === 'FreshFoods Co');
  const householdSupp = suppliers.find(s => s.name === 'Habesha Supplies');

  const existingCount = await prisma.procurementRequest.count();
  if (existingCount > 0) {
    console.log(`${existingCount} procurement records exist — skipping DB seed.`);
  } else {
    // ── Procurement Requests ──────────────────────────────────────────────────
    const requestDefs = [
      {
        number: 'PR-2026-001', priority: 'HIGH', status: 'APPROVED',
        justification: 'Office computers reaching end of life; productivity severely impacted.',
        requiredDate: new Date('2026-09-01'),
        items: [
          { description: 'Desktop Computer Core i7', qty: 10, unit: 'PCS', cost: 45000 },
          { description: 'LED Monitor 24"', qty: 10, unit: 'PCS', cost: 8500 },
          { description: 'Wireless Keyboard & Mouse Set', qty: 10, unit: 'SET', cost: 1800 },
        ],
      },
      {
        number: 'PR-2026-002', priority: 'NORMAL', status: 'SUBMITTED',
        justification: 'Annual stationery restocking for all departments.',
        requiredDate: new Date('2026-08-20'),
        items: [
          { description: 'A4 Paper Ream 80gsm', qty: 200, unit: 'REAM', cost: 480 },
          { description: 'Ballpoint Pen (Box)', qty: 50, unit: 'BOX', cost: 120 },
          { description: 'Stapler Heavy Duty', qty: 15, unit: 'PCS', cost: 350 },
          { description: 'Filing Cabinet 4-Drawer', qty: 5, unit: 'PCS', cost: 12000 },
        ],
      },
      {
        number: 'PR-2026-003', priority: 'URGENT', status: 'DRAFT',
        justification: 'Generator fuel reserve critically low; backup power at risk.',
        requiredDate: new Date('2026-08-15'),
        items: [
          { description: 'Diesel Fuel (200L Drum)', qty: 10, unit: 'DRUM', cost: 18000 },
          { description: 'Generator Oil Filter', qty: 5, unit: 'PCS', cost: 2500 },
        ],
      },
      {
        number: 'PR-2026-004', priority: 'LOW', status: 'SUBMITTED',
        justification: 'Kitchen and break-room supplies for staff welfare.',
        requiredDate: new Date('2026-09-15'),
        items: [
          { description: 'Coffee Arabica 1kg', qty: 20, unit: 'KG', cost: 850 },
          { description: 'Sugar 1kg Bag', qty: 30, unit: 'BAG', cost: 110 },
          { description: 'Drinking Water 20L', qty: 50, unit: 'BOTTLE', cost: 65 },
        ],
      },
      {
        number: 'PR-2026-005', priority: 'HIGH', status: 'APPROVED',
        justification: 'Security upgrade: CCTV cameras and access control system.',
        requiredDate: new Date('2026-09-30'),
        items: [
          { description: 'IP Camera Outdoor 4MP', qty: 8, unit: 'PCS', cost: 12000 },
          { description: 'NVR Recorder 16-Channel', qty: 1, unit: 'PCS', cost: 35000 },
          { description: 'Access Control Unit', qty: 3, unit: 'PCS', cost: 28000 },
          { description: 'UPS 1500VA', qty: 2, unit: 'PCS', cost: 15000 },
        ],
      },
    ];

    for (const def of requestDefs) {
      const total = def.items.reduce((s, i) => s + i.qty * i.cost, 0);
      const req = await prisma.procurementRequest.create({
        data: {
          requestNumber: def.number,
          requesterId: admin.id,
          requiredDate: def.requiredDate,
          priority: def.priority,
          justification: def.justification,
          estimatedTotal: total,
          status: def.status,
          items: {
            create: def.items.map(i => ({
              description: i.description,
              quantity: i.qty,
              unitOfMeasure: i.unit,
              estimatedUnitCost: i.cost,
              estimatedTotal: i.qty * i.cost,
            })),
          },
        },
      });
      console.log(`  ✅ ${req.requestNumber} — ${def.status} — ETB ${total.toLocaleString()}`);
    }

    // ── Tenders ───────────────────────────────────────────────────────────────
    const tenderDefs = [
      {
        number: 'T-2026-001', project: 'ICT Equipment Supply 2026',
        category: 'ICT & Electronics', method: 'OPEN', market: 'NATIONAL',
        deadline: new Date('2026-09-15'), validity: 60, security: 50000,
        contractType: 'SUPPLY', status: 'PUBLISHED',
        description: 'Supply of computers, monitors, printers and networking equipment.',
      },
      {
        number: 'T-2026-002', project: 'Office Furniture & Fixtures',
        category: 'Furniture', method: 'RESTRICTED', market: 'NATIONAL',
        deadline: new Date('2026-08-30'), validity: 45, security: 25000,
        contractType: 'SUPPLY', status: 'EVALUATION',
        description: 'Supply and installation of office desks, chairs and storage units.',
      },
      {
        number: 'T-2026-003', project: 'Security System Installation',
        category: 'Security', method: 'DIRECT', market: 'NATIONAL',
        deadline: new Date('2026-08-20'), validity: 30, security: null,
        contractType: 'WORKS', status: 'AWARDED',
        description: 'CCTV installation and access control system setup.',
      },
      {
        number: 'T-2026-004', project: 'Annual Food & Beverage Supply',
        category: 'Food & Beverage', method: 'OPEN', market: 'NATIONAL',
        deadline: new Date('2026-10-01'), validity: 90, security: 10000,
        contractType: 'SUPPLY', status: 'DRAFT',
        description: 'Ongoing supply of coffee, tea, sugar and bottled water.',
      },
    ];

    for (const def of tenderDefs) {
      const t = await prisma.tender.create({
        data: {
          tenderNumber: def.number,
          projectName: def.project,
          procurementCategory: def.category,
          procurementMethod: def.method,
          marketType: def.market,
          submissionDeadline: def.deadline,
          bidValidityPeriod: def.validity,
          bidSecurity: def.security,
          contractType: def.contractType,
          currency: 'ETB',
          status: def.status,
          description: def.description,
        },
      });
      console.log(`  ✅ ${t.tenderNumber} — ${def.status} — ${def.project}`);
    }

    // ── Contracts ─────────────────────────────────────────────────────────────
    if (techSupp && fashionSupp && foodSupp && householdSupp) {
      const contractDefs = [
        {
          number: 'C-2026-001', supplierId: techSupp.id,
          start: new Date('2026-07-01'), end: new Date('2027-06-30'),
          value: 1500000, payment: 'Net 30', delivery: 'FOB Addis Ababa',
          status: 'ACTIVE', description: 'Annual ICT equipment supply contract.',
        },
        {
          number: 'C-2026-002', supplierId: foodSupp.id,
          start: new Date('2026-08-01'), end: new Date('2026-12-31'),
          value: 180000, payment: 'Net 15', delivery: 'Delivered to premises',
          status: 'ACTIVE', description: 'Food and beverage supply for staff canteen.',
        },
        {
          number: 'C-2026-003', supplierId: fashionSupp.id,
          start: new Date('2026-06-01'), end: new Date('2026-12-31'),
          value: 350000, payment: 'Net 45', delivery: 'Ex-warehouse',
          status: 'ACTIVE', description: 'Staff uniform and workwear supply contract.',
        },
        {
          number: 'C-2026-004', supplierId: householdSupp.id,
          start: new Date('2026-09-01'), end: new Date('2027-08-31'),
          value: 220000, payment: 'Cash on delivery', delivery: 'Delivered',
          status: 'DRAFT', description: 'Office cleaning and maintenance supplies.',
        },
      ];

      for (const def of contractDefs) {
        const c = await prisma.contract.create({
          data: {
            contractNumber: def.number,
            supplierId: def.supplierId,
            startDate: def.start,
            endDate: def.end,
            contractValue: def.value,
            currency: 'ETB',
            paymentTerms: def.payment,
            deliveryTerms: def.delivery,
            status: def.status,
            description: def.description,
          },
        });
        console.log(`  ✅ ${c.contractNumber} — ${def.status} — ETB ${def.value.toLocaleString()}`);
      }
    }
  }

  // ── Generate Excel file ───────────────────────────────────────────────────
  console.log('\nGenerating Excel file for manual import...');

  const wb = XLSX.utils.book_new();

  // Sheet 1: Procurement Requests
  const reqRows = [
    ['Request Number','Priority','Status','Required Date','Justification','Estimated Total'],
    ['PR-2026-001','HIGH','APPROVED','2026-09-01','Office computers reaching end of life','535000'],
    ['PR-2026-002','NORMAL','SUBMITTED','2026-08-20','Annual stationery restocking','155250'],
    ['PR-2026-003','URGENT','DRAFT','2026-08-15','Generator fuel reserve critically low','192500'],
    ['PR-2026-004','LOW','SUBMITTED','2026-09-15','Kitchen and break-room supplies','10250'],
    ['PR-2026-005','HIGH','APPROVED','2026-09-30','Security upgrade: CCTV and access control','235000'],
  ];
  const wsReq = XLSX.utils.aoa_to_sheet(reqRows);
  wsReq['!cols'] = [20,10,15,14,50,16].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsReq, 'Procurement Requests');

  // Sheet 2: Request Items
  const itemRows = [
    ['Request Number','Description','Quantity','Unit','Unit Cost (ETB)','Total (ETB)'],
    ['PR-2026-001','Desktop Computer Core i7','10','PCS','45000','450000'],
    ['PR-2026-001','LED Monitor 24"','10','PCS','8500','85000'],
    ['PR-2026-001','Wireless Keyboard & Mouse Set','10','SET','1800','18000'],
    ['PR-2026-001','A4 Paper Ream 80gsm','200','REAM','480','96000'],
    ['PR-2026-002','Ballpoint Pen (Box)','50','BOX','120','6000'],
    ['PR-2026-002','Stapler Heavy Duty','15','PCS','350','5250'],
    ['PR-2026-002','Filing Cabinet 4-Drawer','5','PCS','12000','60000'],
    ['PR-2026-003','Diesel Fuel (200L Drum)','10','DRUM','18000','180000'],
    ['PR-2026-003','Generator Oil Filter','5','PCS','2500','12500'],
    ['PR-2026-004','Coffee Arabica 1kg','20','KG','850','17000'],
    ['PR-2026-004','Sugar 1kg Bag','30','BAG','110','3300'],
    ['PR-2026-004','Drinking Water 20L','50','BOTTLE','65','3250'],
    ['PR-2026-005','IP Camera Outdoor 4MP','8','PCS','12000','96000'],
    ['PR-2026-005','NVR Recorder 16-Channel','1','PCS','35000','35000'],
    ['PR-2026-005','Access Control Unit','3','PCS','28000','84000'],
    ['PR-2026-005','UPS 1500VA','2','PCS','15000','30000'],
  ];
  const wsItems = XLSX.utils.aoa_to_sheet(itemRows);
  wsItems['!cols'] = [18,35,10,8,16,14].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsItems, 'Request Items');

  // Sheet 3: Tenders
  const tenderRows = [
    ['Tender Number','Project Name','Category','Method','Market','Deadline','Validity (days)','Bid Security','Status'],
    ['T-2026-001','ICT Equipment Supply 2026','ICT & Electronics','OPEN','NATIONAL','2026-09-15','60','50000','PUBLISHED'],
    ['T-2026-002','Office Furniture & Fixtures','Furniture','RESTRICTED','NATIONAL','2026-08-30','45','25000','EVALUATION'],
    ['T-2026-003','Security System Installation','Security','DIRECT','NATIONAL','2026-08-20','30','','AWARDED'],
    ['T-2026-004','Annual Food & Beverage Supply','Food & Beverage','OPEN','NATIONAL','2026-10-01','90','10000','DRAFT'],
  ];
  const wsTenders = XLSX.utils.aoa_to_sheet(tenderRows);
  wsTenders['!cols'] = [15,32,20,12,12,14,16,14,12].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsTenders, 'Tenders');

  // Sheet 4: Contracts
  const contractRows = [
    ['Contract Number','Supplier','Value (ETB)','Currency','Start Date','End Date','Payment Terms','Delivery Terms','Status'],
    ['C-2026-001','TechVision Ltd','1500000','ETB','2026-07-01','2027-06-30','Net 30','FOB Addis Ababa','ACTIVE'],
    ['C-2026-002','FreshFoods Co','180000','ETB','2026-08-01','2026-12-31','Net 15','Delivered to premises','ACTIVE'],
    ['C-2026-003','FashionHub Inc','350000','ETB','2026-06-01','2026-12-31','Net 45','Ex-warehouse','ACTIVE'],
    ['C-2026-004','Habesha Supplies','220000','ETB','2026-09-01','2027-08-31','Cash on delivery','Delivered','DRAFT'],
  ];
  const wsContracts = XLSX.utils.aoa_to_sheet(contractRows);
  wsContracts['!cols'] = [16,18,14,10,12,12,18,22,10].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsContracts, 'Contracts');

  // Sheet 5: Products (for CSV import)
  const productRows = [
    ['name','sku','category','stock','costPrice','sellingPrice'],
    ['Wireless Mouse','P001','Electronics','50','15','25'],
    ['Notebook A5','P002','Stationery','200','1.5','3.5'],
    ['Coffee Mug','P003','Kitchenware','30','5','12'],
    ['Ballpoint Pen','P004','Stationery','500','0.20','0.50'],
    ['Desk Lamp','P005','Furniture','15','20','45'],
    ['USB-C Cable','P006','Electronics','120','4.5','9.99'],
    ['Mechanical Keyboard','P007','Electronics','25','45','79.99'],
    ['Water Bottle 1L','P008','Accessories','85','6','14.99'],
    ['Office Chair','P009','Furniture','10','85','149.99'],
    ['External SSD 1TB','P010','Electronics','40','55','89.99'],
  ];
  const wsProducts = XLSX.utils.aoa_to_sheet(productRows);
  wsProducts['!cols'] = [22,8,14,8,12,14].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsProducts, 'Products (CSV Import)');

  const outPath = path.join(process.cwd(), 'demo-data.xlsx');
  XLSX.writeFile(wb, outPath);
  console.log(`\n✅ Excel file written to: ${outPath}`);
  console.log('   Sheets: Procurement Requests · Request Items · Tenders · Contracts · Products (CSV Import)');

  console.log('\n✅ All procurement demo data seeded successfully!');
  console.log('  5 procurement requests  (2 APPROVED · 2 SUBMITTED · 1 DRAFT)');
  console.log('  4 tenders               (1 PUBLISHED · 1 EVALUATION · 1 AWARDED · 1 DRAFT)');
  console.log('  4 contracts             (3 ACTIVE · 1 DRAFT)');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
