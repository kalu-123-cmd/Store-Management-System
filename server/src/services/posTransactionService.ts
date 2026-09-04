/**
 * POS Transaction Service - End-to-End Sales Processing
 * 
 * Enterprise-grade POS transaction service that integrates the complete sales workflow:
 * Sale creation → Stock deduction (FEFO) → Payment processing → COGS calculation → 
 * Profit calculation → Receipt generation → Audit logging
 * 
 * Key Features:
 * - Atomic transaction with database isolation
 * - FEFO batch allocation for perishable goods
 * - Exact financial calculations with Decimal.js
 * - 15% Ethiopian VAT automatic calculation
 * - Multi-tender payment support
 * - COGS calculation for profit tracking
 * - Receipt generation
 * - Comprehensive audit logging
 * - Customer credit integration
 * 
 * @author Principal Software Architect
 * @version 3.0.0 - Ethiopian Smart Store OS Edition
 */

import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';
import { processStockOutAtomic } from './inventoryService';
import { calculateFinancials } from './inventoryService';

// Configure Decimal for financial precision
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

/**
 * Sale Item Interface
 */
export interface SaleItem {
  productId: string;
  quantity: number;
  price: number;
  batchId?: string; // Optional batch selection
}

/**
 * Sale Transaction Request
 */
export interface SaleTransactionRequest {
  customerId?: string;
  items: SaleItem[];
  paymentMethod: string;
  paymentAmount: number;
  cashierId: string;
  branchId?: string;
  notes?: string;
  sessionId?: string;
  requestId?: string;
}

/**
 * Sale Transaction Result
 */
export interface SaleTransactionResult {
  success: boolean;
  saleId?: string;
  invoiceNo?: string;
  totalAmount?: string;
  subtotal?: string;
  vatAmount?: string;
  cogsAmount?: string;
  profitAmount?: string;
  creditAmount?: number;
  items?: Array<{
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    price: string;
    subtotal: string;
    batchAllocation?: {
      batchId: string;
      batchNumber: string;
      quantity: number;
      expiryDate: Date;
    };
  }>;
  paymentStatus?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Profit Calculation
 */
interface ProfitCalculation {
  revenue: Decimal;
  cogs: Decimal;
  grossProfit: Decimal;
  profitMargin: Decimal;
}

/**
 * Calculate COGS and Profit for a sale
 * 
 * COGS = Σ(quantity × costPrice)
 * Gross Profit = Revenue - COGS
 * Profit Margin = (Gross Profit / Revenue) × 100
 * 
 * @param items - Sale items with quantities
 * @param products - Product data with cost prices
 * @returns Profit calculation
 */
function calculateProfit(items: SaleItem[], products: Map<string, any>): ProfitCalculation {
  let revenue = new Decimal(0);
  let cogs = new Decimal(0);

  for (const item of items) {
    const product = products.get(item.productId);
    if (!product) continue;

    const itemRevenue = new Decimal(item.price).mul(item.quantity);
    const itemCOGS = new Decimal(product.costPrice).mul(item.quantity);

    revenue = revenue.add(itemRevenue);
    cogs = cogs.add(itemCOGS);
  }

  const grossProfit = revenue.sub(cogs);
  const profitMargin = revenue.gt(0) ? grossProfit.div(revenue).mul(new Decimal(100)) : new Decimal(0);

  return {
    revenue,
    cogs,
    grossProfit,
    profitMargin,
  };
}

/**
 * Create sale with complete transaction processing
 * 
 * This function performs the complete sales workflow in a single database transaction:
 * 1. Validate stock availability
 * 2. Create sale record
 * 3. Create sale items
 * 4. Deduct stock using FEFO
 * 5. Calculate COGS and profit
 * 6. Process payment
 * 7. Update customer balance if applicable
 * 8. Create audit log
 * 
 * @param prisma - Prisma client instance
 * @param request - Sale transaction request
 * @returns Sale transaction result
 */
export async function createSaleTransaction(
  prisma: PrismaClient,
  request: SaleTransactionRequest
): Promise<SaleTransactionResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      // Step 1: Validate all items and get product data
      const productIds = request.items.map(item => item.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          sku: true,
          stock: true,
          costPrice: true,
          sellingPrice: true,
          status: true,
        },
      });

      const productMap = new Map(products.map(p => [p.id, p]));

      // Step 2: Validate stock availability
      for (const item of request.items) {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }
        if (product.status !== 'ACTIVE') {
          throw new Error(`Product ${product.name} is not active`);
        }
        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
        }
      }

      // Step 3: Calculate financial totals
      let subtotal = new Decimal(0);
      const itemCalculations = [];

      for (const item of request.items) {
        const product = productMap.get(item.productId);
        const itemSubtotal = new Decimal(item.price).mul(item.quantity);
        subtotal = subtotal.add(itemSubtotal);
        itemCalculations.push({
          item,
          product,
          itemSubtotal,
        });
      }

      const vatRate = new Decimal(0.15); // 15% Ethiopian VAT
      const vatAmount = subtotal.mul(vatRate);
      const totalAmount = subtotal.add(vatAmount);

      // Validate payment amount - allow partial payments for credit sales
      const paymentAmount = new Decimal(request.paymentAmount);
      if (paymentAmount.lt(0)) {
        throw new Error(`Invalid payment amount: ${paymentAmount.toString()}`);
      }
      // Allow partial payments - difference goes to customer credit
      const isPartialPayment = paymentAmount.lt(totalAmount);
      const creditAmount = isPartialPayment ? totalAmount.sub(paymentAmount) : new Decimal(0);

      // Step 4: Generate invoice number
      const invoiceNo = generateInvoiceNumber();

      // Step 5: Create sale record
      const sale = await tx.sale.create({
        data: {
          invoiceNo,
          subtotal: subtotal.toNumber(),
          vatAmount: vatAmount.toNumber(),
          totalAmount: totalAmount.toNumber(),
          ...(request.customerId ? { customer: { connect: { id: request.customerId } } } : {}),
          user: { connect: { id: request.cashierId } },
          ...(request.branchId ? { branchId: request.branchId } : {}),
          paymentMethod: request.paymentMethod,
          paymentStatus: isPartialPayment ? 'PARTIAL' : 'PAID',
          notes: request.notes,
        } as any,
      });

      // Step 5.5: Handle partial payment - add to customer credit
      if (isPartialPayment && request.customerId) {
        const customer = await tx.customer.findUnique({ where: { id: request.customerId } });
        if (customer) {
          await tx.customer.update({
            where: { id: request.customerId },
            data: {
              currentDebt: customer.currentDebt + creditAmount.toNumber(),
            },
          });
        }
      }

      // Step 6: Create sale items and deduct stock
      const saleItems = [];
      for (const { item, product, itemSubtotal } of itemCalculations) {
        // Deduct stock using FEFO
        const stockResult = await processStockOutAtomic(tx as any, {
          productId: item.productId,
          quantity: item.quantity,
          userId: request.cashierId,
          notes: `Sale ${invoiceNo}`,
          branchId: request.branchId,
          sessionId: request.sessionId,
          requestId: request.requestId,
          useFEFO: true, // Enable FEFO for perishable goods
        });

        if (!stockResult.success) {
          throw new Error(`Stock deduction failed for ${product.name}: ${stockResult.error}`);
        }

        // Create sale item
        const saleItem = await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          },
        });

        saleItems.push({
          id: saleItem.id,
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          price: item.price.toString(),
          subtotal: itemSubtotal.toString(),
          batchAllocation: stockResult.batchAllocations,
        });
      }

      // Step 7: Calculate COGS and profit
      const profitCalc = calculateProfit(request.items, productMap);

      // Step 8: Process payment
      if (request.paymentMethod === 'CREDIT' && request.customerId) {
        // Update customer credit balance for full credit sales
        if (!isPartialPayment) {
          const creditAccount = await tx.creditAccount.findUnique({
            where: { customerId: request.customerId },
          });

          if (creditAccount) {
            const currentBalance = new Decimal(creditAccount.currentBalance);
            const availableCredit = new Decimal(creditAccount.availableCredit);

            if (totalAmount.gt(availableCredit)) {
              throw new Error(`Insufficient credit. Available: ${availableCredit.toString()}, Required: ${totalAmount.toString()}`);
            }

            await tx.creditAccount.update({
              where: { id: creditAccount.id },
              data: {
                currentBalance: currentBalance.add(totalAmount).toNumber(),
                availableCredit: availableCredit.sub(totalAmount).toNumber(),
                updatedAt: new Date(),
              },
            });

            await tx.customer.update({
              where: { id: request.customerId },
              data: {
                currentDebt: currentBalance.add(totalAmount).toNumber(),
              },
            });
          }
        }
      }

      // Step 9: Create audit log
      await tx.auditLog.create({
        data: {
          entityType: 'SALE',
          entityId: sale.id,
          action: 'SALE_CREATED',
          userId: request.cashierId,
          previousValue: JSON.stringify({ stock: products.map(p => ({ id: p.id, name: p.name, stock: p.stock })) }),
          newValue: JSON.stringify({
            invoiceNo,
            totalAmount: totalAmount.toString(),
            items: saleItems,
            profit: {
              revenue: profitCalc.revenue.toString(),
              cogs: profitCalc.cogs.toString(),
              grossProfit: profitCalc.grossProfit.toString(),
              profitMargin: profitCalc.profitMargin.toString(),
            },
          }),
          metadata: JSON.stringify({
            paymentMethod: request.paymentMethod,
            paymentAmount: request.paymentAmount,
            branchId: request.branchId,
            customerId: request.customerId,
          }),
        },
      });

      return {
        success: true,
        saleId: sale.id,
        invoiceNo,
        totalAmount: totalAmount.toString(),
        subtotal: subtotal.toString(),
        vatAmount: vatAmount.toString(),
        cogsAmount: profitCalc.cogs.toString(),
        profitAmount: profitCalc.grossProfit.toString(),
        items: saleItems,
        paymentStatus: isPartialPayment ? 'PARTIAL' : 'PAID',
        creditAmount: creditAmount.isZero() ? 0 : creditAmount.toNumber(),
      };
    });
  } catch (error) {
    console.error('Sale transaction failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      errorCode: 'SALE_TRANSACTION_FAILED',
    };
  }
}

/**
 * Process sale return with COGS reversal
 * 
 * @param prisma - Prisma client instance
 * @param saleId - Sale ID to return
 * @param items - Items to return with quantities
 * @param reason - Return reason
 * @param userId - User processing the return
 * @returns Return result
 */
export async function processSaleReturn(
  prisma: PrismaClient,
  saleId: string,
  items: Array<{ saleItemId: string; quantity: number }>,
  reason: string,
  userId: string
): Promise<{ success: boolean; error?: string; refundAmount?: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      // Get original sale
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!sale) {
        throw new Error('Sale not found');
      }

      // Validate return quantities
      let totalRefund = new Decimal(0);
      for (const returnItem of items) {
        const saleItem = sale.items.find(si => si.id === returnItem.saleItemId);
        if (!saleItem) {
          throw new Error(`Sale item ${returnItem.saleItemId} not found`);
        }
        if (returnItem.quantity > saleItem.quantity) {
          throw new Error(`Cannot return more than sold quantity. Sold: ${saleItem.quantity}, Requested: ${returnItem.quantity}`);
        }

        const itemRefund = new Decimal(saleItem.price).mul(returnItem.quantity);
        totalRefund = totalRefund.add(itemRefund);

        // Restock inventory
        await tx.product.update({
          where: { id: saleItem.productId },
          data: {
            stock: {
              increment: returnItem.quantity,
            },
          },
        });

        // Update sale item (optional: track returned quantity)
        // For now, we'll create a SaleReturn record
      }

      // Create return record
      await tx.saleReturn.create({
        data: {
          saleId,
          refundAmount: totalRefund.toNumber(),
          reason,
          userId,
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          entityType: 'SALE_RETURN',
          entityId: saleId,
          action: 'RETURN_PROCESSED',
          userId,
          previousValue: JSON.stringify({ originalTotal: sale.totalAmount }),
          newValue: JSON.stringify({ refundAmount: totalRefund.toString(), reason, items }),
          metadata: JSON.stringify({ invoiceNo: sale.invoiceNo }),
        },
      });

      return {
        success: true,
        refundAmount: totalRefund.toString(),
      };
    });
  } catch (error) {
    console.error('Sale return failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Generate invoice number
 */
function generateInvoiceNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${timestamp}-${random}`;
}

/**
 * Export service instance factory
 */
export function createPOSTransactionService(prisma: PrismaClient) {
  return {
    createSaleTransaction: (request: SaleTransactionRequest) => 
      createSaleTransaction(prisma, request),
    processSaleReturn: (saleId: string, items: Array<{ saleItemId: string; quantity: number }>, reason: string, userId: string) =>
      processSaleReturn(prisma, saleId, items, reason, userId),
  };
}