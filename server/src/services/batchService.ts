/**
 * FEFO Batch Allocation Service
 * 
 * This service implements First-Expired, First-Out (FEFO) stock allocation
 * for perishable goods, ensuring optimal inventory rotation and waste reduction.
 * 
 * Key Features:
 * - FEFO batch selection algorithm
 * - Expiry date tracking
 * - Dynamic markdown suggestions
 * - Batch-level inventory management
 * - Transaction-based batch deduction
 * - Waste reduction optimization
 * - Compliance with food safety regulations
 * 
 * @author Principal Software Architect
 * @version 2.0.0 - Enterprise Edition
 */

import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';

/**
 * Batch Allocation Result
 */
export interface BatchAllocationResult {
  success: boolean;
  batchId: string;
  batchNumber: string;
  expiryDate: Date;
  quantity: number;
  landedCost: number;
  remainingQuantity: number;
  warning?: string;
  error?: string;
}

/**
 * Expiring Product Alert
 */
export interface ExpiringProductAlert {
  productId: string;
  productName: string;
  batchId: string;
  batchNumber: string;
  expiryDate: Date;
  daysToExpiry: number;
  quantity: number;
  recommendedDiscount: number;
  currentPrice: number;
  discountPrice: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * FEFO Service Configuration
 */
export interface FEFOConfig {
  warningDays: number;           // Days before expiry to show warning
  criticalDays: number;          // Days before expiry to show critical alert
  discountTiers: {
    [days: number]: number;     // Days before expiry -> discount percentage
  };
}

/**
 * FEFO Batch Allocation Service
 */
export class FEFOMService {
  private prisma: PrismaClient;
  private config: FEFOConfig;

  constructor(prisma: PrismaClient, config?: Partial<FEFOConfig>) {
    this.prisma = prisma;
    this.config = {
      warningDays: 30,
      criticalDays: 7,
      discountTiers: {
        30: 10,   // 10% discount if expires in 30 days
        14: 20,   // 20% discount if expires in 14 days
        7: 40,    // 40% discount if expires in 7 days
        3: 60,    // 60% discount if expires in 3 days
        1: 80,    // 80% discount if expires in 1 day
      },
      ...config,
    };
  }

  /**
   * Allocate stock using FEFO (First-Expired, First-Out) algorithm
   * 
   * Selects the batch with the earliest expiry date that has sufficient stock.
   * 
   * @param productId - Product ID
   * @param quantity - Quantity to allocate
   * @param branchId - Branch ID (optional)
   * @returns Batch allocation result
   */
  async allocateStockFEFO(
    productId: string,
    quantity: number,
    branchId?: string
  ): Promise<BatchAllocationResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Get product info
        const product = await tx.product.findUnique({
          where: { id: productId },
          select: { id: true, name: true, status: true },
        });

        if (!product) {
          throw new Error(`Product with ID ${productId} not found`);
        }

        if (product.status !== 'ACTIVE') {
          throw new Error(`Product ${product.name} is not active`);
        }

        // Get available batches, sorted by expiry date (FEFO)
        const whereCondition: any = {
          productId,
          status: 'ACTIVE',
          quantity: { gte: quantity },
        };

        if (branchId) {
          whereCondition.branchId = branchId;
        }

        const batches = await tx.productBatch.findMany({
          where: whereCondition,
          orderBy: { expiryDate: 'asc' }, // Earliest expiry first
        });

        if (batches.length === 0) {
          throw new Error('No available batches with sufficient quantity');
        }

        // Select the earliest expiring batch (FEFO)
        const selectedBatch = batches[0];

        // Check if batch is expired
        if (selectedBatch.expiryDate < new Date()) {
          throw new Error(`Cannot allocate from expired batch ${selectedBatch.batchNumber}`);
        }

        // Deduct from selected batch
        const updatedBatch = await tx.productBatch.update({
          where: { id: selectedBatch.id },
          data: {
            quantity: {
              decrement: quantity,
            },
            updatedAt: new Date(),
          },
        });

        // Mark batch as expired if quantity reaches zero
        if (updatedBatch.quantity === 0) {
          await tx.productBatch.update({
            where: { id: selectedBatch.id },
            data: { status: 'EXPIRED' },
          });
        }

        // Check for expiry warning
        const daysToExpiry = Math.floor(
          (selectedBatch.expiryDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        );

        let warning: string | undefined;
        if (daysToExpiry <= this.config.criticalDays) {
          warning = `CRITICAL: Batch expires in ${daysToExpiry} days`;
        } else if (daysToExpiry <= this.config.warningDays) {
          warning = `WARNING: Batch expires in ${daysToExpiry} days`;
        }

        return {
          success: true,
          batchId: selectedBatch.id,
          batchNumber: selectedBatch.batchNumber,
          expiryDate: selectedBatch.expiryDate,
          quantity,
          landedCost: selectedBatch.landedCost,
          remainingQuantity: updatedBatch.quantity,
          warning,
        };
      });
    } catch (error) {
      console.error('FEFO allocation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'FEFO allocation failed',
      };
    }
  }

  /**
   * Batch stock out for specific batch
   */
  async batchStockOut(
    batchId: string,
    quantity: number,
    userId: string,
    notes?: string
  ): Promise<BatchAllocationResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const batch = await tx.productBatch.findUnique({
          where: { id: batchId },
          include: { product: true },
        });

        if (!batch) {
          throw new Error(`Batch with ID ${batchId} not found`);
        }

        if (batch.status !== 'ACTIVE') {
          throw new Error(`Batch ${batch.batchNumber} is not active`);
        }

        if (batch.quantity < quantity) {
          throw new Error(`Insufficient quantity in batch. Available: ${batch.quantity}, Requested: ${quantity}`);
        }

        // Check expiry
        if (batch.expiryDate < new Date()) {
          throw new Error(`Cannot deduct from expired batch ${batch.batchNumber}`);
        }

        // Deduct from batch
        const updatedBatch = await tx.productBatch.update({
          where: { id: batchId },
          data: {
            quantity: {
              decrement: quantity,
            },
            updatedAt: new Date(),
          },
        });

        // Mark as expired if empty
        if (updatedBatch.quantity === 0) {
          await tx.productBatch.update({
            where: { id: batchId },
            data: { status: 'EXPIRED' },
          });
        }

        // Create transaction record
        const transaction = await tx.transaction.create({
          data: {
            productId: batch.productId,
            quantity,
            type: 'OUT',
            notes: notes || `FEFO allocation from batch ${batch.batchNumber}`,
            userId,
            unitPrice: batch.landedCost,
            subtotal: batch.landedCost * quantity,
            vatAmount: (batch.landedCost * quantity) * 0.15,
            totalAmount: (batch.landedCost * quantity) * 1.15,
            clearanceStatus: 'CLEARED',
          },
        });

        // Update main product stock
        await tx.product.update({
          where: { id: batch.productId },
          data: {
            stock: {
              decrement: quantity,
            },
            updatedAt: new Date(),
          },
        });

        // Audit log
        await tx.activityLog.create({
          data: {
            userId,
            action: 'BATCH_STOCK_OUT',
            entityType: 'PRODUCT_BATCH',
            entityId: batchId,
            details: `FEFO stock out: ${quantity} units from batch ${batch.batchNumber}`,
            oldValue: JSON.stringify({ quantity: batch.quantity }),
            newValue: JSON.stringify({ quantity: updatedBatch.quantity }),
            changes: JSON.stringify({
              batchNumber: batch.batchNumber,
              expiryDate: batch.expiryDate,
            }),
          },
        });

        return {
          success: true,
          batchId,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate,
          quantity,
          landedCost: batch.landedCost,
          remainingQuantity: updatedBatch.quantity,
        };
      });
    } catch (error) {
      console.error('Batch stock out failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Batch stock out failed',
      };
    }
  }

  /**
   * Get products expiring soon with discount recommendations
   */
  async getExpiringProducts(thresholdDays: number = 30): Promise<ExpiringProductAlert[]> {
    const thresholdDate = new Date(Date.now() + thresholdDays * 24 * 60 * 60 * 1000);

    const expiringBatches = await this.prisma.productBatch.findMany({
      where: {
        status: 'ACTIVE',
        expiryDate: { lte: thresholdDate },
        quantity: { gt: 0 },
      },
      include: {
        product: {
          select: { id: true, name: true, sellingPrice: true },
        },
      },
      orderBy: { expiryDate: 'asc' },
    });

    const alerts: ExpiringProductAlert[] = [];

    for (const batch of expiringBatches) {
      const daysToExpiry = Math.floor(
        (batch.expiryDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );

      if (daysToExpiry < 0) continue; // Skip already expired

      const recommendedDiscount = this.calculateRecommendedDiscount(daysToExpiry);
      const currentPrice = batch.product.sellingPrice;
      const discountPrice = currentPrice * (1 - recommendedDiscount / 100);

      let urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
      if (daysToExpiry <= 3) urgency = 'CRITICAL';
      else if (daysToExpiry <= 7) urgency = 'HIGH';
      else if (daysToExpiry <= 14) urgency = 'MEDIUM';

      alerts.push({
        productId: batch.productId,
        productName: batch.product.name,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        daysToExpiry,
        quantity: batch.quantity,
        recommendedDiscount,
        currentPrice,
        discountPrice,
        urgency,
      });
    }

    return alerts.sort((a, b) => a.daysToExpiry - b.daysToExpiry);
  }

  /**
   * Calculate recommended discount based on days to expiry
   */
  private calculateRecommendedDiscount(daysToExpiry: number): number {
    for (const [days, discount] of Object.entries(this.config.discountTiers)) {
      if (daysToExpiry <= parseInt(days)) {
        return discount;
      }
    }
    return 0;
  }

  /**
   * Create new product batch
   */
  async createProductBatch(
    productId: string,
    batchNumber: string,
    expiryDate: Date,
    quantity: number,
    landedCost: number,
    supplierId?: string,
    branchId?: string
  ): Promise<void> {
    await this.prisma.productBatch.create({
      data: {
        productId,
        batchNumber,
        expiryDate,
        quantity,
        landedCost,
        supplierId,
        branchId,
      },
    });

    // Update main product stock
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        stock: {
          increment: quantity,
        },
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Automated expiry check and alerts
   */
  async automatedExpiryCheck(): Promise<void> {
    console.log('Running automated expiry check...');

    const expiringProducts = await this.getExpiringProducts(this.config.warningDays);

    if (expiringProducts.length === 0) {
      console.log('No products expiring soon.');
      return;
    }

    console.log(`Found ${expiringProducts.length} products expiring soon.`);

    // Create risk indicators for critical items
    const criticalItems = expiringProducts.filter(p => p.urgency === 'CRITICAL');
    
    for (const item of criticalItems) {
      await this.prisma.riskIndicator.create({
        data: {
          entityType: 'PRODUCT',
          entityId: item.productId,
          riskType: 'EXPIRY_RISK',
          severity: 'HIGH',
          description: `Product ${item.productName} expires in ${item.daysToExpiry} days`,
          confidence: 0.95,
          metadata: JSON.stringify({
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
            quantity: item.quantity,
            recommendedDiscount: item.recommendedDiscount,
          }),
        },
      });
    }

    console.log(`Created ${criticalItems.length} expiry risk alerts.`);
  }

  /**
   * Start automated expiry monitoring
   */
  startAutomatedMonitoring(intervalMs: number = 6 * 60 * 60 * 1000): void {
    console.log(`Starting automated expiry monitoring (interval: ${intervalMs}ms)`);

    // Run immediately
    this.automatedExpiryCheck();

    // Schedule regular checks
    setInterval(() => {
      this.automatedExpiryCheck();
    }, intervalMs);
  }
}

/**
 * Create FEFO service instance
 */
export function createFEFOMService(
  prisma: PrismaClient,
  config?: Partial<FEFOConfig>
): FEFOMService {
  return new FEFOMService(prisma, config);
}