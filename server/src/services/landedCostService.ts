/**
 * Automated Landed Cost Distribution Service
 * 
 * This service allocates total import logistics costs (freight, customs, tariffs)
 * across imported SKUs by weight or value to determine exact True Landed Unit Costs.
 * 
 * Key Features:
 * - Multi-method cost allocation (by weight, by value, by quantity)
 * - Import logistics tracking
 * - Customs and tariff calculation
 * - True landed cost computation
 * - Cost optimization recommendations
 * - Supplier cost analysis
 * - Regulatory compliance for imports
 * 
 * @author Principal Software Architect
 * @version 2.0.0 - Enterprise Edition
 */

import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';

/**
 * Import Shipment
 */
export interface ImportShipment {
  id: string;
  shipmentNumber: string;
  supplierId: string;
  arrivalDate: Date;
  totalFreightCost: number;
  totalCustomsCost: number;
  totalTariffCost: number;
  totalInsuranceCost: number;
  totalHandlingCost: number;
  totalLogisticsCost: number;
  items: ImportShipmentItem[];
  allocationMethod: 'WEIGHT' | 'VALUE' | 'QUANTITY' | 'UNIFORM';
  createdAt: Date;
}

/**
 * Import Shipment Item
 */
export interface ImportShipmentItem {
  id: string;
  shipmentId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  weight: number; // in kg
  volume: number; // in m³
  allocatedFreightCost: number;
  allocatedCustomsCost: number;
  allocatedTariffCost: number;
  allocatedInsuranceCost: number;
  allocatedHandlingCost: number;
  totalAllocatedCost: number;
  trueLandedUnitCost: number;
}

/**
 * Cost Allocation Result
 */
export interface CostAllocationResult {
  productId: string;
  productName: string;
  originalUnitCost: number;
  allocatedFreightCost: number;
  allocatedCustomsCost: number;
  allocatedTariffCost: number;
  allocatedInsuranceCost: number;
  allocatedHandlingCost: number;
  totalAllocatedCost: number;
  trueLandedUnitCost: number;
  landedCostIncrease: number;
  landedCostIncreasePercentage: number;
}

/**
 * Landed Cost Configuration
 */
export interface LandedCostConfig {
  customsRate: number;        // Customs duty rate (%)
  tariffRate: number;          // Tariff rate (%)
  insuranceRate: number;       // Insurance rate (%)
  handlingRate: number;       // Handling rate (%)
  freightCostPerKg: number;   // Freight cost per kg
  handlingCostPerKg: number;  // Handling cost per kg
}

/**
 * Landed Cost Distribution Service
 */
export class LandedCostService {
  private prisma: PrismaClient;
  private config: LandedCostConfig;

  constructor(prisma: PrismaClient, config?: Partial<LandedCostConfig>) {
    this.prisma = prisma;
    this.config = {
      customsRate: 15,         // 15% customs duty (Ethiopia)
      tariffRate: 10,          // 10% tariff
      insuranceRate: 2,        // 2% insurance
      handlingRate: 5,         // 5% handling
      freightCostPerKg: 5,     // 5 ETB per kg
      handlingCostPerKg: 2,   // 2 ETB per kg
      ...config,
    };
  }

  /**
   * Allocate logistics costs using specified method
   * 
   * @param shipmentId - Shipment ID
   * @param method - Allocation method (WEIGHT, VALUE, QUANTITY, UNIFORM)
   * @returns Cost allocation results
   */
  async allocateLogisticsCosts(
    shipmentId: string,
    method: 'WEIGHT' | 'VALUE' | 'QUANTITY' | 'UNIFORM' = 'WEIGHT'
  ): Promise<CostAllocationResult[]> {
    const shipment = await this.prisma.importShipment.findUnique({
      where: { id: shipmentId },
      include: { items: true },
    });

    if (!shipment) {
      throw new Error('Shipment not found');
    }

    const results: CostAllocationResult[] = [];

    for (const item of shipment.items) {
      const allocation = this.allocateItemCosts(
        item,
        shipment,
        method
      );
      results.push(allocation);
    }

    // Update shipment with allocation method
    await this.prisma.importShipment.update({
      where: { id: shipmentId },
      data: { allocationMethod: method },
    });

    return results;
  }

  /**
   * Allocate costs for a single item
   */
  private allocateItemCosts(
    item: ImportShipmentItem,
    shipment: ImportShipment,
    method: 'WEIGHT' | 'VALUE' | 'QUANTITY' | 'UNIFORM'
  ): CostAllocationResult {
    let allocatedFreight = 0;
    let allocatedCustoms = 0;
    let allocatedTariff = 0;
    let allocatedInsurance = 0;
    let allocatedHandling = 0;

    const totalItems = shipment.items.length;

    switch (method) {
      case 'WEIGHT':
        // Allocate by weight
        const totalWeight = shipment.items.reduce((sum, i) => sum + i.weight, 0);
        const weightRatio = item.weight / totalWeight;
        allocatedFreight = shipment.totalFreightCost * weightRatio;
        allocatedCustoms = shipment.totalCustomsCost * weightRatio;
        allocatedTariff = shipment.totalTariffCost * weightRatio;
        allocatedInsurance = shipment.totalInsuranceCost * weightRatio;
        allocatedHandling = shipment.totalHandlingCost * weightRatio;
        break;

      case 'VALUE':
        // Allocate by total cost value
        const totalValue = shipment.items.reduce((sum, i) => sum + i.totalCost, 0);
        const valueRatio = item.totalCost / totalValue;
        allocatedFreight = shipment.totalFreightCost * valueRatio;
        allocatedCustoms = shipment.totalCustomsCost * valueRatio;
        allocatedTariff = shipment.totalTariffCost * valueRatio;
        allocatedInsurance = shipment.totalInsuranceCost * valueRatio;
        allocatedHandling = shipment.totalHandlingCost * valueRatio;
        break;

      case 'QUANTITY':
        // Allocate by quantity
        const totalQuantity = shipment.items.reduce((sum, i) => sum + i.quantity, 0);
        const quantityRatio = item.quantity / totalQuantity;
        allocatedFreight = shipment.totalFreightCost * quantityRatio;
        allocatedCustoms = shipment.totalCustomsCost * quantityRatio;
        allocatedTariff = shipment.totalTariffCost * quantityRatio;
        allocatedInsurance = shipment.totalInsuranceCost * quantityRatio;
        allocatedHandling = shipment.totalHandlingCost * quantityRatio;
        break;

      case 'UNIFORM':
        // Allocate uniformly across all items
        allocatedFreight = shipment.totalFreightCost / totalItems;
        allocatedCustoms = shipment.totalCustomsCost / totalItems;
        allocatedTariff = shipment.totalTariffCost / totalItems;
        allocatedInsurance = shipment.totalInsuranceCost / totalItems;
        allocatedHandling = shipment.totalHandlingCost / totalItems;
        break;
    }

    const totalAllocated = allocatedFreight + allocatedCustoms + allocatedTariff + allocatedInsurance + allocatedHandling;
    const trueLandedUnitCost = item.unitCost + (totalAllocated / item.quantity);
    const landedCostIncrease = trueLandedUnitCost - item.unitCost;
    const increasePercentage = (landedCostIncrease / item.unitCost) * 100;

    return {
      productId: item.productId,
      productName: item.productName,
      originalUnitCost: item.unitCost,
      allocatedFreightCost: allocatedFreight,
      allocatedCustomsCost: allocatedCustoms,
      allocatedTariffCost: allocatedTariff,
      allocatedInsuranceCost: allocatedInsurance,
      allocatedHandlingCost: allocatedHandling,
      totalAllocatedCost: totalAllocated,
      trueLandedUnitCost,
      landedCostIncrease,
      landedCostIncreasePercentage: increasePercentage,
    };
  }

  /**
   * Create import shipment record
   */
  async createImportShipment(
    supplierId: string,
    arrivalDate: Date,
    items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitCost: number;
      weight: number;
      volume: number;
    }>,
    logisticsCosts: {
      freightCost?: number;
      customsCost?: number;
      tariffCost?: number;
      insuranceCost?: number;
      handlingCost?: number;
    } = {}
  ): Promise<string> {
    const shipmentNumber = `IMP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const totalFreightCost = logisticsCosts.freightCost || 0;
    const totalCustomsCost = logisticsCosts.customsCost || 0;
    const totalTariffCost = logisticsCosts.tariffCost || 0;
    const totalInsuranceCost = logisticsCosts.insuranceCost || 0;
    const totalHandlingCost = logisticsCosts.handlingCost || 0;

    const totalLogisticsCost = totalFreightCost + totalCustomsCost + totalTariffCost + totalInsuranceCost + totalHandlingCost;

    const shipment = await this.prisma.importShipment.create({
      data: {
        shipmentNumber,
        supplierId,
        arrivalDate,
        totalFreightCost,
        totalCustomsCost,
        totalTariffCost,
        totalInsuranceCost,
        totalHandlingCost,
        totalLogisticsCost,
        allocationMethod: 'WEIGHT', // Default to weight-based allocation
      },
    });

    // Create shipment items
    for (const item of items) {
      await this.prisma.importShipmentItem.create({
        data: {
          shipmentId: shipment.id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.unitCost * item.quantity,
          weight: item.weight,
          volume: item.volume,
        },
      });
    }

    return shipment.id;
  }

  /**
   * Calculate estimated customs and tariff costs
   */
  calculateCustomsAndTariffs(cifValue: number): {
    customsCost: number;
    tariffCost: number;
    total: number;
  } {
    const customsCost = cifValue * (this.config.customsRate / 100);
    const tariffCost = cifValue * (this.config.tariffRate / 100);
    return {
      customsCost,
      tariffCost,
      total: customsCost + tariffCost,
    };
  }

  /**
   * Optimize allocation method recommendation
   */
  async recommendAllocationMethod(shipmentId: string): Promise<'WEIGHT' | 'VALUE' | 'QUANTITY' | 'UNIFORM'> {
    const shipment = await this.prisma.importShipment.findUnique({
      where: { id: shipmentId },
      include: { items: true },
    });

    if (!shipment) {
      throw new Error('Shipment not found');
    }

    // Analyze shipment characteristics
    const totalWeight = shipment.items.reduce((sum, i) => sum + i.weight, 0);
    const totalValue = shipment.items.reduce(( sum, i) => sum + i.totalCost, 0);
    const totalQuantity = shipment.items.reduce((sum, i) => sum + i.quantity, 0);

    const weightVariance = this.calculateVariance(shipment.items.map(i => i.weight));
    const valueVariance = this.calculateVariance(shipment.items.map(i => i.totalCost));
    const quantityVariance = this.calculateVariance(shipment.items.map(i => i.quantity));

    // Recommend method with lowest variance (most even distribution)
    if (weightVariance < valueVariance && weightVariance < quantityVariance) {
      return 'WEIGHT';
    } else if (valueVariance < quantityVariance) {
      return 'VALUE';
    } else if (quantityVariance < weightVariance) {
      return 'QUANTITY';
    } else {
      return 'UNIFORM';
    }
  }

  /**
   * Calculate variance for optimal allocation method selection
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDifferences = values.map(val => Math.pow(val - mean, 2));
    return squaredDifferences.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Update product costs with landed costs
   */
  async updateProductLandedCosts(
    shipmentId: string,
    method: 'WEIGHT' | 'VALUE' | 'QUANTITY' | 'UNIFORM' = 'WEIGHT'
  ): Promise<void> {
    const allocations = await this.allocateLogisticsCosts(shipmentId, method);

    for (const allocation of allocations) {
      await this.prisma.product.update({
        where: { id: allocation.productId },
        data: {
          costPrice: allocation.trueLandedUnitCost,
          updatedAt: new Date(),
        },
      });

      // Update shipment item with allocation
      await this.prisma.importShipmentItem.updateMany({
        where: { productId: allocation.productId, shipmentId },
        data: {
          allocatedFreightCost: allocation.allocatedFreightCost,
          allocatedCustomsCost: allocation.allocatedCustomsCost,
          allocatedTariffCost: allocation.allocatedTariffCost,
          allocatedInsuranceCost: allocation.allocatedInsuranceCost,
          allocatedHandlingCost: allocation.allocatedHandlingCost,
          totalAllocatedCost: allocation.totalAllocatedCost,
          trueLandedUnitCost: allocation.trueLandedUnitCost,
        },
      });
    }
  }

  /**
   * Get landed cost analysis for a product
   */
  async getProductLandedCostAnalysis(productId: string): Promise<{
    originalCost: number;
    averageLandedCost: number;
    landedCostIncrease: number;
    shipmentCount: number;
    lastShipmentDate: Date | null;
  }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, costPrice: true },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const shipmentItems = await this.prisma.importShipmentItem.findMany({
      where: { productId },
      select: { trueLandedUnitCost: true },
    });

    if (shipmentItems.length === 0) {
      return {
        originalCost: product.costPrice,
        averageLandedCost: product.costPrice,
        landedCostIncrease: 0,
        shipmentCount: 0,
        lastShipmentDate: null,
      };
    }

    const averageLandedCost = shipmentItems.reduce(
      (sum, item) => sum + item.trueLandedUnitCost,
      0
    ) / shipmentItems.length;

    const landedCostIncrease = averageLandedCost - product.costPrice;

    // Get last shipment date
    const lastShipment = await this.prisma.importShipment.findFirst({
      where: { items: { some: { productId } } },
      orderBy: { arrivalDate: 'desc' },
      select: { arrivalDate: true },
    });

    return {
      originalCost: product.costPrice,
      averageLandedCost,
      landedCostIncrease,
      shipmentCount: shipmentItems.length,
      lastShipmentDate: lastShipment?.arrivalDate || null,
    };
  }
}

/**
 * Create landed cost service instance
 */
export function createLandedCostService(
  prisma: PrismaClient,
  config?: Partial<LandedCostConfig>
): LandedCostService {
  return new LandedCostService(prisma, config);
}