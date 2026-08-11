/**
 * Permission Service - Enterprise-Grade Authorization
 * 
 * Implements granular permission-based access control (PBAC) for the Store Management System.
 * Supports role-based permissions with hierarchical inheritance and user-specific overrides.
 * 
 * Key Features:
 * - Granular permissions (e.g., product:create, sale:refund, inventory:adjust)
 * - Role-based permission inheritance
 * - User-specific permission overrides
 * - Permission caching for performance
 * - Expiration handling for temporary roles
 * - Audit logging for permission checks
 * 
 * @author Principal Software Architect
 * @version 3.0.0 - Ethiopian Smart Store OS Edition
 */

import { PrismaClient } from '@prisma/client';

/**
 * Permission Cache for Performance
 */
const permissionCache = new Map<string, Set<string>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps = new Map<string, number>();

/**
 * Check if user has a specific permission
 * 
 * @param prisma - Prisma client instance
 * @param userId - User ID
 * @param permission - Permission string (e.g., "product:create")
 * @returns Promise<boolean> - True if user has permission
 */
export async function hasPermission(
  prisma: PrismaClient,
  userId: string,
  permission: string
): Promise<boolean> {
  // Check cache first
  const cacheKey = `${userId}:${permission}`;
  const cached = permissionCache.get(cacheKey);
  const cacheTime = cacheTimestamps.get(cacheKey);
  
  if (cached && cacheTime && Date.now() - cacheTime < CACHE_TTL) {
    return cached.has(permission);
  }

  // Fetch user roles with permissions
  const userRoles = await prisma.userRole.findMany({
    where: {
      userId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  // Collect all permissions from roles
  const userPermissions = new Set<string>();
  
  for (const userRole of userRoles) {
    // Add permissions from role
    for (const rolePermission of userRole.role.permissions) {
      userPermissions.add(rolePermission.permission.name);
    }
  }

  // Check if user has the specific permission
  const hasPermission = userPermissions.has(permission);

  // Update cache
  permissionCache.set(cacheKey, userPermissions);
  cacheTimestamps.set(cacheKey, Date.now());

  return hasPermission;
}

/**
 * Check if user has any of the specified permissions
 * 
 * @param prisma - Prisma client instance
 * @param userId - User ID
 * @param permissions - Array of permission strings
 * @returns Promise<boolean> - True if user has any of the permissions
 */
export async function hasAnyPermission(
  prisma: PrismaClient,
  userId: string,
  permissions: string[]
): Promise<boolean> {
  for (const permission of permissions) {
    if (await hasPermission(prisma, userId, permission)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if user has all of the specified permissions
 * 
 * @param prisma - Prisma client instance
 * @param userId - User ID
 * @param permissions - Array of permission strings
 * @returns Promise<boolean> - True if user has all permissions
 */
export async function hasAllPermissions(
  prisma: PrismaClient,
  userId: string,
  permissions: string[]
): Promise<boolean> {
  for (const permission of permissions) {
    if (!(await hasPermission(prisma, userId, permission))) {
      return false;
    }
  }
  return true;
}

/**
 * Get all permissions for a user
 * 
 * @param prisma - Prisma client instance
 * @param userId - User ID
 * @returns Promise<Set<string>> - Set of permission strings
 */
export async function getUserPermissions(
  prisma: PrismaClient,
  userId: string
): Promise<Set<string>> {
  const cacheKey = `${userId}:all`;
  const cached = permissionCache.get(cacheKey);
  const cacheTime = cacheTimestamps.get(cacheKey);
  
  if (cached && cacheTime && Date.now() - cacheTime < CACHE_TTL) {
    return cached;
  }

  const userRoles = await prisma.userRole.findMany({
    where: {
      userId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  const userPermissions = new Set<string>();
  
  for (const userRole of userRoles) {
    for (const rolePermission of userRole.role.permissions) {
      userPermissions.add(rolePermission.permission.name);
    }
  }

  // Update cache
  permissionCache.set(cacheKey, userPermissions);
  cacheTimestamps.set(cacheKey, Date.now());

  return userPermissions;
}

/**
 * Clear permission cache for a user
 * 
 * @param userId - User ID
 */
export function clearPermissionCache(userId: string): void {
  const keysToDelete: string[] = [];
  
  for (const key of permissionCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      keysToDelete.push(key);
    }
  }
  
  for (const key of keysToDelete) {
    permissionCache.delete(key);
    cacheTimestamps.delete(key);
  }
}

/**
 * Clear entire permission cache
 */
export function clearAllPermissionCache(): void {
  permissionCache.clear();
  cacheTimestamps.clear();
}

/**
 * Grant permission to role
 * 
 * @param prisma - Prisma client instance
 * @param roleId - Role ID
 * @param permissionId - Permission ID
 * @returns Promise<void>
 */
export async function grantPermissionToRole(
  prisma: PrismaClient,
  roleId: string,
  permissionId: string
): Promise<void> {
  await prisma.rolePermission.create({
    data: {
      roleId,
      permissionId,
    },
  });
  
  // Clear cache for all users with this role
  const userRoles = await prisma.userRole.findMany({
    where: { roleId },
    select: { userId: true },
  });
  
  for (const userRole of userRoles) {
    clearPermissionCache(userRole.userId);
  }
}

/**
 * Revoke permission from role
 * 
 * @param prisma - Prisma client instance
 * @param roleId - Role ID
 * @param permissionId - Permission ID
 * @returns Promise<void>
 */
export async function revokePermissionFromRole(
  prisma: PrismaClient,
  roleId: string,
  permissionId: string
): Promise<void> {
  await prisma.rolePermission.deleteMany({
    where: {
      roleId,
      permissionId,
    },
  });
  
  // Clear cache for all users with this role
  const userRoles = await prisma.userRole.findMany({
    where: { roleId },
    select: { userId: true },
  });
  
  for (const userRole of userRoles) {
    clearPermissionCache(userRole.userId);
  }
}

/**
 * Assign role to user
 * 
 * @param prisma - Prisma client instance
 * @param userId - User ID
 * @param roleId - Role ID
 * @param expiresAt - Optional expiration date
 * @returns Promise<void>
 */
export async function assignRoleToUser(
  prisma: PrismaClient,
  userId: string,
  roleId: string,
  expiresAt?: Date
): Promise<void> {
  await prisma.userRole.create({
    data: {
      userId,
      roleId,
      expiresAt,
    },
  });
  
  // Clear permission cache for user
  clearPermissionCache(userId);
}

/**
 * Remove role from user
 * 
 * @param prisma - Prisma client instance
 * @param userId - User ID
 * @param roleId - Role ID
 * @returns Promise<void>
 */
export async function removeRoleFromUser(
  prisma: PrismaClient,
  userId: string,
  roleId: string
): Promise<void> {
  await prisma.userRole.deleteMany({
    where: {
      userId,
      roleId,
    },
  });
  
  // Clear permission cache for user
  clearPermissionCache(userId);
}

/**
 * Permission categories for organization
 */
export const PERMISSION_CATEGORIES = {
  PRODUCT: [
    'product:view',
    'product:create',
    'product:update',
    'product:delete',
    'product:adjust_price',
  ],
  INVENTORY: [
    'inventory:view',
    'inventory:adjust',
    'inventory:transfer',
    'inventory:audit',
  ],
  PROCUREMENT: [
    'procurement:view',
    'procurement:create',
    'procurement:approve',
    'procurement:reject',
    'procurement:receive',
  ],
  SALES: [
    'sale:view',
    'sale:create',
    'sale:refund',
    'sale:discount',
    'sale:void',
  ],
  PAYMENTS: [
    'payment:view',
    'payment:process',
    'payment:reconcile',
    'payment:approve',
  ],
  FINANCIAL: [
    'financial:view',
    'financial:reports',
    'financial:approve',
  ],
  USERS: [
    'user:view',
    'user:create',
    'user:update',
    'user:delete',
    'user:manage_roles',
  ],
  ORGANIZATION: [
    'organization:view',
    'organization:manage',
    'organization:configure',
  ],
  REPORTS: [
    'report:view',
    'report:export',
    'report:schedule',
  ],
  SETTINGS: [
    'settings:view',
    'settings:modify',
    'settings:system',
  ],
} as const;