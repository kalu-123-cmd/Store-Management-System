/**
 * Create Super Admin User Script
 * 
 * This script creates a default super admin user for the system
 * if one doesn't already exist.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createSuperAdmin() {
  console.log('Checking for existing users...');

  // Check if any users exist
  const existingUsers = await prisma.user.findMany();
  console.log(`Found ${existingUsers.length} existing users:`);
  existingUsers.forEach(user => {
    console.log(`- ${user.name} (${user.email}) - ${user.role}`);
  });

  // Check if super admin already exists
  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  });

  if (existingAdmin) {
    console.log('✅ Super admin already exists:', existingAdmin.email);
    console.log('   You can log in with:', existingAdmin.email);
    return;
  }

  // Create super admin
  console.log('Creating super admin user...');

  const hashedPassword = await bcrypt.hash('admin123', 10);

  const superAdmin = await prisma.user.create({
    data: {
      name: 'Super Admin',
      email: 'admin@storemanagement.com',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  console.log('✅ Super admin created successfully!');
  console.log('📧 Email:', superAdmin.email);
  console.log('🔑 Password: admin123');
  console.log('🎭 Role:', superAdmin.role);
  console.log('');
  console.log('You can now log in with these credentials.');
  console.log('Please change the password after first login for security.');
}

createSuperAdmin()
  .catch((error) => {
    console.error('Error creating super admin:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });