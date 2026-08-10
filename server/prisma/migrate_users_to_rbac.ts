import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateUsersToRBAC() {
  console.log('Starting RBAC migration...');

  try {
    // Create default roles
    console.log('Creating default roles...');
    const superAdmin = await prisma.role.upsert({
      where: { name: 'SUPER_ADMIN' },
      update: {},
      create: {
        name: 'SUPER_ADMIN',
        description: 'Full system access',
        level: 100,
        isSystem: true,
      },
    });

    const orgAdmin = await prisma.role.upsert({
      where: { name: 'ORGANIZATION_ADMIN' },
      update: {},
      create: {
        name: 'ORGANIZATION_ADMIN',
        description: 'Organization-level administrator',
        level: 90,
        isSystem: true,
      },
    });

    const warehouseManager = await prisma.role.upsert({
      where: { name: 'WAREHOUSE_MANAGER' },
      update: {},
      create: {
        name: 'WAREHOUSE_MANAGER',
        description: 'Warehouse operations manager',
        level: 80,
        isSystem: true,
      },
    });

    const storekeeper = await prisma.role.upsert({
      where: { name: 'STOREKEEPER' },
      update: {},
      create: {
        name: 'STOREKEEPER',
        description: 'Inventory management staff',
        level: 70,
        isSystem: true,
      },
    });

    const procurementOfficer = await prisma.role.upsert({
      where: { name: 'PROCUREMENT_OFFICER' },
      update: {},
      create: {
        name: 'PROCUREMENT_OFFICER',
        description: 'Procurement specialist',
        level: 75,
        isSystem: true,
      },
    });

    const financeOfficer = await prisma.role.upsert({
      where: { name: 'FINANCE_OFFICER' },
      update: {},
      create: {
        name: 'FINANCE_OFFICER',
        description: 'Finance and budget management',
        level: 85,
        isSystem: true,
      },
    });

    const departmentHead = await prisma.role.upsert({
      where: { name: 'DEPARTMENT_HEAD' },
      update: {},
      create: {
        name: 'DEPARTMENT_HEAD',
        description: 'Department-level manager',
        level: 60,
        isSystem: true,
      },
    });

    const assetManager = await prisma.role.upsert({
      where: { name: 'ASSET_MANAGER' },
      update: {},
      create: {
        name: 'ASSET_MANAGER',
        description: 'Fixed asset management',
        level: 65,
        isSystem: true,
      },
    });

    const maintenanceOfficer = await prisma.role.upsert({
      where: { name: 'MAINTENANCE_OFFICER' },
      update: {},
      create: {
        name: 'MAINTENANCE_OFFICER',
        description: 'Maintenance and repairs',
        level: 55,
        isSystem: true,
      },
    });

    const auditor = await prisma.role.upsert({
      where: { name: 'AUDITOR' },
      update: {},
      create: {
        name: 'AUDITOR',
        description: 'Audit and compliance',
        level: 95,
        isSystem: true,
      },
    });

    const viewer = await prisma.role.upsert({
      where: { name: 'VIEWER' },
      update: {},
      create: {
        name: 'VIEWER',
        description: 'Read-only access',
        level: 10,
        isSystem: true,
      },
    });

    console.log('Default roles created successfully');

    // Create default permissions
    console.log('Creating default permissions...');
    const permissions = [
      // Inventory permissions
      { name: 'inventory.read', module: 'inventory', action: 'read' },
      { name: 'inventory.create', module: 'inventory', action: 'create' },
      { name: 'inventory.update', module: 'inventory', action: 'update' },
      { name: 'inventory.delete', module: 'inventory', action: 'delete' },
      { name: 'inventory.adjust', module: 'inventory', action: 'adjust' },
      { name: 'inventory.transfer', module: 'inventory', action: 'transfer' },
      { name: 'inventory.audit', module: 'inventory', action: 'audit' },

      // Procurement permissions
      { name: 'procurement.create', module: 'procurement', action: 'create' },
      { name: 'procurement.read', module: 'procurement', action: 'read' },
      { name: 'procurement.update', module: 'procurement', action: 'update' },
      { name: 'procurement.delete', module: 'procurement', action: 'delete' },
      { name: 'procurement.review', module: 'procurement', action: 'review' },
      { name: 'procurement.approve', module: 'procurement', action: 'approve' },

      // Tender permissions
      { name: 'tender.create', module: 'tender', action: 'create' },
      { name: 'tender.read', module: 'tender', action: 'read' },
      { name: 'tender.manage', module: 'tender', action: 'manage' },
      { name: 'tender.evaluate', module: 'tender', action: 'evaluate' },
      { name: 'tender.award', module: 'tender', action: 'award' },

      // Supplier permissions
      { name: 'supplier.manage', module: 'supplier', action: 'manage' },
      { name: 'supplier.evaluate', module: 'supplier', action: 'evaluate' },

      // Asset permissions
      { name: 'asset.read', module: 'asset', action: 'read' },
      { name: 'asset.manage', module: 'asset', action: 'manage' },
      { name: 'asset.assign', module: 'asset', action: 'assign' },
      { name: 'asset.dispose', module: 'asset', action: 'dispose' },
      { name: 'asset.maintain', module: 'asset', action: 'maintain' },

      // User management
      { name: 'user.manage', module: 'user', action: 'manage' },
      { name: 'role.manage', module: 'role', action: 'manage' },

      // Organization management
      { name: 'organization.manage', module: 'organization', action: 'manage' },
      { name: 'department.manage', module: 'department', action: 'manage' },
      { name: 'warehouse.manage', module: 'warehouse', action: 'manage' },

      // Reports
      { name: 'reports.read', module: 'reports', action: 'read' },
      { name: 'reports.export', module: 'reports', action: 'export' },

      // Audit
      { name: 'audit.read', module: 'audit', action: 'read' },
      { name: 'audit.manage', module: 'audit', action: 'manage' },

      // Approvals
      { name: 'approval.approve', module: 'approval', action: 'approve' },
      { name: 'approval.review', module: 'approval', action: 'review' },

      // Documents
      { name: 'document.upload', module: 'document', action: 'upload' },
      { name: 'document.read', module: 'document', action: 'read' },
      { name: 'document.manage', module: 'document', action: 'manage' },

      // Notifications
      { name: 'notification.manage', module: 'notification', action: 'manage' },
    ];

    const createdPermissions = [];
    for (const perm of permissions) {
      const created = await prisma.permission.upsert({
        where: { name: perm.name },
        update: {},
        create: perm,
      });
      createdPermissions.push(created);
    }

    console.log(`Created ${createdPermissions.length} permissions`);

    // Assign permissions to roles
    console.log('Assigning permissions to roles...');

    // Super Admin gets all permissions
    for (const perm of createdPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superAdmin.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: superAdmin.id,
          permissionId: perm.id,
        },
      });
    }

    // Organization Admin gets most permissions except some system-level ones
    const orgAdminPerms = createdPermissions.filter(p => 
      !p.name.includes('role.manage') && 
      !p.name.includes('organization.manage')
    );
    for (const perm of orgAdminPerms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: orgAdmin.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: orgAdmin.id,
          permissionId: perm.id,
        },
      });
    }

    // Warehouse Manager gets inventory and warehouse permissions
    const warehouseManagerPerms = createdPermissions.filter(p =>
      p.module === 'inventory' ||
      p.name.includes('warehouse') ||
      p.name.includes('reports.read') ||
      p.name.includes('notification.manage')
    );
    for (const perm of warehouseManagerPerms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: warehouseManager.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: warehouseManager.id,
          permissionId: perm.id,
        },
      });
    }

    // Storekeeper gets inventory read/write permissions
    const storekeeperPerms = createdPermissions.filter(p =>
      p.name.includes('inventory.read') ||
      p.name.includes('inventory.create') ||
      p.name.includes('inventory.update') ||
      p.name.includes('inventory.adjust') ||
      p.name.includes('reports.read')
    );
    for (const perm of storekeeperPerms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: storekeeper.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: storekeeper.id,
          permissionId: perm.id,
        },
      });
    }

    // Procurement Officer gets procurement permissions
    const procurementPerms = createdPermissions.filter(p =>
      p.module === 'procurement' ||
      p.module === 'tender' ||
      p.module === 'supplier' ||
      p.name.includes('reports.read')
    );
    for (const perm of procurementPerms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: procurementOfficer.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: procurementOfficer.id,
          permissionId: perm.id,
        },
      });
    }

    // Finance Officer gets finance-related permissions
    const financePerms = createdPermissions.filter(p =>
      p.module === 'procurement' && p.name.includes('approve') ||
      p.name.includes('reports') ||
      p.name.includes('approval')
    );
    for (const perm of financePerms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: financeOfficer.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: financeOfficer.id,
          permissionId: perm.id,
        },
      });
    }

    // Asset Manager gets asset permissions
    const assetPerms = createdPermissions.filter(p =>
      p.module === 'asset' ||
      p.name.includes('reports.read')
    );
    for (const perm of assetPerms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: assetManager.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: assetManager.id,
          permissionId: perm.id,
        },
      });
    }

    // Auditor gets audit and report permissions
    const auditorPerms = createdPermissions.filter(p =>
      p.module === 'audit' ||
      p.name.includes('reports') ||
      p.name.includes('inventory.audit')
    );
    for (const perm of auditorPerms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: auditor.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: auditor.id,
          permissionId: perm.id,
        },
      });
    }

    // Viewer gets only read permissions
    const viewerPerms = createdPermissions.filter(p => p.action === 'read');
    for (const perm of viewerPerms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: viewer.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: viewer.id,
          permissionId: perm.id,
        },
      });
    }

    console.log('Permissions assigned to roles successfully');

    // Create default organization
    console.log('Creating default organization...');
    const defaultOrg = await prisma.organization.upsert({
      where: { code: 'DEFAULT' },
      update: {},
      create: {
        name: 'Default Organization',
        code: 'DEFAULT',
        type: 'AGENCY',
        description: 'Default organization for existing data',
      },
    });

    console.log('Default organization created');

    // Migrate existing users based on their current role
    console.log('Migrating existing users to new RBAC system...');
    const existingUsers = await prisma.user.findMany();

    for (const user of existingUsers) {
      let targetRole;

      switch (user.role) {
        case 'ADMIN':
          targetRole = orgAdmin;
          break;
        case 'MANAGER':
          targetRole = warehouseManager;
          break;
        case 'CASHIER':
          targetRole = storekeeper;
          break;
        default:
          targetRole = viewer;
      }

      // Assign role to user
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: targetRole.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId: targetRole.id,
          assignedBy: 'SYSTEM_MIGRATION',
        },
      });

      // Assign user to default organization
      await prisma.userOrganization.upsert({
        where: {
          userId_organizationId_organizationUnitId_departmentId_warehouseId: {
            userId: user.id,
            organizationId: defaultOrg.id,
            organizationUnitId: null,
            departmentId: null,
            warehouseId: null,
          },
        },
        update: {},
        create: {
          userId: user.id,
          organizationId: defaultOrg.id,
          isPrimary: true,
          assignedBy: 'SYSTEM_MIGRATION',
        },
      });

      console.log(`Migrated user ${user.email} to role ${targetRole.name}`);
    }

    console.log('User RBAC migration completed successfully');
    console.log('\n=== Migration Summary ===');
    console.log(`Roles created: 11`);
    console.log(`Permissions created: ${createdPermissions.length}`);
    console.log(`Users migrated: ${existingUsers.length}`);
    console.log(`Default organization: ${defaultOrg.name}`);
    console.log('\nMigration completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateUsersToRBAC()
  .catch(console.error);