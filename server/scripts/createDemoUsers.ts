/**
 * Create Demo Users Script
 * 
 * This script creates demo users for the system:
 * - Admin (already exists)
 * - Manager
 * - Cashier
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createDemoUsers() {
  console.log('=== CREATING DEMO USERS ===\n');

  const demoUsers = [
    {
      name: 'Store Manager',
      email: 'manager@storemanagement.com',
      password: 'manager123',
      role: 'MANAGER',
    },
    {
      name: 'Cashier User',
      email: 'cashier@storemanagement.com',
      password: 'cashier123',
      role: 'CASHIER',
    },
  ];

  for (const demoUser of demoUsers) {
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: demoUser.email },
    });

    if (existing) {
      console.log(`✅ User already exists: ${demoUser.email} (${demoUser.role})`);
      continue;
    }

    // Create user
    const hashedPassword = await bcrypt.hash(demoUser.password, 10);
    const user = await prisma.user.create({
      data: {
        name: demoUser.name,
        email: demoUser.email,
        password: hashedPassword,
        role: demoUser.role,
      },
    });

    console.log(`✅ Created: ${demoUser.email} (${demoUser.role})`);
    console.log(`   Password: ${demoUser.password}`);
  }

  // List all users
  console.log('\n=== ALL USERS ===');
  const allUsers = await prisma.user.findMany({
    select: { name: true, email: true, role: true },
  });

  allUsers.forEach(user => {
    console.log(`- ${user.name} (${user.email}) - ${user.role}`);
  });

  console.log('\n🎯 You can now log in with any of these accounts:');
  console.log('   Admin: admin@storemanagement.com / admin123');
  console.log('   Manager: manager@storemanagement.com / manager123');
  console.log('   Cashier: cashier@storemanagement.com / cashier123');
}

createDemoUsers()
  .catch((error) => {
    console.error('Error creating demo users:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });