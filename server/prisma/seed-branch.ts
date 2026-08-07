import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.branch.upsert({
    where: { name: 'Main Branch' }, update: {},
    create: { name: 'Main Branch', address: 'Addis Ababa, Ethiopia', phone: '+251-911-000000', manager: 'Admin User', isActive: true },
  });
  await prisma.branch.upsert({
    where: { name: 'Merkato Branch' }, update: {},
    create: { name: 'Merkato Branch', address: 'Merkato, Addis Ababa', phone: '+251-911-000001', manager: 'Store Manager', isActive: true },
  });
  await prisma.branch.upsert({
    where: { name: 'Bole Branch' }, update: {},
    create: { name: 'Bole Branch', address: 'Bole, Addis Ababa', phone: '+251-911-000002', manager: '', isActive: true },
  });
  console.log('Branches seeded');
}
main().catch(console.error).finally(() => prisma.$disconnect());
