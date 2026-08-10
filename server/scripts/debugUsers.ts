/**
 * Debug Users Script
 * 
 * This script checks existing users and tests password validation
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function debugUsers() {
  console.log('=== DEBUGGING USERS ===\n');

  // Check all users
  const users = await prisma.user.findMany();
  console.log(`Found ${users.length} users in database:`);
  
  for (const user of users) {
    console.log(`\n--- User ---`);
    console.log(`ID: ${user.id}`);
    console.log(`Name: ${user.name}`);
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role}`);
    console.log(`Password Hash: ${user.password.substring(0, 20)}...`);
    
    // Test password comparison
    const testPassword = 'admin123';
    const isValid = await bcrypt.compare(testPassword, user.password);
    console.log(`Password 'admin123' valid: ${isValid}`);
    
    // Test with different variations
    const variations = ['admin123', 'Admin123', 'ADMIN123'];
    for (const variation of variations) {
      const valid = await bcrypt.compare(variation, user.password);
      console.log(`Password '${variation}' valid: ${valid}`);
    }
  }

  if (users.length === 0) {
    console.log('\n❌ No users found in database!');
    console.log('The super admin creation may have failed.');
  }
}

debugUsers()
  .catch((error) => {
    console.error('Error debugging users:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });