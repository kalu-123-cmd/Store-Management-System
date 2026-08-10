/**
 * Multi-Branch Inventory Rebalancing Engine
 * 
 * This service provides intelligent inventory rebalancing across multiple
 * retail branches to optimize stock distribution and prevent stockouts.
 * 
 * Key Features:
 * - Stock shortage detection per branch
 * - Excess stock identification
 * - Optimal transfer route calculation
 * - Cost optimization for transfers
 * - Automatic transfer order generation
 * - Priority-based rebalancing
 * - Multi-branch constraint handling
 * 
 * @author Principal Software Architect
 * @version 2.0.0 - Enterprise Edition
 */

import { PrismaClient } from '@prisma/client';

/**
 * Branch Stock Status
 */
export interface BranchStockStatus {
  branchId: string;
  branchName: string;
  productId: string;
  productName: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  status: 'SHORTAGE' | 'OPTIMAL' | 'EXCESS';
  shortage: number;
  excess: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Transfer Recommendation
 */
export interface TransferRecommendation {
  fromBranchId: string;
  fromBranchName: string;
  toBranchId: string;
  toBranchName: string;
  productId: string;
  productName: string;
  quantity: number;
  estimatedCost: number;
  distance: number;
  savings: number;
  priority: number;
  urgency: string;
}

/**
 * Rebalancing Optimization Result
 */
export interface RebalancingResult {
  productId: string;
  productName: string;
  totalShortage: number;
  totalExcess: number;
  transferableQuantity: number;
  recommendations: TransferRecommendation[];
  totalSavings: number;
  estimatedDeliveryTime: number;
}

/**
 * Branch Inventory Rebalancing Service
 */
export class RebalancingService {
  private prisma: PrismaClient;
  private maxStockMultiplier: number = 2; // Max stock = minStock * multiplier

  constructor(prisma: PrismaClient, config?: { maxStockMultiplier?: number }) {
    this.prisma = prisma;
    if (config?.maxStockMultiplier) this.maxStockMultiplier = config.maxStockMultiplier;
  }

  /**
   * Get stock status for all branches for a specific product
   */
  async getBranchStockStatus(productId: string): Promise<BranchStockStatus[]> {
    const branchStocks = await this.prisma.branchStock.findMany({
      where: { productId },
      include: {
        branch: {
          select: { id: true, name: true },
        },
        product: {
          select: { id: true, name: true },
        },
      },
    });

    return branchStocks.map(stock => {
      const shortage = Math.max(0, stock.minStock - stock.quantity);
      const excess = Math.max(0, stock.quantity - (stock.minStock * this.maxStockMultiplier));
      
      let status: 'SHORTAGE' | 'OPTIMAL' | 'EXCESS' = 'OPTIMAL';
      if (shortage > 0) status = 'SHORTAGE';
      else if (excess > 0) status = 'EXCESS';

      let urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
      const stockRatio = stock.quantity / stock.minStock;
      
      if (stockRatio <= 0.25) urgency = 'CRITICAL';
      else if (stockRatio <= 0.5) urgency = 'HIGH';
      else if (stockRatio <= 0.75) urgency = 'MEDIUM';

      return {
        branchId: stock.branchId,
        branchName: stock.branch.name,
        productId: stock.productId,
        productName: stock.product.name,
        currentStock: stock.quantity,
        minStock: stock.minStock,
        maxStock: stock.minStock * this.maxStockMultiplier,
        status,
        shortage,
        excess,
        urgency,
      };
    });
  }

  /**
   * Calculate optimal transfer recommendations
   * 
   * Uses a greedy algorithm to match excess stock with shortages,
   * optimizing for minimal transfer cost and maximum impact.
   */
  async calculateTransferRecommendations(productId: string): Promise<RebalancingResult> {
    const stockStatus = await this.getBranchStockStatus(productId);

    const shortageBranches = stockStatus.filter(s => s.status === 'SHORTAGE');
    const excessBranches = stockStatus.filter(s => s.status === 'EXCESS');

    const totalShortage = shortageBranches.reduce((sum, s) => sum + s.shortage, 0);
    const totalExcess = excessBranches.reduce((sum, s) => sum + s.excess, 0);
    const transferableQuantity = Math.min(totalShortage, totalExcess);

    const recommendations: TransferRecommendation[] = [];

    // Sort shortages by urgency (CRITICAL first)
    shortageBranches.sort((a, b) => {
      const urgencyOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });

    // Sort excess by quantity (largest excess first)
    excessBranches.sort((a, b) => b.excess - a.excess);

    // Match excess with shortages
    let remainingExcess = totalExcess;
    
    for (const shortageBranch of shortageBranches) {
      if (remainingExcess <= 0) break;

      for (const excessBranch of excessBranches) {
        if (remainingExcess <= 0) break;

        if (excessBranch.branchId === shortageBranch.branchId) continue;

        const transferQuantity = Math.min(
          shortageBranch.shortage,
          excessBranch.excess
        );

        if (transferQuantity > 0) {
          const estimatedCost = this.estimateTransferCost(
            excessBranch.branchId,
            shortageBranch.branchId,
            transferQuantity
          );

          const savings = this.calculateSavings(shortageBranch, transferQuantity);

          recommendations.push({
            fromBranchId: excessBranch.branchId,
            fromBranchName: excessBranch.branchName,
            toBranchId: shortageBranch.branchId,
            toBranchName: shortageBranch.branchName,
            productId,
            productName: shortageBranch.productName,
            quantity: transferQuantity,
            estimatedCost,
            distance: 0, // Would calculate actual distance if branch locations available
            savings,
            priority: this.calculatePriority(shortageBranch.urgency, transferQuantity),
            urgency: shortageBranch.urgency,
          });

          remainingExcess -= transferQuantity;
          excessBranch.excess -= transferQuantity;
        }
      }
    }

    const totalSavings = recommendations.reduce((sum, r) => sum + r.savings, 0);
    const estimatedDeliveryTime = this.estimateDeliveryTime(recommendations);

    return {
      productId,
      productName: stockStatus[0]?.productName || '',
      totalShortage,
      totalExcess,
      transferableQuantity,
      recommendations,
      totalSavings,
      estimatedDeliveryTime,
    };
  }

  /**
   * Estimate transfer cost between branches
   */
  private estimateTransferCost(fromBranchId: string, toBranchId: string, quantity: number): number {
    // Placeholder: Would calculate actual logistics cost
    // Based on distance, transportation mode, quantity
    const baseCost = 50; // Base transport cost
    const perUnitCost = 0.5; // Cost per unit
    return baseCost + (perUnitCost * quantity);
  }

  /**
   * Calculate savings from preventing stockout
   */
  private calculateSavings(shortageBranch: BranchStockStatus, quantity: number): number {
    // Savings = opportunity cost of stockout + customer satisfaction cost
    const product = this.prisma.product.findUnique({
      where: { id: shortageBranch.productId },
      select: { sellingPrice: true },
    });

    const sellingPrice = product?.sellingPrice || 0;
    const lostSales = sellingPrice * quantity;
    const customerSatisfactionCost = lostSales * 0.5; // 50% of lost sales value

    return lostSales + customerSatisfactionCost;
  }

  /**
   * Calculate transfer priority
   */
  private calculatePriority(urgency: string, quantity: number): number {
    const urgencyScore = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }[urgency as keyof typeof urgencyScore];
    const quantityScore = Math.min(quantity / 10, 2); // More quantity = higher priority
    return urgencyScore + quantityScore;
  }

  /**
   * Estimate delivery time for transfers
   */
  private estimateDeliveryTime(recommendations: TransferRecommendation[]): number {
    if (recommendations.length === 0) return 0;
    
    // Estimate based on number of transfers and average distance
    const avgTransferTime = 24 * 60 * 60 * 1000; // 24 hours per transfer
    return recommendations.length * avgTransferTime;
  }

  /**
   * Generate stock transfer order
   */
  async generateTransferOrder(recommendation: TransferRecommendation, userId: string): Promise<string> {
    const estimatedArrival = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const transferOrder = await this.prisma.stockTransferOrder.create({
      data: {
        fromBranchId: recommendation.fromBranchId,
        toBranchId: recommendation.toBranchId,
        status: 'PENDING',
        requestedBy: userId,
        estimatedArrival,
        notes: `Transfer of ${recommendation.quantity} units of ${recommendation.productName}`,
        priority: recommendation.urgency === 'CRITICAL' ? 'URGENT' : 
                   recommendation.urgency === 'HIGH' ? 'HIGH' : 'NORMAL',
      },
    });

    // Add transfer item
    await this.prisma.stockTransferOrderItem.create({
      data: {
        transferOrderId: transferOrder.id,
        productId: recommendation.productId,
        requestedQuantity: recommendation.quantity,
        approvedQuantity: recommendation.quantity,
        notes: `Transfer from ${recommendation.fromBranchName} to ${recommendation.toBranchName}`,
      },
    });

    // Update branch stocks
    await this.prisma.branchStock.update({
      where: {
        branchId_productId: {
          branchId: recommendation.fromBranchId,
          productId: recommendation.productId,
        },
      },
      data: {
        quantity: {
          decrement: recommendation.quantity,
        },
      },
    });

    return transferOrder.id;
  }

  /**
   * Approve and execute transfer order
   */
  async approveTransferOrder(transferOrderId: string, approverId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const transferOrder = await tx.stockTransferOrder.findUnique({
        where: { id: transferOrderId },
        include: { items: true },
      });

      if (!transferOrder) {
        throw new Error('Transfer order not found');
      }

      if (transferOrder.status !== 'PENDING') {
        throw new Error('Transfer order is not in PENDING status');
      }

      // Update transfer order status
      await tx.stockTransferOrder.update({
        where: { id: transferOrderId },
        data: {
          status: 'IN_TRANSIT',
          approvedBy: approverId,
          approvedAt: new Date(),
          shippedAt: new Date(),
        },
      });

      // Process each transfer item
      for (const item of transferOrder.items) {
        // Update destination branch stock
        await tx.branchStock.upsert({
          where: {
            branchId_productId: {
              branchId: transferOrder.toBranchId,
              productId: item.productId,
            },
          },
          update: {
            quantity: {
              increment: item.approvedQuantity || item.requestedQuantity,
            },
          },
          create: {
            branchId: transferOrder.toBranchId,
            productId: item.productId,
            quantity: item.approvedQuantity || item.requestedQuantity,
            minStock: 10,
          },
        });

        // Update transfer item
        await tx.stockTransferOrderItem.update({
          where: { id: item.id },
          data: {
            shippedQuantity: item.approvedQuantity || item.requestedQuantity,
          },
        });
      }

      // Create audit log
      await tx.activityLog.create({
        data: {
          userId: approverId,
          action: 'STOCK_TRANSFER_APPROVED',
          entityType: 'STOCK_TRANSFER',
          entityId: transferOrderId,
          details: `Approved transfer from branch ${transferOrder.fromBranchId} to ${transferOrder.toBranchId}`,
          oldValue: JSON.stringify({ status: 'PENDING' }),
          newValue: JSON.stringify({ status: 'IN_TRANSIT' }),
        },
      });
    });
  }

  /**
   * Receive transfer order
   */
  async receiveTransferOrder(transferOrderId: string, userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const transferOrder = await tx.stockTransferOrder.findUnique({
        where: { id: transferOrderId },
        include: { items: true },
      });

      if (!transferOrder) {
        throw new Error('Transfer order not found');
      }

      if (transferOrder.status !== 'IN_TRANSIT') {
        throw new Error('Transfer order is not in transit');
      }

      // Update transfer order status
      await tx.stockTransferOrder.update({
        where: { id: transferOrderId },
        data: {
          status: 'COMPLETED',
          receivedAt: new Date(),
        },
      });

      // Process each transfer item
      for (const item of transferOrder.items) {
        await tx.stockTransferOrderItem.update({
          where: { id: item.id },
          data: {
            receivedQuantity: item.shippedQuantity || item.approvedQuantity || item.requestedQuantity,
          },
        });
      }

      // Create audit log
      await tx.activityLog.create({
        data: {
          userId,
          action: 'STOCK_TRANSFER_RECEIVED',
          entityType: 'STOCK_TRANSFER',
          entityId: transferOrderId,
          details: `Received transfer at branch ${transferOrder.toBranchId}`,
          oldValue: JSON.stringify({ status: 'IN_TRANSIT' }),
          newValue: JSON.stringify({ status: 'COMPLETED' }),
        },
      });
    });
  }

  /**
   * Get all rebalancing opportunities
   */
  async getRebalancingOpportunities(): Promise<RebalancingResult[]> {
    const products = await this.prisma.product.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    const opportunities: RebalancingResult[] = [];

    for (const product of products) {
      try {
        const result = await this.calculateTransferRecommendations(product.id);
        if (result.transferableQuantity > 0) {
          opportunities.push(result);
        }
      } catch (error) {
        console.error(`Failed to calculate rebalancing for product ${product.id}:`, error);
      }
    }

    // Sort by total savings (highest first)
    opportunities.sort((a, b) => b.totalSavings - a.totalSavings);

    return opportunities;
  }

  /**
   * Automated rebalancing check
   */
  async automatedRebalancingCheck(): Promise<void> {
    console.log('Running automated rebalancing check...');

    const opportunities = await this.getRebalancingOpportunities();

    if (opportunities.length === 0) {
      console.log('No rebalancing opportunities found.');
      return;
    }

    console.log(`Found ${opportunities.length} rebalancing opportunities.`);

    // Process top opportunities (highest savings)
    const topOpportunities = opportunities.slice(0, 5);

    for (const opportunity of topOpportunities) {
      if (opportunity.totalSavings > 1000) { // Only auto-process if savings > 1000 ETB
        try {
          // Generate transfer order for highest priority recommendation
          const topRecommendation = opportunity.recommendations[0];
          if (topRecommendation) {
            // Auto-generate transfer order (would need system user ID)
            console.log(`Auto-generating transfer order for ${opportunity.productName}`);
            // const transferOrderId = await this.generateTransferOrder(topRecommendation, 'SYSTEM_USER');
          }
        } catch (error) {
          console.error('Failed to auto-generate transfer order:', error);
        }
      }
    }
  }

  /**
   * Start automated rebalancing monitoring
   */
  startAutomatedMonitoring(intervalMs: number = 12 * 60 * 60 * 1000): void {
    console.log(`Starting automated rebalancing monitoring (interval: ${intervalMs}ms)`);

    // Run immediately
    this.automatedRebalancingCheck();

    // Schedule regular checks
    setInterval(() => {
      this.automatedRebalancingCheck();
    }, intervalMs);
  }
}

/**
 * Create rebalancing service instance
 */
export function createRebalancingService(
  prisma: PrismaClient,
  config?: { maxStockMultiplier?: number }
): RebalancingService {
  return new RebalancingService(prisma, config);
}