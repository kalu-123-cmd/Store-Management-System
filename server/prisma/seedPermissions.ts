/**
 * Seed Permissions Script
 * 
 * Creates the comprehensive permission system with all required permissions
 * and assigns them to appropriate roles for the Ethiopian Smart Store OS.
 * 
 * Run with: npx tsx prisma/seedPermissions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PERMISSIONS = [
  // Product Permissions
  { name: 'product:view', module: 'product', action: 'read', description: 'View products' },
  { name: 'product:create', module: 'product', action: 'create', description: 'Create new products' },
  { name: 'product:update', module: 'product', action: 'update', description: 'Update product details' },
  { name: 'product:delete', module: 'product', action: 'delete', description: 'Delete products' },
  { name: 'product:adjust_price', module: 'product', action: 'update', description: 'Adjust product prices' },
  
  // Inventory Permissions
  { name: 'inventory:view', module: 'inventory', action: 'read', description: 'View inventory' },
  { name: 'inventory:adjust', module: 'inventory', action: 'update', description: 'Adjust stock levels' },
  { name: 'inventory:transfer', module: 'inventory', action: 'update', description: 'Transfer stock between locations' },
  { name: 'inventory:audit', module: 'inventory', action: 'read', description: 'View inventory audits' },
  
  // Procurement Permissions
  { name: 'procurement:view', module: 'procurement', action: 'read', description: 'View procurement requests' },
  { name: 'procurement:create', module: 'procurement', action: 'create', description: 'Create procurement requests' },
  { name: 'procurement:approve', module: 'procurement', action: 'approve', description: 'Approve procurement requests' },
  { name: 'procurement:reject', module: 'procurement', action: 'approve', description: 'Reject procurement requests' },
  { name: 'procurement:receive', module: 'procurement', action: 'update', description: 'Receive goods' },
  
  // Sales Permissions
  { name: 'sale:view', module: 'sales', action: 'read', description: 'View sales' },
  { name: 'sale:create', module: 'sales', action: 'create', description: 'Create sales' },
  { name: 'sale:refund', module: 'sales', action: 'update', description: 'Process refunds' },
  { name: 'sale:discount', module: 'sales', action: 'update', description: 'Apply discounts' },
  { name: 'sale:void', module: 'sales', action: 'delete', description: 'Void sales' },
  
  // Payment Permissions
  { name: 'payment:view', module: 'payments', action: 'read', description: 'View payments' },
  { name: 'payment:process', module: 'payments', action: 'create', description: 'Process payments' },
  { name: 'payment:reconcile', module: 'payments', action: 'update', description: 'Reconcile payments' },
  { name: 'payment:approve', module: 'payments', action: 'approve', description: 'Approve payments' },
  
  // Financial Permissions
  { name: 'financial:view', module: 'financial', action: 'read', description: 'View financial data' },
  { name: 'financial:reports', module: 'financial', action: 'read', description: 'View financial reports' },
  { name: 'financial:approve', module: 'financial', action: 'approve', description: 'Approve financial transactions' },
  
  // User Management Permissions
  { name: 'user:view', module: 'users', action: 'read', description: 'View users' },
  { name: 'user:create', module: 'users', action: 'create', description: 'Create users' },
  { name: 'user:update', module: 'users', action: 'update', description: 'Update user details' },
  { name: 'user:delete', module: 'users', action: 'delete', description: 'Delete users' },
  { name: 'user:manage_roles', module: 'users', action: 'approve', description: 'Manage user roles' },
  
  // Organization Permissions
  { name: 'organization:view', module: 'organization', action: 'read', description: 'View organization details' },
  { name: 'organization:manage', module: 'organization', action: 'update', description: 'Manage organization' },
  { name: 'organization:configure', module: 'organization', action: 'update', description: 'Configure organization settings' },
  
  // Report Permissions
  { name: 'report:view', module: 'reports', action: 'read', description: 'View reports' },
  { name: 'report:export', module: 'reports', action: 'read', description: 'Export reports' },
  { name: 'report:schedule', module: 'reports', action: 'update', description: 'Schedule reports' },
  
  // Settings Permissions
  { name: 'settings:view', module: 'settings', action: 'read', description: 'View settings' },
  { name: 'settings:modify', module: 'settings', action: 'update', description: 'Modify settings' },
  { name: 'settings:system', module: 'settings', action: 'update', description: 'System-level settings' },
];

const ROLE_PERMISSIONS = {
  SUPER_ADMIN: PERMISSIONS.map(p => p.name), // All permissions
  OWNER: PERMISSIONS.map(p => p.name), // All permissions
  MANAGER: [
    // Products
    'product:view', 'product:create', 'product:update',
    // Inventory
    'inventory:view', 'inventory:adjust', 'inventory:transfer',
    // Procurement
    'procurement:view', 'procurement:create', 'procurement:approve', 'procurement:receive',
    // Sales
    'sale:view', 'sale:create', 'sale:refund', 'sale:discount',
    // Payments
    'payment:view', 'payment:process', 'payment:reconcile',
    // Financial
    'financial:view', 'financial:reports',
    // Users
    'user:view', 'user:create', 'user:update',
    // Organization
    'organization:view', 'organization:manage',
    // Reports
    'report:view', 'report:export',
    // Settings
    'settings:view', 'settings:modify',
  ],
  PURCHASING_MANAGER: [
    // Products
    'product:view', 'product:update',
    // Inventory
    'inventory:view', 'inventory:transfer',
    // Procurement
    'procurement:view', 'procurement:create', 'procurement:approve', 'procurement:reject', 'procurement:receive',
    // Sales
    'sale:view',
    // Financial
    'financial:view',
    // Reports
    'report:view', 'report:export',
  ],
  WAREHOUSE_MANAGER: [
    // Products
    'product:view',
    // Inventory
    'inventory:view', 'inventory:adjust', 'inventory:audit',
    // Procurement
    'procurement:view', 'procurement:receive',
    // Reports
    'report:view',
  ],
  CASHIER: [
    // Products
    'product:view',
    // Inventory
    'inventory:view',
    // Sales
    'sale:view', 'sale:create',
    // Payments
    'payment:view', 'payment:process',
  ],
  ACCOUNTANT: [
    // Financial
    'financial:view', 'financial:reports', 'financial:approve',
    // Payments
    'payment:view', 'payment:reconcile',
    // Reports
    'report:view', 'report:export',
    // Sales
    'sale:view',
  ],
  SALES_STAFF: [
    // Products
    'product:view',
    // Sales
    'sale:view', 'sale:create',
    // Payments
    'payment:view', 'payment:process',
  ],
  AUDITOR: [
    // All view permissions
    'product:view',
    'inventory:view', 'inventory:audit',
    'procurement:view',
    'sale:view',
    'payment:view',
    'financial:view', 'financial:reports',
    'user:view',
    'organization:view',
    'report:view', 'report:export',
    'settings:view',
  ],
};

async function main() {
  console.log('🔐 Seeding Permissions System...\n');

  // Create permissions
  console.log('Creating permissions...');
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
  }
  console.log(`✅ Created ${PERMISSIONS.length} permissions\n`);

  // Create or update roles with permissions
  console.log('Updating roles with permissions...');
  for (const [roleName, permissionNames] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
        description: `${roleName} role`,
        level: roleName === 'SUPER_ADMIN' ? 100 : 
                 roleName === 'OWNER' ? 90 :
                 roleName === 'MANAGER' ? 80 :
                 roleName === 'PURCHASING_MANAGER' ? 70 :
                 roleName === 'WAREHOUSE_MANAGER' ? 60 :
                 roleName === 'CASHIER' ? 40 :
                 roleName === 'ACCOUNTANT' ? 70 :
                 roleName === 'SALES_STAFF' ? 30 :
                 roleName === 'AUDITOR' ? 50 : 0,
        isSystem: true,
      },
    });

    // Clear existing permissions for this role
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id },
    });

    // Add new permissions
    for (const permName of permissionNames) {
      const permission = await prisma.permission.findUnique({
        where: { name: permName },
      });

      if (permission) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }

    console.log(`✅ ${roleName}: ${permissionNames.length} permissions`);
  }

  console.log('\n✅ Permission system seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding permissions:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });