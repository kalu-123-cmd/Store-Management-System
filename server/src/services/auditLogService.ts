/**
 * Audit Logging Service - Immutable Audit Trail
 * 
 * This service provides comprehensive audit logging capabilities
 * for tracking all system changes with full context and metadata.
 * 
 * Key Features:
 * - Immutable audit records (cannot be modified)
 * - Comprehensive change tracking (before/after values)
 * - Request context tracking (IP, user agent, session)
 * - Entity-level change tracking
 * - Distributed tracing support
 * 
 * @author Senior Full-Stack Engineer
 * @version 1.0.0
 */

import { PrismaClient } from '@prisma/client';

/**
 * Audit Log Entry Interface
 */
export interface AuditLogEntry {
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: string;
  oldValue?: any;
  newValue?: any;
  changes?: any;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
}

/**
 * Audit Log Service
 * 
 * Provides methods for creating and querying audit log entries
 * with full context tracking and immutable record keeping.
 */
export class AuditLogService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create an audit log entry
   * 
   * @param entry - Audit log entry data
   * @returns Promise with created audit log
   */
  async createLog(entry: AuditLogEntry) {
    try {
      return await this.prisma.activityLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          details: entry.details,
          oldValue: entry.oldValue ? JSON.stringify(entry.oldValue) : null,
          newValue: entry.newValue ? JSON.stringify(entry.newValue) : null,
          changes: entry.changes ? JSON.stringify(entry.changes) : null,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          sessionId: entry.sessionId,
          requestId: entry.requestId,
        },
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
      // Don't throw - audit logging shouldn't break the main flow
      return null;
    }
  }

  /**
   * Create audit log for entity creation
   * 
   * @param userId - User who created the entity
   * @param entityType - Type of entity created
   * @param entityId - ID of created entity
   * @param newValue - New entity data
   * @param context - Request context
   */
  async logCreation(
    userId: string,
    entityType: string,
    entityId: string,
    newValue: any,
    context?: Partial<AuditLogEntry>
  ) {
    return this.createLog({
      userId,
      action: 'CREATE',
      entityType,
      entityId,
      newValue,
      details: `Created ${entityType.toLowerCase()}`,
      ...context,
    });
  }

  /**
   * Create audit log for entity update
   * 
   * @param userId - User who updated the entity
   * @param entityType - Type of entity updated
   * @param entityId - ID of updated entity
   * @param oldValue - Previous entity data
   * @param newValue - New entity data
   * @param changes - Specific fields that changed
   * @param context - Request context
   */
  async logUpdate(
    userId: string,
    entityType: string,
    entityId: string,
    oldValue: any,
    newValue: any,
    changes: any,
    context?: Partial<AuditLogEntry>
  ) {
    return this.createLog({
      userId,
      action: 'UPDATE',
      entityType,
      entityId,
      oldValue,
      newValue,
      changes,
      details: `Updated ${entityType.toLowerCase()}`,
      ...context,
    });
  }

  /**
   * Create audit log for entity deletion
   * 
   * @param userId - User who deleted the entity
   * @param entityType - Type of entity deleted
   * @param entityId - ID of deleted entity
   * @param oldValue - Entity data before deletion
   * @param context - Request context
   */
  async logDeletion(
    userId: string,
    entityType: string,
    entityId: string,
    oldValue: any,
    context?: Partial<AuditLogEntry>
  ) {
    return this.createLog({
      userId,
      action: 'DELETE',
      entityType,
      entityId,
      oldValue,
      details: `Deleted ${entityType.toLowerCase()}`,
      ...context,
    });
  }

  /**
   * Create audit log for stock operations
   * 
   * @param userId - User who performed the operation
   * @param productId - Product ID
   * @param action - Action type (STOCK_IN, STOCK_OUT, STOCK_ADJUSTMENT)
   * @param quantity - Quantity changed
   * @param oldValue - Previous stock level
   * @param newValue - New stock level
   * @param context - Request context
   */
  async logStockOperation(
    userId: string,
    productId: string,
    action: 'STOCK_IN' | 'STOCK_OUT' | 'STOCK_ADJUSTMENT',
    quantity: number,
    oldValue: number,
    newValue: number,
    context?: Partial<AuditLogEntry>
  ) {
    return this.createLog({
      userId,
      action,
      entityType: 'PRODUCT',
      entityId: productId,
      oldValue: { stock: oldValue },
      newValue: { stock: newValue },
      changes: { quantity, type: action },
      details: `${action.replace('_', ' ')}: ${quantity} units`,
      ...context,
    });
  }

  /**
   * Create audit log for price changes
   * 
   * @param userId - User who changed the price
   * @param productId - Product ID
   * @param oldPrice - Previous price
   * @param newPrice - New price
   * @param priceType - Type of price (costPrice, sellingPrice)
   * @param context - Request context
   */
  async logPriceChange(
    userId: string,
    productId: string,
    oldPrice: number,
    newPrice: number,
    priceType: 'costPrice' | 'sellingPrice',
    context?: Partial<AuditLogEntry>
  ) {
    return this.createLog({
      userId,
      action: 'PRICE_CHANGE',
      entityType: 'PRODUCT',
      entityId: productId,
      oldValue: { [priceType]: oldPrice },
      newValue: { [priceType]: newPrice },
      changes: { [priceType]: { from: oldPrice, to: newPrice } },
      details: `${priceType} changed from ${oldPrice} to ${newPrice}`,
      ...context,
    });
  }

  /**
   * Query audit logs with filters
   * 
   * @param filters - Query filters
   * @returns Promise with audit logs
   */
  async queryLogs(filters: {
    userId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    return this.prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 100,
      skip: filters.offset || 0,
    });
  }

  /**
   * Get audit logs for a specific entity
   * 
   * @param entityType - Type of entity
   * @param entityId - ID of entity
   * @returns Promise with entity audit history
   */
  async getEntityHistory(entityType: string, entityId: string) {
    return this.queryLogs({
      entityType,
      entityId,
    });
  }

  /**
   * Get user activity logs
   * 
   * @param userId - User ID
   * @param limit - Number of logs to return
   * @returns Promise with user activity
   */
  async getUserActivity(userId: string, limit: number = 50) {
    return this.queryLogs({
      userId,
      limit,
    });
  }
}

/**
 * Create audit log service instance
 * 
 * Factory function to create audit log service
 * 
 * @param prisma - Prisma client instance
 * @returns AuditLogService instance
 */
export function createAuditLogService(prisma: PrismaClient): AuditLogService {
  return new AuditLogService(prisma);
}
