/**
 * Test Login Directly
 * 
 * This script tests the login logic directly without the frontend
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_jwt_key_12345';

async function testLogin() {
  console.log('=== TESTING LOGIN LOGIC ===\n');

  const testEmail = 'admin@storemanagement.com';
  const testPassword = 'admin123';

  console.log(`Testing login with:`);
  console.log(`Email: ${testEmail}`);
  console.log(`Password: ${testPassword}\n`);

  // Find user
  const user = await prisma.user.findUnique({ where: { email: testEmail } });
  
  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log('✅ User found:', user.name);
  console.log('   Email:', user.email);
  console.log('   Role:', user.role);

  // Validate password
  const valid = await bcrypt.compare(testPassword, user.password);
  console.log(`   Password valid: ${valid}`);

  if (!valid) {
    console.log('❌ Invalid password');
    return;
  }

  // Generate token
  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  console.log('✅ Login successful!');
  console.log('   Token:', token.substring(0, 50) + '...');
  
  // Try with case variations
  console.log('\n--- Testing email case variations ---');
  const emailVariations = [
    'admin@storemanagement.com',
    'Admin@storemanagement.com',
    'ADMIN@storemanagement.com',
    'admin@StoreManagement.com',
  ];

  for (const email of emailVariations) {
    const found = await prisma.user.findUnique({ where: { email } });
    console.log(`'${email}': ${found ? '✅ Found' : '❌ Not found'}`);
  }
}

testLogin()
  .catch((error) => {
    console.error('Error testing login:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });