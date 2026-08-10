/**
 * Autonomous AI Supply Chain Reorder Agent
 * 
 * This service implements an intelligent supply chain management system that
 * automatically calculates reorder points, generates purchase orders, and drafts
 * communication messages using LLM integration.
 * 
 * Key Features:
 * - Dynamic Reorder Point (ROP) calculation
 * - Daily Sales Velocity tracking
 * - Lead Time-based safety stock calculation
 * - LLM-powered purchase order generation
 * - Multi-language message drafting (Amharic & English)
 * - WhatsApp/Telegram message templates
 * - Supplier integration
 * 
 * Formula: ROP = (Daily Sales Velocity × Lead Time) + Safety Stock
 * 
 * @author Principal Software Architect
 * @version 2.0.0 - Enterprise Edition
 */

import { PrismaClient } from '@prisma/client';
import { openai } from '@ai-sdk/openai';

/**
 * Reorder Point Calculation Result
 */
export interface ReorderPointCalculation {
  productId: string;
  productName: string;
  currentStock: number;
  dailySalesVelocity: number;
  leadTimeDays: number;
  safetyStock: number;
  reorderPoint: number;
  recommendedOrderQuantity: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason: string;
}

/**
 * AI-Generated Purchase Order Draft
 */
export interface PurchaseOrderDraft {
  supplierId: string;
  supplierName: string;
  supplierContact: string;
  items: {
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  totalAmount: number;
  estimatedDeliveryDate: Date;
  notes: string;
  urgency: string;
}

/**
 * Message Draft for Communication
 */
export interface MessageDraft {
  platform: 'WHATSAPP' | 'TELEGRAM' | 'EMAIL';
  language: 'ENGLISH' | 'AMHARIC';
  recipient: string;
  subject?: string;
  message: string;
  urgency: string;
}

/**
 * Sales Velocity Data
 */
export interface SalesVelocity {
  productId: string;
  dailyAverage: number;
  weeklyAverage: number;
  monthlyAverage: number;
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  confidence: number;
}

/**
 * Supplier Lead Time Configuration
 */
export interface SupplierLeadTime {
  supplierId: string;
  supplierName: string;
  averageLeadTimeDays: number;
  reliability: number; // 0-1 score
  lastUpdated: Date;
}

/**
 * AI Reorder Agent Service
 */
export class AIReorderAgent {
  private prisma: PrismaClient;
  private leadTimeDays: number = 7; // Default 7 days lead time
  private safetyStockMultiplier: number = 1.5; // 50% safety stock buffer

  constructor(prisma: PrismaClient, config?: { leadTimeDays?: number; safetyStockMultiplier?: number }) {
    this.prisma = prisma;
    if (config?.leadTimeDays) this.leadTimeDays = config.leadTimeDays;
    if (config?.safetyStockMultiplier) this.safetyStockMultiplier = config.safetyStockMultiplier;
  }

  /**
   * Calculate daily sales velocity for a product
   * 
   * @param productId - Product ID
   * @param days - Number of days to analyze (default: 30)
   * @returns Sales velocity data
   */
  async calculateSalesVelocity(productId: string, days: number = 30): Promise<SalesVelocity> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        productId,
        type: 'OUT',
        createdAt: { gte: startDate },
      },
      select: { quantity: true, createdAt: true },
    });

    const totalQuantity = transactions.reduce((sum, t) => sum + t.quantity, 0);
    const dailyAverage = totalQuantity / days;
    const weeklyAverage = dailyAverage * 7;
    const monthlyAverage = dailyAverage * 30;

    // Calculate trend (compare first half vs second half)
    const midPoint = Math.floor(transactions.length / 2);
    const firstHalf = transactions.slice(0, midPoint);
    const secondHalf = transactions.slice(midPoint);
    
    const firstHalfAvg = firstHalf.length > 0 
      ? firstHalf.reduce((sum, t) => sum + t.quantity, 0) / firstHalf.length 
      : 0;
    const secondHalfAvg = secondHalf.length > 0 
      ? secondHalf.reduce((sum, t) => sum + t.quantity, 0) / secondHalf.length 
      : 0;

    let trend: 'INCREASING' | 'DECREASING' | 'STABLE' = 'STABLE';
    if (secondHalfAvg > firstHalfAvg * 1.1) trend = 'INCREASING';
    else if (secondHalfAvg < firstHalfAvg * 0.9) trend = 'DECREASING';

    // Confidence based on data points
    const confidence = Math.min(transactions.length / 10, 1);

    return {
      productId,
      dailyAverage,
      weeklyAverage,
      monthlyAverage,
      trend,
      confidence,
    };
  }

  /**
   * Calculate dynamic Reorder Point (ROP)
   * 
   * Formula: ROP = (Daily Sales Velocity × Lead Time) + Safety Stock
   * Safety Stock = Daily Sales Velocity × Safety Stock Multiplier
   * 
   * @param productId - Product ID
   * @returns Reorder point calculation
   */
  async calculateReorderPoint(productId: string): Promise<ReorderPointCalculation> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        minStockLevel: true,
        supplierId: true,
      },
    });

    if (!product) {
      throw new Error(`Product with ID ${productId} not found`);
    }

    const velocity = await this.calculateSalesVelocity(productId);
    const dailySalesVelocity = velocity.dailyAverage;

    // Calculate safety stock
    const safetyStock = Math.ceil(dailySalesVelocity * this.safetyStockMultiplier);

    // Calculate reorder point
    const reorderPoint = Math.ceil((dailySalesVelocity * this.leadTimeDays) + safetyStock);

    // Determine urgency
    let urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    const stockRatio = product.stock / reorderPoint;

    if (stockRatio <= 0.25) urgency = 'CRITICAL';
    else if (stockRatio <= 0.5) urgency = 'HIGH';
    else if (stockRatio <= 0.75) urgency = 'MEDIUM';

    // Calculate recommended order quantity
    const recommendedOrderQuantity = Math.max(
      reorderPoint - product.stock,
      Math.ceil(velocity.monthlyAverage * 0.3) // Order at least 30% of monthly average
    );

    const reason = urgency === 'CRITICAL' 
      ? `Stock critically low (${product.stock}/${reorderPoint}). Immediate reorder required.`
      : urgency === 'HIGH'
      ? `Stock below recommended level (${product.stock}/${reorderPoint}). Reorder recommended.`
      : `Stock approaching reorder point (${product.stock}/${reorderPoint}). Plan ahead.`;

    return {
      productId: product.id,
      productName: product.name,
      currentStock: product.stock,
      dailySalesVelocity,
      leadTimeDays: this.leadTimeDays,
      safetyStock,
      reorderPoint,
      recommendedOrderQuantity,
      urgency,
      reason,
    };
  }

  /**
   * Generate AI-powered purchase order draft using LLM
   * 
   * @param products - Array of product IDs to include in PO
   * @returns AI-generated purchase order draft
   */
  async generatePurchaseOrderDraft(products: string[]): Promise<PurchaseOrderDraft> {
    const reorderCalculations = await Promise.all(
      products.map(p => this.calculateReorderPoint(p))
    );

    // Group by supplier
    const supplierGroups = new Map<string, typeof reorderCalculations>();
    for (const calc of reorderCalculations) {
      const product = await this.prisma.product.findUnique({
        where: { id: calc.productId },
        select: { supplierId: true },
      });

      if (product?.supplierId) {
        if (!supplierGroups.has(product.supplierId)) {
          supplierGroups.set(product.supplierId, []);
        }
        supplierGroups.get(product.supplierId)!.push(calc);
      }
    }

    // Generate PO for highest priority supplier (most urgent items)
    let bestSupplierId = '';
    let bestScore = 0;
    let bestItems: typeof reorderCalculations = [];

    for (const [supplierId, items] of supplierGroups) {
      const urgencyScore = items.reduce((sum, item) => {
        const score = item.urgency === 'CRITICAL' ? 4 : 
                      item.urgency === 'HIGH' ? 3 : 
                      item.urgency === 'MEDIUM' ? 2 : 1;
        return sum + score;
      }, 0);

      if (urgencyScore > bestScore) {
        bestScore = urgencyScore;
        bestSupplierId = supplierId;
        bestItems = items;
      }
    }

    if (!bestSupplierId) {
      throw new Error('No suitable supplier found for purchase order');
    }

    const supplier = await this.prisma.supplier.findUnique({
      where: { id: bestSupplierId },
      select: { id: true, name: true, contactName: true, email: true, phone: true },
    });

    if (!supplier) {
      throw new Error('Supplier not found');
    }

    // Generate PO items with pricing
    const poItems = await Promise.all(
      bestItems.map(async (calc) => {
        const product = await this.prisma.product.findUnique({
          where: { id: calc.productId },
          select: { id: true, name: true, sku: true, costPrice: true },
        });

        const unitPrice = product?.costPrice || 0;
        const totalPrice = unitPrice * calc.recommendedOrderQuantity;

        return {
          productId: calc.productId,
          productName: product?.name || '',
          sku: product?.sku || '',
          quantity: calc.recommendedOrderQuantity,
          unitPrice,
          totalPrice,
        };
      })
    );

    const totalAmount = poItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const estimatedDeliveryDate = new Date(Date.now() + this.leadTimeDays * 24 * 60 * 60 * 1000);

    // Generate AI notes using LLM
    const notes = await this.generateAIOrderNotes(poItems, supplier.name, totalAmount);

    const urgency = bestItems.some(i => i.urgency === 'CRITICAL') ? 'CRITICAL' :
                   bestItems.some(i => i.urgency === 'HIGH') ? 'HIGH' : 'NORMAL';

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierContact: supplier.contactName || supplier.email || supplier.phone || '',
      items: poItems,
      totalAmount,
      estimatedDeliveryDate,
      notes,
      urgency,
    };
  }

  /**
   * Generate AI-powered order notes using LLM
   */
  private async generateAIOrderNotes(
    items: any[],
    supplierName: string,
    totalAmount: number
  ): Promise<string> {
    try {
      // Check if OpenAI API key is configured
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return this.generateFallbackNotes(items, supplierName, totalAmount);
      }

      const prompt = `Generate professional purchase order notes for the following order:
      
      Supplier: ${supplierName}
      Total Amount: ${totalAmount.toFixed(2)} ETB
      Items: ${items.map(i => `${i.productName} (${i.quantity} units)`).join(', ')}
      
      The notes should be:
      - Professional and concise
      - Include delivery timeline expectations
      - Mention quality requirements
      - Be suitable for Ethiopian business context
      - Maximum 150 words`;

      const result = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a professional procurement assistant for Ethiopian retail businesses.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      return result.choices[0]?.message?.content || this.generateFallbackNotes(items, supplierName, totalAmount);
    } catch (error) {
      console.error('AI note generation failed, using fallback:', error);
      return this.generateFallbackNotes(items, supplierName, totalAmount);
    }
  }

  /**
   * Fallback notes generation (without AI)
   */
  private generateFallbackNotes(items: any[], supplierName: string, totalAmount: number): string {
    const itemCount = items.length;
    const urgentItems = items.filter(i => i.quantity > 100).length;
    
    return `Purchase order for ${itemCount} items totaling ${totalAmount.toFixed(2)} ETB. ` +
           `Expected delivery within ${this.leadTimeDays} days. ` +
           `${urgentItems > 0 ? `${urgentItems} items require urgent attention. ` : ''}` +
           `Please ensure quality standards are met. Contact for any issues.`;
  }

  /**
   * Generate WhatsApp message draft in Amharic and English
   */
  async generateWhatsAppMessage(
    supplierId: string,
    language: 'ENGLISH' | 'AMHARIC' = 'ENGLISH'
  ): Promise<MessageDraft> {
    const poDraft = await this.generatePurchaseOrderDraft(
      (await this.getProductsNeedingReorder()).map(p => p.productId)
    );

    const recipient = await this.getSupplierWhatsApp(supplierId);

    if (language === 'AMHARIC') {
      return {
        platform: 'WHATSAPP',
        language: 'AMHARIC',
        recipient,
        message: this.generateAmharicReorderMessage(poDraft),
        urgency: poDraft.urgency,
      };
    } else {
      return {
        platform: 'WHATSAPP',
        language: 'ENGLISH',
        recipient,
        message: this.generateEnglishReorderMessage(poDraft),
        urgency: poDraft.urgency,
      };
    }
  }

  /**
   * Generate English reorder message
   */
  private generateEnglishReorderMessage(po: PurchaseOrderDraft): string {
    return `Dear ${po.supplierName},

We would like to place a new purchase order:

Order Details:
- Total Amount: ${po.totalAmount.toFixed(2)} ETB
- Items: ${po.items.map(i => `${i.productName} (${i.quantity} x ${i.unitPrice.toFixed(2)} ETB)`).join(', ')}
- Expected Delivery: ${po.estimatedDeliveryDate.toLocaleDateString()}

${po.notes}

${po.urgency === 'CRITICAL' ? 'URGENT: Please confirm receipt immediately.' : ''}

Best regards,
Store Management Team`;
  }

  /**
   * Generate Amharic reorder message
   */
  private generateAmharicReorderMessage(po: PurchaseOrderDraft): string {
    return `እንንል ለ ${po.supplierName}},

አዲስ አዲስ ማዘግጽ እንዘል እንዴልንም:

የትይበት ዝርም:
- ጠቅላል ዋጋ: ${po.totalAmount.toFixed(2)} ብር
- እቃዎች: ${po.items.map(i => `${i.productName} (${i.quantity} x ${i.unitPrice.toFixed(2)} ብር)`).join(', ')}
- የመጣቢያ ቀን: ${po.estimatedDeliveryDate.toLocaleDateString('am-ET')}

${po.notes}

${po.urgency === 'CRITICAL' ? 'አደዋር: እባክት በፈጸት ይረጋግል።' : ''}

ከምርታው ጠባቢ ቡዕም,
የማሽው አስተዳደሪያ ቡዕም`;
  }

  /**
   * Get products needing reorder
   */
  private async getProductsNeedingReorder(): Promise<Array<{ productId: string; urgency: string }>> {
    const products = await this.prisma.product.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    const reorderNeeded: Array<{ productId: string; urgency: string }> = [];

    for (const product of products) {
      const calc = await this.calculateReorderPoint(product.id);
      if (calc.currentStock < calc.reorderPoint) {
        reorderNeeded.push({
          productId: product.id,
          urgency: calc.urgency,
        });
      }
    }

    return reorderNeeded.sort((a, b) => {
      const urgencyOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });
  }

  /**
   * Get supplier WhatsApp number
   */
  private async getSupplierWhatsApp(supplierId: string): Promise<string> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { phone: true },
    });

    return supplier?.phone || '';
  }

  /**
   * Automated reorder check and notification
   * 
   * Runs periodically to check stock levels and generate reorder alerts
   */
  async automatedReorderCheck(): Promise<void> {
    console.log('Running automated reorder check...');

    const productsNeedingReorder = await this.getProductsNeedingReorder();

    if (productsNeedingReorder.length === 0) {
      console.log('No products need reordering.');
      return;
    }

    console.log(`Found ${productsNeedingReorder.length} products needing reorder.`);

    // Generate PO for critical items
    const criticalItems = productsNeedingReorder.filter(p => p.urgency === 'CRITICAL');
    if (criticalItems.length > 0) {
      try {
        const poDraft = await this.generatePurchaseOrderDraft(
          criticalItems.map(p => p.productId)
        );
        console.log('Generated purchase order draft for critical items:', poDraft);

        // Generate WhatsApp message
        const message = await this.generateWhatsAppMessage(poDraft.supplierId, 'ENGLISH');
        console.log('WhatsApp message ready:', message.message);

        // Store alert in database
        await this.prisma.riskIndicator.create({
          data: {
            entityType: 'PRODUCT',
            riskType: 'STOCK_OUT_RISK',
            severity: 'HIGH',
            description: `${criticalItems.length} critical products need reorder`,
            confidence: 0.9,
            metadata: JSON.stringify({
              products: criticalItems,
              purchaseOrder: poDraft,
              message: message,
            }),
          },
        });
      } catch (error) {
        console.error('Failed to generate purchase order:', error);
      }
    }
  }

  /**
   * Start automated reorder monitoring
   */
  startAutomatedMonitoring(intervalMs: number = 6 * 60 * 60 * 1000): void {
    console.log(`Starting automated reorder monitoring (interval: ${intervalMs}ms)`);

    // Run immediately
    this.automatedReorderCheck();

    // Schedule regular checks
    setInterval(() => {
      this.automatedReorderCheck();
    }, intervalMs);
  }
}

/**
 * Create AI reorder agent instance
 */
export function createAIReorderAgent(
  prisma: PrismaClient,
  config?: { leadTimeDays?: number; safetyStockMultiplier?: number }
): AIReorderAgent {
  return new AIReorderAgent(prisma, config);
}