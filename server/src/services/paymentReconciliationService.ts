/**
 * Payment Reconciliation Module
 * 
 * Enterprise-grade payment reconciliation system for Ethiopian retail operations.
 * Handles multi-tender checkouts, variance tracking, and cashier discrepancy logging.
 * 
 * Key Features:
 * - Multi-tender checkout support (Cash, Telebirr, CBE Birr, Card, Bank Transfer, Credit)
 * - Expected vs actual variance calculation
 * - Cashier discrepancy logging with explanation notes
 * - Payment method reconciliation
 * - Cash drawer balance tracking
 * - Ethiopian payment provider integration (Telebirr, CBE)
 * - Regulatory compliance and audit trail
 * 
 * @author Principal Software Architect
 * @version 3.0.0 - Ethiopian Smart Store OS Edition
 */

import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';

// Configure Decimal for financial precision
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

/**
 * Payment Method Types
 */
export enum PaymentMethod {
  CASH = 'CASH',
  TELEBIRR = 'TELEBIRR',
  CBE_BIRR = 'CBE_BIRR',
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CREDIT = 'CREDIT',
}

/**
 * Payment Status
 */
export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PARTIAL = 'PARTIAL',
  CANCELLED = 'CANCELLED',
}

/**
 * Tender Information
 */
export interface TenderInfo {
  method: PaymentMethod;
  amount: Decimal;
  referenceNumber?: string;
  status: PaymentStatus;
  processedAt?: Date;
}

/**
 * Reconciliation Result
 */
export interface ReconciliationResult {
  saleId: string;
  expectedTotal: Decimal;
  actualTotal: Decimal;
  variance: Decimal;
  variancePercentage: Decimal;
  isBalanced: boolean;
  tenders: TenderInfo[];
  discrepancies: Discrepancy[];
  requiresExplanation: boolean;
}

/**
 * Discrepancy Information
 */
export interface Discrepancy {
  method: PaymentMethod;
  expectedAmount: Decimal;
  actualAmount: Decimal;
  variance: Decimal;
  cashierId: string;
  explanation?: string;
  timestamp: Date;
}

/**
 * Cash Drawer Balance
 */
export interface CashDrawerBalance {
  cashierId: string;
  openingBalance: Decimal;
  currentBalance: Decimal;
  expectedBalance: Decimal;
  variance: Decimal;
  lastTransactionTime: Date;
}

/**
 * Payment Reconciliation Service
 */
export class PaymentReconciliationService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create sale with multi-tender payment reconciliation
   * 
   * @param saleData - Sale information
   * @param tenders - Array of tender information
   * @param cashierId - Cashier processing the sale
   * @returns Reconciliation result
   */
  async createSaleWithReconciliation(
    saleData: {
      customerId?: string;
      items: Array<{
        productId: string;
        quantity: number;
        price: number;
      }>;
      branchId?: string;
      notes?: string;
    },
    tenders: Array<{
      method: PaymentMethod;
      amount: number;
      referenceNumber?: string;
    }>,
    cashierId: string
  ): Promise<ReconciliationResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Calculate sale totals
        const subtotal = saleData.items.reduce(
          (sum, item) => sum.plus(new Decimal(item.price).mul(item.quantity)),
          new Decimal(0)
        );
        const vatRate = new Decimal(0.15); // 15% Ethiopian VAT
        const vatAmount = subtotal.mul(vatRate);
        const totalAmount = subtotal.add(vatAmount);

        // Generate invoice number
        const invoiceNo = this.generateInvoiceNumber();

        // Create sale record
        const sale = await tx.sale.create({
          data: {
            invoiceNo,
            subtotal: subtotal.toNumber(),
            vatAmount: vatAmount.toNumber(),
            totalAmount: totalAmount.toNumber(),
            customerId: saleData.customerId,
            paymentMethod: tenders.length === 1 ? tenders[0].method : 'MULTI_TENDER',
            paymentStatus: PaymentStatus.PENDING,
            branchId: saleData.branchId,
            cashierId,
            notes: saleData.notes,
          },
        });

        // Create sale items
        for (const item of saleData.items) {
          await tx.saleItem.create({
            data: {
              saleId: sale.id,
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
            },
          });
        }

        // Process each tender
        const processedTenders: TenderInfo[] = [];
        let actualTotal = new Decimal(0);

        for (const tender of tenders) {
          const tenderAmount = new Decimal(tender.amount);
          actualTotal = actualTotal.add(tenderAmount);

          // For cash payments, update cash drawer
          if (tender.method === PaymentMethod.CASH) {
            await this.updateCashDrawer(tx, cashierId, tenderAmount, 'IN');
          }

          // For mobile money, create payment record
          if (tender.method === PaymentMethod.TELEBIRR || tender.method === PaymentMethod.CBE_BIRR) {
            await tx.payment.create({
              data: {
                transactionId: sale.id,
                amount: tender.amount,
                currency: 'ETB',
                phoneNumber: '', // Would be provided in real scenario
                provider: tender.method,
                status: PaymentStatus.PENDING,
                callbackUrl: '',
                expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes expiry
                metadata: JSON.stringify({ tenderType: 'SALE_PAYMENT' }),
              },
            });
          }

          processedTenders.push({
            method: tender.method,
            amount: tenderAmount,
            referenceNumber: tender.referenceNumber,
            status: PaymentStatus.COMPLETED,
            processedAt: new Date(),
          });
        }

        // Calculate variance
        const variance = actualTotal.sub(totalAmount);
        const variancePercentage = totalAmount.gt(0) 
          ? variance.div(totalAmount).mul(new Decimal(100)).abs()
          : new Decimal(0);

        const isBalanced = variance.abs().lte(new Decimal(0.01)); // Within 1 cent

        // Update sale payment status
        const paymentStatus = isBalanced ? PaymentStatus.COMPLETED : PaymentStatus.PARTIAL;
        await tx.sale.update({
          where: { id: sale.id },
          data: { paymentStatus },
        });

        // Create reconciliation record
        if (!isBalanced) {
          await this.createDiscrepancyRecord(
            tx,
            sale.id,
            cashierId,
            PaymentMethod.CASH, // Default to cash for multi-tender variance
            totalAmount,
            actualTotal,
            variance
          );
        }

        // Create audit log
        await tx.auditLog.create({
          data: {
            entityType: 'SALE',
            entityId: sale.id,
            action: 'PAYMENT_RECONCILIATION',
            userId: cashierId,
            previousValue: JSON.stringify({ expected: totalAmount.toString() }),
            newValue: JSON.stringify({ actual: actualTotal.toString(), variance: variance.toString() }),
            metadata: JSON.stringify({
              invoiceNo,
              tenders: processedTenders,
              isBalanced,
            }),
          },
        });

        return {
          saleId: sale.id,
          expectedTotal: totalAmount,
          actualTotal,
          variance,
          variancePercentage,
          isBalanced,
          tenders: processedTenders,
          discrepancies: !isBalanced ? [{
            method: PaymentMethod.CASH,
            expectedAmount: totalAmount,
            actualAmount,
            variance,
            cashierId,
            timestamp: new Date(),
          }] : [],
          requiresExplanation: !isBalanced,
        };
      });
    } catch (error) {
      console.error('Payment reconciliation failed:', error);
      throw new Error(`Payment reconciliation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process daily cash drawer reconciliation
   * 
   * @param cashierId - Cashier ID
   * @param openingBalance - Opening balance for the day
   * @param closingBalance - Actual closing balance
   * @param explanation - Explanation for any variance
   * @returns Reconciliation result
   */
  async reconcileCashDrawer(
    cashierId: string,
    openingBalance: number,
    closingBalance: number,
    explanation?: string
  ): Promise<CashDrawerBalance> {
    try {
      const openingBalanceDecimal = new Decimal(openingBalance);
      const closingBalanceDecimal = new Decimal(closingBalance);
      
      // Get all cash transactions for the day
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const cashSales = await this.prisma.sale.findMany({
        where: {
          cashierId,
          paymentMethod: PaymentMethod.CASH,
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
        select: {
          totalAmount: true,
        },
      });

      const cashIn = cashSales.reduce(
        (sum, sale) => sum.plus(new Decimal(sale.totalAmount)),
        new Decimal(0)
      );

      const expectedBalance = openingBalanceDecimal.add(cashIn);
      const variance = closingBalanceDecimal.sub(expectedBalance);

      // Create discrepancy record if variance exists
      if (variance.abs().gt(new Decimal(0.01))) {
        await this.prisma.auditLog.create({
          data: {
            entityType: 'CASH_DRAWER',
            entityId: cashierId,
            action: 'CASH_RECONCILIATION',
            userId: cashierId,
            previousValue: JSON.stringify({ opening: openingBalance.toString(), cashIn: cashIn.toString() }),
            newValue: JSON.stringify({ closing: closingBalance.toString(), variance: variance.toString() }),
            metadata: JSON.stringify({ explanation }),
          },
        });
      }

      return {
        cashierId,
        openingBalance: openingBalanceDecimal,
        currentBalance: closingBalanceDecimal,
        expectedBalance,
        variance,
        lastTransactionTime: new Date(),
      };
    } catch (error) {
      console.error('Cash drawer reconciliation failed:', error);
      throw new Error(`Cash drawer reconciliation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create discrepancy record
   */
  private async createDiscrepancyRecord(
    prisma: PrismaClient,
    saleId: string,
    cashierId: string,
    method: PaymentMethod,
    expectedAmount: Decimal,
    actualAmount: Decimal,
    variance: Decimal
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        entityType: 'PAYMENT_DISCREPANCY',
        entityId: saleId,
        action: 'VARIANCE_DETECTED',
        userId: cashierId,
        previousValue: JSON.stringify({ expected: expectedAmount.toString() }),
        newValue: JSON.stringify({ actual: actualAmount.toString(), variance: variance.toString() }),
        metadata: JSON.stringify({
          method,
          varianceMagnitude: variance.abs().toString(),
          requiresExplanation: true,
        }),
      },
    });
  }

  /**
   * Update cash drawer balance
   */
  private async updateCashDrawer(
    prisma: PrismaClient,
    cashierId: string,
    amount: Decimal,
    type: 'IN' | 'OUT'
  ): Promise<void> {
    // Note: In production, this would update a CashDrawer model
    // For now, we'll log the transaction
    await prisma.auditLog.create({
      data: {
        entityType: 'CASH_DRAWER',
        entityId: cashierId,
        action: type === 'IN' ? 'CASH_IN' : 'CASH_OUT',
        userId: cashierId,
        newValue: JSON.stringify({ amount: amount.toString(), type }),
      },
    });
  }

  /**
   * Generate invoice number
   */
  private generateInvoiceNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `INV-${timestamp}-${random}`;
  }

  /**
   * Get payment reconciliation report for a date range
   * 
   * @param startDate - Start date
   * @param endDate - End date
   * @param cashierId - Optional cashier filter
   * @returns Reconciliation report
   */
  async getReconciliationReport(
    startDate: Date,
    endDate: Date,
    cashierId?: string
  ): Promise<{
    totalSales: number;
    totalRevenue: Decimal;
    totalVariance: Decimal;
    discrepancyCount: number;
    paymentMethodBreakdown: Record<PaymentMethod, { count: number; amount: Decimal }>;
  }> {
    try {
      const whereClause: any = {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      };

      if (cashierId) {
        whereClause.cashierId = cashierId;
      }

      const sales = await this.prisma.sale.findMany({
        where: whereClause,
      });

      const totalSales = sales.length;
      const totalRevenue = sales.reduce(
        (sum, sale) => sum.plus(new Decimal(sale.totalAmount)),
        new Decimal(0)
      );

      // Calculate payment method breakdown
      const paymentMethodBreakdown: Record<PaymentMethod, { count: number; amount: Decimal }> = {
        [PaymentMethod.CASH]: { count: 0, amount: new Decimal(0) },
        [PaymentMethod.TELEBIRR]: { count: 0, amount: new Decimal(0) },
        [PaymentMethod.CBE_BIRR]: { count: 0, amount: new Decimal(0) },
        [PaymentMethod.CARD]: { count: 0, amount: new Decimal(0) },
        [PaymentMethod.BANK_TRANSFER]: { count: 0, amount: new Decimal(0) },
        [PaymentMethod.CREDIT]: { count: 0, amount: new Decimal(0) },
      };

      for (const sale of sales) {
        const method = sale.paymentMethod as PaymentMethod;
        if (paymentMethodBreakdown[method]) {
          paymentMethodBreakdown[method].count++;
          paymentMethodBreakdown[method].amount = paymentMethodBreakdown[method].amount.plus(
            new Decimal(sale.totalAmount)
          );
        }
      }

      // Count discrepancies from audit logs
      const discrepancies = await this.prisma.auditLog.findMany({
        where: {
          action: 'VARIANCE_DETECTED',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          ...(cashierId && { userId: cashierId }),
        },
      });

      // Calculate total variance from discrepancies
      let totalVariance = new Decimal(0);
      for (const discrepancy of discrepancies) {
        const newValue = JSON.parse(discrepancy.newValue || '{}');
        if (newValue.variance) {
          totalVariance = totalVariance.add(new Decimal(newValue.variance));
        }
      }

      return {
        totalSales,
        totalRevenue,
        totalVariance,
        discrepancyCount: discrepancies.length,
        paymentMethodBreakdown,
      };
    } catch (error) {
      console.error('Reconciliation report generation failed:', error);
      throw new Error(`Reconciliation report generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Export service instance factory
 */
export function createPaymentReconciliationService(prisma: PrismaClient): PaymentReconciliationService {
  return new PaymentReconciliationService(prisma);
}