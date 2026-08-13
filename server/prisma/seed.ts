import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── Users ──────────────────────────────────────────────────────────────────
  const adminPw   = await bcrypt.hash('admin123',   10);
  const managerPw = await bcrypt.hash('manager123', 10);
  const cashierPw = await bcrypt.hash('cashier123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@store.com' }, update: { password: adminPw, role: 'ADMIN' },
    create: { name: 'Admin User',    email: 'admin@store.com',   password: adminPw,   role: 'ADMIN'   },
  });
  await prisma.user.upsert({
    where: { email: 'manager@store.com' }, update: { password: managerPw, role: 'MANAGER' },
    create: { name: 'Store Manager', email: 'manager@store.com', password: managerPw, role: 'MANAGER' },
  });
  await prisma.user.upsert({
    where: { email: 'cashier@store.com' }, update: { password: cashierPw, role: 'CASHIER' },
    create: { name: 'Cashier One',   email: 'cashier@store.com', password: cashierPw, role: 'CASHIER' },
  });
  await prisma.user.upsert({
    where: { email: 'admin@storemanagement.com' }, update: { password: adminPw, role: 'ADMIN' },
    create: { name: 'Admin User', email: 'admin@storemanagement.com', password: adminPw, role: 'ADMIN' },
  });
  await prisma.user.upsert({
    where: { email: 'manager@storemanagement.com' }, update: { password: managerPw, role: 'MANAGER' },
    create: { name: 'Store Manager', email: 'manager@storemanagement.com', password: managerPw, role: 'MANAGER' },
  });
  await prisma.user.upsert({
    where: { email: 'cashier@storemanagement.com' }, update: { password: cashierPw, role: 'CASHIER' },
    create: { name: 'Cashier One', email: 'cashier@storemanagement.com', password: cashierPw, role: 'CASHIER' },
  });

  // ── Categories ─────────────────────────────────────────────────────────────
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
  const household = await prisma.category.upsert({
    where: { name: 'Household & Shop Materials' }, update: {},
    create: { name: 'Household & Shop Materials', description: 'Ethiopian household and shop essentials' },
  });

  // ── Suppliers ──────────────────────────────────────────────────────────────
  const techSupplier = await prisma.supplier.upsert({
    where: { id: 'supplier-tech-001' }, update: {},
    create: { id: 'supplier-tech-001', name: 'TechVision Ltd', contactName: 'James Lee', email: 'james@techvision.com', phone: '+251-911-000001', address: 'Bole, Addis Ababa' },
  });
  const fashionSupplier = await prisma.supplier.upsert({
    where: { id: 'supplier-fashion-001' }, update: {},
    create: { id: 'supplier-fashion-001', name: 'FashionHub Inc', contactName: 'Sarah Chen', email: 'sarah@fashionhub.com', phone: '+251-911-000002', address: 'Merkato, Addis Ababa' },
  });
  const foodSupplier = await prisma.supplier.upsert({
    where: { id: 'supplier-food-001' }, update: {},
    create: { id: 'supplier-food-001', name: 'FreshFoods Co', contactName: 'David Kim', email: 'david@freshfoods.com', phone: '+251-911-000003', address: 'Piassa, Addis Ababa' },
  });
  const householdSupplier = await prisma.supplier.upsert({
    where: { id: 'supplier-household-001' }, update: {},
    create: { id: 'supplier-household-001', name: 'Habesha Supplies', contactName: 'Tesfaye Bekele', email: 'tesfaye@habesha.et', phone: '+251-911-000004', address: 'Merkato, Addis Ababa' },
  });

  // ── Customers ──────────────────────────────────────────────────────────────
  const c1 = await prisma.customer.upsert({
    where: { id: 'customer-001' }, update: {},
    create: { id: 'customer-001', name: 'Abebe Girma',   email: 'abebe@example.com',  phone: '+251-911-100001' },
  });
  const c2 = await prisma.customer.upsert({
    where: { id: 'customer-002' }, update: {},
    create: { id: 'customer-002', name: 'Tigist Haile',  email: 'tigist@example.com', phone: '+251-911-100002' },
  });
  const c3 = await prisma.customer.upsert({
    where: { id: 'customer-003' }, update: {},
    create: { id: 'customer-003', name: 'Mulugeta Alemu', email: 'mulugeta@example.com', phone: '+251-911-100003' },
  });

  // ── Original Products ──────────────────────────────────────────────────────
  const laptop     = await prisma.product.upsert({ where: { sku: 'TECH-001' }, update: {}, create: { name: 'MacBook Pro 16"',         sku: 'TECH-001', costPrice: 28000, sellingPrice: 35000, stock: 25, minStockLevel: 5,  categoryId: electronics.id, supplierId: techSupplier.id } });
  const phone      = await prisma.product.upsert({ where: { sku: 'TECH-002' }, update: {}, create: { name: 'iPhone 15 Pro',            sku: 'TECH-002', costPrice: 18000, sellingPrice: 24000, stock: 39, minStockLevel: 10, categoryId: electronics.id, supplierId: techSupplier.id } });
  const headphones = await prisma.product.upsert({ where: { sku: 'TECH-003' }, update: {}, create: { name: 'Sony WH-1000XM5',          sku: 'TECH-003', costPrice: 4500,  sellingPrice: 6500,  stock: 7,  minStockLevel: 10, categoryId: electronics.id, supplierId: techSupplier.id } });
  const watch      = await prisma.product.upsert({ where: { sku: 'TECH-005' }, update: {}, create: { name: 'Apple Watch Ultra 2',       sku: 'TECH-005', costPrice: 9000,  sellingPrice: 13000, stock: 18, minStockLevel: 5,  categoryId: electronics.id, supplierId: techSupplier.id } });
  const shirt      = await prisma.product.upsert({ where: { sku: 'CLO-001'  }, update: {}, create: { name: 'Premium Cotton T-Shirt',    sku: 'CLO-001',  costPrice: 350,   sellingPrice: 650,   stock: 150,minStockLevel: 20, categoryId: clothing.id,    supplierId: fashionSupplier.id } });
  const jeans      = await prisma.product.upsert({ where: { sku: 'CLO-002'  }, update: {}, create: { name: 'Slim Fit Denim Jeans',      sku: 'CLO-002',  costPrice: 900,   sellingPrice: 1600,  stock: 75, minStockLevel: 15, categoryId: clothing.id,    supplierId: fashionSupplier.id } });
  const sneakers   = await prisma.product.upsert({ where: { sku: 'CLO-003'  }, update: {}, create: { name: 'Running Sneakers Pro',      sku: 'CLO-003',  costPrice: 1200,  sellingPrice: 2200,  stock: 3,  minStockLevel: 8,  categoryId: clothing.id,    supplierId: fashionSupplier.id } });
  const coffeeProd = await prisma.product.upsert({ where: { sku: 'FOO-001'  }, update: {}, create: { name: 'Arabica Coffee Beans 1kg',  sku: 'FOO-001',  costPrice: 500,   sellingPrice: 850,   stock: 200,minStockLevel: 30, categoryId: food.id,        supplierId: foodSupplier.id } });
  const tea        = await prisma.product.upsert({ where: { sku: 'FOO-002'  }, update: {}, create: { name: 'Green Tea Premium 500g',    sku: 'FOO-002',  costPrice: 280,   sellingPrice: 480,   stock: 120,minStockLevel: 20, categoryId: food.id,        supplierId: foodSupplier.id } });
  await prisma.product.upsert({ where: { sku: 'FUR-001' }, update: {}, create: { name: 'Standing Desk 160cm',    sku: 'FUR-001', costPrice: 7000,  sellingPrice: 12000, stock: 12, minStockLevel: 3, categoryId: furniture.id } });
  await prisma.product.upsert({ where: { sku: 'FUR-002' }, update: {}, create: { name: 'Ergonomic Office Chair', sku: 'FUR-002', costPrice: 5500,  sellingPrice: 9500,  stock: 9,  minStockLevel: 3, categoryId: furniture.id } });

  // ── Electronics Products (ELC-001 to ELC-030) ──────────────────────────────
  const elcItems = [
    { sku: 'ELC-001', name: 'LED Bulb 9W',                  cost: 120,  sell: 180,  stock: 50, min: 10 },
    { sku: 'ELC-002', name: 'LED Bulb 15W',                 cost: 180,  sell: 280,  stock: 35, min: 10 },
    { sku: 'ELC-003', name: 'Extension Cord',               cost: 280,  sell: 450,  stock: 20, min: 8  },
    { sku: 'ELC-004', name: 'Power Strip',                  cost: 480,  sell: 750,  stock: 15, min: 5  },
    { sku: 'ELC-005', name: 'Phone Charger',                cost: 400,  sell: 650,  stock: 30, min: 10 },
    { sku: 'ELC-006', name: 'USB Charging Cable',           cost: 150,  sell: 250,  stock: 45, min: 15 },
    { sku: 'ELC-007', name: 'Wireless Mouse',               cost: 580,  sell: 900,  stock: 18, min: 5  },
    { sku: 'ELC-008', name: 'Wired Keyboard',               cost: 750,  sell: 1200, stock: 12, min: 5  },
    { sku: 'ELC-009', name: 'USB Flash Drive 32GB',         cost: 550,  sell: 850,  stock: 25, min: 10 },
    { sku: 'ELC-010', name: 'Bluetooth Speaker',            cost: 1400, sell: 2200, stock: 10, min: 5  },
    { sku: 'ELC-011', name: 'Earphones',                    cost: 220,  sell: 350,  stock: 40, min: 15 },
    { sku: 'ELC-012', name: 'Headphones',                   cost: 900,  sell: 1450, stock: 15, min: 5  },
    { sku: 'ELC-013', name: 'Electric Kettle',              cost: 1100, sell: 1800, stock: 8,  min: 5  },
    { sku: 'ELC-014', name: 'Rice Cooker',                  cost: 2000, sell: 3200, stock: 7,  min: 3  },
    { sku: 'ELC-015', name: 'Electric Iron',                cost: 1100, sell: 1750, stock: 10, min: 5  },
    { sku: 'ELC-016', name: 'Table Fan',                    cost: 1600, sell: 2500, stock: 9,  min: 5  },
    { sku: 'ELC-017', name: 'Desk Lamp',                    cost: 600,  sell: 950,  stock: 22, min: 8  },
    { sku: 'ELC-018', name: 'Calculator',                   cost: 280,  sell: 450,  stock: 30, min: 10 },
    { sku: 'ELC-019', name: 'Power Bank 10000mAh',          cost: 1100, sell: 1800, stock: 14, min: 5  },
    { sku: 'ELC-020', name: 'Wall Clock',                   cost: 520,  sell: 850,  stock: 16, min: 5  },
    { sku: 'ELC-021', name: 'TV Remote Control',            cost: 200,  sell: 320,  stock: 18, min: 8  },
    { sku: 'ELC-022', name: 'AA Batteries (Pack)',          cost: 75,   sell: 120,  stock: 60, min: 20 },
    { sku: 'ELC-023', name: 'AAA Batteries (Pack)',         cost: 75,   sell: 120,  stock: 55, min: 20 },
    { sku: 'ELC-024', name: 'Rechargeable Battery Charger', cost: 600,  sell: 950,  stock: 8,  min: 5  },
    { sku: 'ELC-025', name: 'LED Emergency Light',          cost: 850,  sell: 1350, stock: 12, min: 5  },
    { sku: 'ELC-026', name: 'Portable Radio',               cost: 750,  sell: 1200, stock: 6,  min: 3  },
    { sku: 'ELC-027', name: 'Wi-Fi Router',                 cost: 1600, sell: 2500, stock: 10, min: 3  },
    { sku: 'ELC-028', name: 'HDMI Cable',                   cost: 280,  sell: 450,  stock: 24, min: 8  },
    { sku: 'ELC-029', name: 'Computer Monitor 24"',         cost: 6000, sell: 9500, stock: 5,  min: 3  },
    { sku: 'ELC-030', name: 'Laptop Cooling Pad',           cost: 880,  sell: 1400, stock: 11, min: 5  },
  ];
  for (const item of elcItems) {
    await prisma.product.upsert({
      where: { sku: item.sku }, update: {},
      create: { name: item.name, sku: item.sku, costPrice: item.cost, sellingPrice: item.sell, stock: item.stock, minStockLevel: item.min, categoryId: electronics.id, supplierId: techSupplier.id },
    });
  }

  // ── Household & Shop Materials (INV-001 to INV-030) ───────────────────────
  const hhItems = [
    { sku: 'INV-001', name: 'Plastic Bucket',          cost: 55,  sell: 90,   stock: 45, min: 10 },
    { sku: 'INV-002', name: 'Plastic Basin',           cost: 45,  sell: 80,   stock: 38, min: 10 },
    { sku: 'INV-003', name: 'Broom',                   cost: 35,  sell: 65,   stock: 25, min: 8  },
    { sku: 'INV-004', name: 'Mop',                     cost: 80,  sell: 140,  stock: 15, min: 8  },
    { sku: 'INV-005', name: 'Soap',                    cost: 40,  sell: 65,   stock: 60, min: 20 },
    { sku: 'INV-006', name: 'Laundry Detergent',       cost: 180, sell: 280,  stock: 30, min: 10 },
    { sku: 'INV-007', name: 'Cooking Oil (1L)',         cost: 180, sell: 280,  stock: 22, min: 10 },
    { sku: 'INV-008', name: 'Sugar (1kg)',              cost: 65,  sell: 110,  stock: 40, min: 15 },
    { sku: 'INV-009', name: 'Salt (1kg)',               cost: 18,  sell: 35,   stock: 55, min: 20 },
    { sku: 'INV-010', name: 'Teff Flour (1kg)',         cost: 95,  sell: 160,  stock: 18, min: 10 },
    { sku: 'INV-011', name: 'Berbere Spice (500g)',     cost: 75,  sell: 130,  stock: 12, min: 10 },
    { sku: 'INV-012', name: 'Shiro Flour (1kg)',        cost: 70,  sell: 120,  stock: 28, min: 10 },
    { sku: 'INV-013', name: 'Coffee Beans (1kg)',       cost: 380, sell: 620,  stock: 16, min: 8  },
    { sku: 'INV-014', name: 'Charcoal Bag',             cost: 200, sell: 350,  stock: 9,  min: 5  },
    { sku: 'INV-015', name: 'Matches',                  cost: 5,   sell: 12,   stock: 75, min: 30 },
    { sku: 'INV-016', name: 'Candle Pack',              cost: 30,  sell: 55,   stock: 20, min: 10 },
    { sku: 'INV-017', name: 'Notebook',                 cost: 35,  sell: 65,   stock: 35, min: 15 },
    { sku: 'INV-018', name: 'Ballpoint Pen',            cost: 7,   sell: 15,   stock: 80, min: 30 },
    { sku: 'INV-019', name: 'Exercise Book',            cost: 25,  sell: 45,   stock: 50, min: 20 },
    { sku: 'INV-020', name: 'A4 Paper (500 Sheets)',    cost: 280, sell: 480,  stock: 12, min: 5  },
    { sku: 'INV-021', name: 'Plastic Chair',            cost: 380, sell: 620,  stock: 14, min: 5  },
    { sku: 'INV-022', name: 'Plastic Table',            cost: 800, sell: 1350, stock: 8,  min: 3  },
    { sku: 'INV-023', name: 'Steel Cup',                cost: 40,  sell: 75,   stock: 30, min: 10 },
    { sku: 'INV-024', name: 'Steel Plate',              cost: 60,  sell: 110,  stock: 25, min: 10 },
    { sku: 'INV-025', name: 'Aluminum Pot',             cost: 550, sell: 950,  stock: 10, min: 5  },
    { sku: 'INV-026', name: 'Jebena Coffee Pot',        cost: 380, sell: 620,  stock: 7,  min: 5  },
    { sku: 'INV-027', name: 'Coffee Cups Set',          cost: 280, sell: 480,  stock: 18, min: 8  },
    { sku: 'INV-028', name: 'Water Jerrycan (20L)',      cost: 200, sell: 350,  stock: 24, min: 8  },
    { sku: 'INV-029', name: 'Rope (10m)',               cost: 55,  sell: 100,  stock: 32, min: 10 },
    { sku: 'INV-030', name: 'Flashlight',               cost: 180, sell: 300,  stock: 11, min: 5  },
  ];
  for (const item of hhItems) {
    await prisma.product.upsert({
      where: { sku: item.sku }, update: {},
      create: { name: item.name, sku: item.sku, costPrice: item.cost, sellingPrice: item.sell, stock: item.stock, minStockLevel: item.min, categoryId: household.id, supplierId: householdSupplier.id },
    });
  }

  // ── Traditional Items (TRD-001 to TRD-020) ────────────────────────────────
  const trdItems = [
    { sku: 'TRD-001', name: 'Traditional Habesha Kemis',       amharic: 'ሐበሻ ቀሚስ',      region: 'Amhara',    material: 'Cotton',      cat: 'Clothing & Textiles',  cost: 1200, sell: 1800, stock: 18, min: 5,  cultural: 'The Habesha Kemis is the national dress of Ethiopian women, worn during festivals, religious celebrations, and weddings.' },
    { sku: 'TRD-002', name: 'Netela (Handwoven Shawl)',        amharic: 'ነጠላ',            region: 'Amhara',    material: 'Cotton',      cat: 'Clothing & Textiles',  cost: 420,  sell: 700,  stock: 30, min: 8,  cultural: 'The Netela is a lightweight white shawl worn by Ethiopian women and used as a church veil or everyday accessory.' },
    { sku: 'TRD-003', name: 'Gabi (Traditional Blanket)',      amharic: 'ጋቢ',             region: 'Nationwide',material: 'Cotton',      cat: 'Clothing & Textiles',  cost: 1100, sell: 1800, stock: 12, min: 5,  cultural: 'The Gabi is a thick handwoven blanket used across Ethiopia for warmth during cold seasons and religious ceremonies.' },
    { sku: 'TRD-004', name: 'Jebena Coffee Pot',               amharic: 'ጀበና',            region: 'Nationwide',material: 'Clay',        cat: 'Coffee Ceremony',      cost: 850,  sell: 1400, stock: 9,  min: 5,  cultural: 'The Jebena is a clay coffee pot central to the Ethiopian coffee ceremony, one of the most important social traditions.' },
    { sku: 'TRD-005', name: 'Rekebot Coffee Tray',             amharic: 'ረከቦት',           region: 'Nationwide',material: 'Wicker/Wood', cat: 'Coffee Ceremony',      cost: 950,  sell: 1600, stock: 15, min: 5,  cultural: 'The Rekebot is a traditional circular tray used to hold coffee cups during the Ethiopian coffee ceremony.' },
    { sku: 'TRD-006', name: 'Sini Coffee Cups Set',            amharic: 'ሲኒ',             region: 'Nationwide',material: 'Ceramic',     cat: 'Coffee Ceremony',      cost: 500,  sell: 850,  stock: 20, min: 8,  cultural: 'Sini are small handleless cups used in the Ethiopian coffee ceremony, typically served with sugar or salt.' },
    { sku: 'TRD-007', name: 'Mukecha (Wooden Mortar)',         amharic: 'ሙቀጫ',            region: 'Nationwide',material: 'Wood',        cat: 'Wooden Crafts',        cost: 900,  sell: 1500, stock: 6,  min: 3,  cultural: 'The Mukecha is a traditional wooden mortar and pestle used to grind coffee beans and spices like berbere.' },
    { sku: 'TRD-008', name: 'Mesob Basket',                    amharic: 'መሶብ',            region: 'SNNPR',     material: 'Wicker',      cat: 'Baskets & Weaving',    cost: 1500, sell: 2500, stock: 14, min: 5,  cultural: 'The Mesob is a colorful woven basket used as a traditional table to serve injera and communal meals.' },
    { sku: 'TRD-009', name: 'Shekla Clay Plate',               amharic: 'ሸቅላ',            region: 'Amhara',    material: 'Clay',        cat: 'Pottery & Ceramics',   cost: 300,  sell: 500,  stock: 25, min: 8,  cultural: 'Shekla are handmade clay plates used to serve injera, Ethiopia\'s staple flatbread, in traditional households.' },
    { sku: 'TRD-010', name: 'Kebero Drum',                     amharic: 'ከበሮ',            region: 'Amhara',    material: 'Wood/Hide',   cat: 'Musical Instruments',  cost: 2500, sell: 4000, stock: 5,  min: 2,  cultural: 'The Kebero is a double-headed drum used in Ethiopian Orthodox church music and traditional celebrations.' },
    { sku: 'TRD-011', name: 'Krar (Traditional Lyre)',         amharic: 'ክራር',            region: 'Amhara',    material: 'Wood/String', cat: 'Musical Instruments',  cost: 3200, sell: 5200, stock: 4,  min: 2,  cultural: 'The Krar is a six-stringed lyre, one of Ethiopia\'s oldest and most beloved traditional instruments.' },
    { sku: 'TRD-012', name: 'Masenqo',                         amharic: 'ማሲንቆ',           region: 'Amhara',    material: 'Wood/String', cat: 'Musical Instruments',  cost: 2600, sell: 4200, stock: 3,  min: 2,  cultural: 'The Masenqo is a single-stringed bowed instrument played by Azmari musicians at traditional festivities.' },
    { sku: 'TRD-013', name: 'Traditional Coffee Roaster',      amharic: 'ምጣድ',            region: 'Nationwide',material: 'Iron',        cat: 'Coffee Ceremony',      cost: 480,  sell: 800,  stock: 10, min: 5,  cultural: 'The MeTad is a flat iron pan used to roast green coffee beans over charcoal in the traditional ceremony.' },
    { sku: 'TRD-014', name: 'Incense Burner (Etan Holder)',    amharic: 'እጣን ማቀጣጠያ',    region: 'Nationwide',material: 'Clay/Metal',  cat: 'Religious Items',      cost: 600,  sell: 1000, stock: 8,  min: 5,  cultural: 'Etan (frankincense) is burned during the coffee ceremony and religious occasions to bless the home.' },
    { sku: 'TRD-015', name: 'Cross Pendant (Ethiopian Design)',amharic: 'የኢትዮጵያ መስቀል',  region: 'Nationwide',material: 'Silver',      cat: 'Jewelry & Accessories',cost: 900,  sell: 1500, stock: 22, min: 8,  cultural: 'Ethiopian cross pendants feature unique geometric designs used in the Orthodox Christian tradition since the 4th century.' },
    { sku: 'TRD-016', name: 'Handwoven Scarf',                 amharic: 'ሻሽ',             region: 'Tigray',    material: 'Cotton',      cat: 'Clothing & Textiles',  cost: 650,  sell: 1100, stock: 17, min: 8,  cultural: 'Handwoven scarves from Tigray feature intricate patterns passed down through generations of weavers.' },
    { sku: 'TRD-017', name: 'Leather Sandals',                 amharic: 'ጫማ',             region: 'Harari',    material: 'Leather',     cat: 'Leather Goods',        cost: 950,  sell: 1600, stock: 13, min: 5,  cultural: 'Traditional Ethiopian leather sandals are handcrafted in Harar and Addis Ababa, known for their durability.' },
    { sku: 'TRD-018', name: 'Traditional Clay Pot',            amharic: 'ሸክላ ድስት',       region: 'Oromia',    material: 'Clay',        cat: 'Pottery & Ceramics',   cost: 850,  sell: 1400, stock: 7,  min: 3,  cultural: 'Clay pots are used for cooking, brewing tej (honey wine), and storing grains in Ethiopian homes.' },
    { sku: 'TRD-019', name: 'Traditional Wooden Spoon Set',    amharic: 'የእንጨት ማንኪያ',  region: 'SNNPR',     material: 'Wood',        cat: 'Wooden Crafts',        cost: 280,  sell: 480,  stock: 28, min: 10, cultural: 'Hand-carved wooden spoons from southern Ethiopia are used for cooking injera batter and serving food.' },
    { sku: 'TRD-020', name: 'Ethiopian Spice Basket',          amharic: 'የቅመም ቅርጫት',   region: 'Amhara',    material: 'Wicker',      cat: 'Spices & Food',        cost: 0,    sell: 0,    stock: 0,  min: 5,  cultural: 'Decorative wicker baskets used to store and display traditional Ethiopian spices like berbere and mitmita.', status: 'OUT_OF_STOCK' },
  ];
  for (const item of trdItems) {
    const existing = await prisma.traditionalItem.findFirst({ where: { name: item.name } });
    if (!existing) {
      await prisma.traditionalItem.create({
        data: {
          name: item.name, amharicName: item.amharic, region: item.region,
          material: item.material, category: item.cat,
          culturalNote: item.cultural,
          costPrice: item.cost, sellingPrice: item.sell,
          stock: item.stock, minStockLevel: item.min,
          status: (item as any).status || (item.stock === 0 ? 'OUT_OF_STOCK' : 'ACTIVE'),
        },
      });
    }
  }

  // ── Helper: build sale with correct VAT fields ────────────────────────────
  function makeSale(invoiceNo: string, items: { productId: string; quantity: number; price: number }[]) {
    const subtotal    = items.reduce((s, i) => s + i.quantity * i.price, 0);
    const vatAmount   = Math.round(subtotal * 0.15 * 100) / 100;
    const totalAmount = Math.round((subtotal + vatAmount) * 100) / 100;
    return { invoiceNo, subtotal, vatAmount, totalAmount, items: { create: items } };
  }

  // ── Sales (only if none exist) ─────────────────────────────────────────────
  const existingSales = await prisma.sale.count();
  if (existingSales === 0) {
    const saleDefs = [
      { inv: 'INV-1001', cust: c1.id, items: [{ productId: phone.id,      quantity: 1, price: 24000 }] },
      { inv: 'INV-1002', cust: c2.id, items: [{ productId: laptop.id,     quantity: 1, price: 35000 }, { productId: headphones.id, quantity: 1, price: 6500 }] },
      { inv: 'INV-1003', cust: c3.id, items: [{ productId: shirt.id,      quantity: 4, price: 650   }, { productId: coffeeProd.id, quantity: 5, price: 850  }] },
      { inv: 'INV-1004', cust: c1.id, items: [{ productId: watch.id,      quantity: 1, price: 13000 }] },
      { inv: 'INV-1005', cust: c2.id, items: [{ productId: jeans.id,      quantity: 2, price: 1600  }, { productId: shirt.id, quantity: 3, price: 650 }, { productId: tea.id, quantity: 6, price: 480 }] },
      { inv: 'INV-1006', cust: c3.id, items: [{ productId: sneakers.id,   quantity: 2, price: 2200  }, { productId: watch.id, quantity: 1, price: 13000 }] },
      { inv: 'INV-1007', cust: c1.id, items: [{ productId: coffeeProd.id, quantity: 10, price: 850  }, { productId: tea.id,  quantity: 5, price: 480 }] },
      { inv: 'INV-1008', cust: c2.id, items: [{ productId: headphones.id, quantity: 1, price: 6500  }, { productId: shirt.id, quantity: 5, price: 650 }] },
    ];
    for (const s of saleDefs) {
      const sale = makeSale(s.inv, s.items);
      await prisma.sale.create({ data: { ...sale, customerId: s.cust, userId: admin.id } });
    }
    await prisma.activityLog.createMany({ data: [
      { userId: admin.id, action: 'SALE_COMPLETED', details: 'Sale INV-1001 — ETB 24,000' },
      { userId: admin.id, action: 'SALE_COMPLETED', details: 'Sale INV-1002 — ETB 41,500' },
      { userId: admin.id, action: 'SALE_COMPLETED', details: 'Sale INV-1003 — ETB 4,550'  },
      { userId: admin.id, action: 'SALE_COMPLETED', details: 'Sale INV-1004 — ETB 13,000' },
      { userId: admin.id, action: 'SALE_COMPLETED', details: 'Sale INV-1005 — ETB 9,150'  },
      { userId: admin.id, action: 'USER_LOGGED_IN',  details: 'Admin logged in'            },
    ]});
  }

  console.log('');
  console.log('✅ Database seeded!');
  console.log('  71 products  (11 original + 30 electronics + 30 household)');
  console.log('  20 traditional items');
  console.log('');
  console.log('Login credentials:');
  console.log('  Admin:   admin@store.com   / admin123');
  console.log('  Manager: manager@store.com / manager123');
  console.log('  Cashier: cashier@store.com / cashier123');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
