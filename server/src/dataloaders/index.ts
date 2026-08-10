/**
 * GraphQL DataLoader Configuration - Enterprise Edition
 * 
 * This module sets up DataLoaders to solve the N+1 query problem
 * in GraphQL resolvers by batching and caching database queries.
 * 
 * Key Benefits:
 * - Eliminates N+1 query problem (50%+ reduction in DB calls)
 * - Reduces database round-trips
 * - Improves GraphQL response times
 * - Automatic deduplication of requests
 * - Request-scoped caching
 * - Support for complex relations
 * 
 * @author Principal Software Architect
 * @version 2.0.0 - Enterprise Edition
 */

import DataLoader from 'dataloader';
import { PrismaClient } from '@prisma/client';

/**
 * Category DataLoader
 * 
 * Batches category lookups by ID to prevent N+1 queries
 * when resolving Product.category relations.
 * 
 * Performance: Reduces N category queries to 1 batched query
 */
export function createCategoryLoader(prisma: PrismaClient) {
  return new DataLoader(async (categoryIds: readonly string[]) => {
    // Single query to fetch all categories in one batch
    const categories = await prisma.category.findMany({
      where: {
        id: { in: categoryIds as string[] },
      },
    });

    // Map results back to original order of request IDs
    const categoryMap = new Map(
      categories.map((category) => [category.id, category])
    );

    return categoryIds.map((id) => categoryMap.get(id) || null);
  });
}

/**
 * Supplier DataLoader
 * 
 * Batches supplier lookups by ID to prevent N+1 queries
 * when resolving Product.supplier relations.
 * 
 * Performance: Reduces N supplier queries to 1 batched query
 */
export function createSupplierLoader(prisma: PrismaClient) {
  return new DataLoader(async (supplierIds: readonly string[]) => {
    // Single query to fetch all suppliers in one batch
    const suppliers = await prisma.supplier.findMany({
      where: {
        id: { in: supplierIds as string[] },
      },
    });

    // Map results back to original order of request IDs
    const supplierMap = new Map(
      suppliers.map((supplier) => [supplier.id, supplier])
    );

    return supplierIds.map((id) => supplierMap.get(id) || null);
  });
}

/**
 * Branch DataLoader
 * 
 * Batches branch lookups for branch-based inventory and sales.
 * Supports multi-branch retail operations.
 */
export function createBranchLoader(prisma: PrismaClient) {
  return new DataLoader(async (branchIds: readonly string[]) => {
    const branches = await prisma.branch.findMany({
      where: {
        id: { in: branchIds as string[] },
      },
    });

    const branchMap = new Map(
      branches.map((branch) => [branch.id, branch])
    );
    return branchIds.map((id) => branchMap.get(id) || null);
  });
}

/**
 * User DataLoader
 * 
 * Batches user lookups by ID for audit trail and user relations.
 * Essential for comprehensive audit logging and user context.
 */
export function createUserLoader(prisma: PrismaClient) {
  return new DataLoader(async (userIds: readonly string[]) => {
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds as string[] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
      },
    });

    const userMap = new Map(users.map((user) => [user.id, user]));
    return userIds.map((id) => userMap.get(id) || null);
  });
}

/**
 * Warehouse DataLoader
 * 
 * Batches warehouse lookups for product location relations.
 * Supports multi-warehouse inventory management.
 */
export function createWarehouseLoader(prisma: PrismaClient) {
  return new DataLoader(async (warehouseIds: readonly string[]) => {
    const warehouses = await prisma.warehouse.findMany({
      where: {
        id: { in: warehouseIds as string[] },
      },
    });

    const warehouseMap = new Map(
      warehouses.map((warehouse) => [warehouse.id, warehouse])
    );
    return warehouseIds.map((id) => warehouseMap.get(id) || null);
  });
}

/**
 * Customer DataLoader
 * 
 * Batches customer lookups for sales relations.
 * Critical for customer loyalty and history tracking.
 */
export function createCustomerLoader(prisma: PrismaClient) {
  return new DataLoader(async (customerIds: readonly string[]) => {
    const customers = await prisma.customer.findMany({
      where: {
        id: { in: customerIds as string[] },
      },
    });

    const customerMap = new Map(
      customers.map((customer) => [customer.id, customer])
    );
    return customerIds.map((id) => customerMap.get(id) || null);
  });
}

/**
 * Organization DataLoader
 * 
 * Batches organization lookups for multi-tenant operations.
 * Supports RBAC and organizational hierarchy.
 */
export function createOrganizationLoader(prisma: PrismaClient) {
  return new DataLoader(async (orgIds: readonly string[]) => {
    const organizations = await prisma.organization.findMany({
      where: {
        id: { in: orgIds as string[] },
      },
    });

    const orgMap = new Map(
      organizations.map((org) => [org.id, org])
    );
    return orgIds.map((id) => orgMap.get(id) || null);
  });
}

/**
 * DataLoader Context Interface
 * 
 * Defines the structure for DataLoader instances in Apollo context.
 * All loaders are request-scoped and automatically cleaned up.
 */
export interface DataLoaderContext {
  categoryLoader: DataLoader<string, any>;
  supplierLoader: DataLoader<string, any>;
  branchLoader: DataLoader<string, any>;
  userLoader: DataLoader<string, any>;
  warehouseLoader: DataLoader<string, any>;
  customerLoader: DataLoader<string, any>;
  organizationLoader: DataLoader<string, any>;
}

/**
 * Create all DataLoaders
 * 
 * Factory function to create all DataLoader instances
 * for the current request context.
 * 
 * @param prisma - Prisma client instance
 * @returns DataLoaderContext with all loaders
 */
export function createDataLoaders(prisma: PrismaClient): DataLoaderContext {
  return {
    categoryLoader: createCategoryLoader(prisma),
    supplierLoader: createSupplierLoader(prisma),
    branchLoader: createBranchLoader(prisma),
    userLoader: createUserLoader(prisma),
    warehouseLoader: createWarehouseLoader(prisma),
    customerLoader: createCustomerLoader(prisma),
    organizationLoader: createOrganizationLoader(prisma),
  };
}

/**
 * DataLoader Performance Metrics
 * 
 * Utility function to track DataLoader performance metrics
 * for monitoring and optimization.
 */
export class DataLoaderMetrics {
  private metrics: Map<string, { hits: number; misses: number; batches: number }> = new Map();

  recordHit(loaderName: string) {
    const metric = this.metrics.get(loaderName) || { hits: 0, misses: 0, batches: 0 };
    metric.hits++;
    this.metrics.set(loaderName, metric);
  }

  recordMiss(loaderName: string) {
    const metric = this.metrics.get(loaderName) || { hits: 0, misses: 0, batches: 0 };
    metric.misses++;
    this.metrics.set(loaderName, metric);
  }

  recordBatch(loaderName: string) {
    const metric = this.metrics.get(loaderName) || { hits: 0, misses: 0, batches: 0 };
    metric.batches++;
    this.metrics.set(loaderName, metric);
  }

  getMetrics() {
    return Object.fromEntries(this.metrics);
  }

  getHitRate(loaderName: string): number {
    const metric = this.metrics.get(loaderName);
    if (!metric || (metric.hits + metric.misses) === 0) return 0;
    return metric.hits / (metric.hits + metric.misses);
  }

  reset() {
    this.metrics.clear();
  }
}
