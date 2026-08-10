/**
 * Inventory Service - High-Concurrency Pessimistic Locking with FEFO
 * 
 * Enterprise-grade inventory management with database-level locking to prevent
 * race conditions and overselling during high-concurrency checkout scenarios.
 * Enhanced with FEFO (First-Expired, First-Out) batch allocation for perishable goods.
 * 
 * Key Features:
 * - Pessimistic locking using SELECT ... FOR UPDATE (PostgreSQL)
 * - FEFO batch allocation for perishable goods
 * - Exact financial calculations with Decimal precision
 * - Automatic VAT calculation (15% Ethiopian standard)
 * - Transaction isolation for data consistency
 * - Stock level validation with safety checks
 * - Comprehensive error handling and logging
 * - Integration with ProductBatch for perishable goods
 * 
 * @author Principal Software Architect
 * @version 3.0.0 - Ethiopian Smart Store OS Edition
 */

import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';

// Configure Decimal for financial precision (28 decimal places)
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

export interface StockOutRequest {
  productId: string;
  quantity: number;
  userId: string;
  notes?: string;
  branchId?: string;
  sessionId?: string;
  requestId?: string;
  useFEFO?: boolean; // Enable FEFO batch allocation for perishable goods
}

export interface StockOutResult {
  success: boolean;
  transactionId?: string;
  remainingStock?: number;
  batchAllocations?: Array<{
    batchId: string;
    batchNumber: string;
    quantity: number;
    expiryDate: Date;
  }>;
  subtotal?: string;
  vatAmount?: string;
  totalAmount?: string;
  unitPrice?: string;
  error?: string;
  errorCode?: string;
}

export interface FinancialCalculations {
  unitPrice: Decimal;
  quantity: number;
  subtotal: Decimal;
  vatRate: Decimal;
  vatAmount: Decimal;
  totalAmount: Decimal;
}

/**
 * Calculate financial amounts with exact Decimal precision
 * 
 * Ethiopian VAT is 15% (0.15)
 * Formula: Total = (UnitPrice × Quantity) × 1.15
 * 
 * @param unitPrice - Price per unit
 * @param quantity - Quantity sold
 * @param vatRate - VAT rate (default 0.15 for Ethiopia)
 * @returns Financial calculations with exact precision
 */
export function calculateFinancials(
  unitPrice: number,
  quantity: number,
  vatRate: number = 0.15
): FinancialCalculations {
  const unitPriceDecimal = new Decimal(unitPrice);
  const quantityDecimal = new Decimal(quantity);
  const vatRateDecimal = new Decimal(vatRate);
  
  const subtotal = unitPriceDecimal.mul(quantityDecimal);
  const vatAmount = subtotal.mul(vatRateDecimal);
  const totalAmount = subtotal.add(vatAmount);
  
  return {
    unitPrice: unitPriceDecimal,
    quantity,
    subtotal,
    vatRate: vatRateDecimal,
    vatAmount,
    totalAmount,
  };
}

/**
 * Validate stock availability before transaction
 * 
 * @param currentStock - Current stock level
 * @param requestedQuantity - Quantity requested
 * @param minStockLevel - Minimum stock threshold
 * @returns Validation result
 */
function validateStockAvailability(
  currentStock: number,
  requestedQuantity: number,
  minStockLevel: number
): { valid: boolean; error?: string } {
  if (currentStock < 0) {
    return { valid: false, error: 'Invalid stock level (negative value)' };
  }
  
  if (requestedQuantity <= 0) {
    return { valid: false, error: 'Quantity must be positive' };
  }
  
  if (currentStock < requestedQuantity) {
    return { 
      valid: false, 
      error: `Insufficient stock. Available: ${currentStock}, Requested: ${requestedQuantity}` 
    };
  }
  
  const remainingStock = currentStock - requestedQuantity;
  if (remainingStock < minStockLevel) {
    console.warn(`Stock will fall below minimum level: ${remainingStock} < ${minStockLevel}`);
  }
  
  return { valid: true };
}

/**
 * Atomic Stock Out Operation with Pessimistic Locking
 * 
 * This function uses database-level locking to prevent race conditions:
 * 1. Acquires row-level lock on product record using SELECT ... FOR UPDATE
 * 2. Validates stock availability with safety checks
 * 3. Performs atomic stock reduction
 * 4. Creates transaction record with financial calculations
 * 5. Sets clearance status to PENDING_CLEARANCE
 * 6. Returns transaction details
 * 
 * For PostgreSQL, uses raw SQL FOR UPDATE locking
 * For SQLite, uses Prisma transaction (as FOR UPDATE not supported)
 * 
 * @param prisma - Prisma client instance
 * @param request - Stock out request details
 * @returns StockOutResult with transaction details or error
 */
export async function processStockOutAtomic(
  prisma: PrismaClient,
  request: StockOutRequest
): Promise<StockOutResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      // Step 1: Acquire pessimistic lock on product record
      // For PostgreSQL, use raw SQL FOR UPDATE to prevent race conditions
      const isPostgreSQL = process.env.DATABASE_URL?.includes('postgresql');
      
      let product;
      if (isPostgreSQL) {
        // PostgreSQL: Use raw SQL with FOR UPDATE lock
        const rawQuery = `
          SELECT id, name, sku, stock, sellingPrice, status, minStockLevel 
          FROM "Product" 
          WHERE id = $1 
          FOR UPDATE
        `;
        const result = await tx.$queryRawUnsafe(rawQuery, request.productId);
        product = result[0];
      } else {
        // SQLite: Use Prisma transaction (FOR UPDATE not supported)
        product = await tx.product.findUnique({
          where: { id: request.productId },
          select: {
            id: true,
            name: true,
            sku: true,
            stock: true,
            sellingPrice: true,
            status: true,
            minStockLevel: true,
          },
        });
      }

      if (!product) {
        throw new Error(`Product with ID ${request.productId} not found`);
      }

      if (product.status !== 'ACTIVE') {
        throw new Error(`Product ${product.name} is not active (status: ${product.status})`);
      }

      // Step 2: Validate stock availability
      const validation = validateStockAvailability(
        product.stock,
        request.quantity,
        product.minStockLevel
      );
      
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Step 2.5: FEFO Batch Allocation (if enabled and product has batches)
      let batchAllocations: Array<{
        batchId: string;
        batchNumber: string;
        quantity: number;
        expiryDate: Date;
      }> = [];

      if (request.useFEFO) {
        // Check if product has perishable batches
        const batches = await tx.productBatch.findMany({
          where: {
            productId: request.productId,
            status: 'ACTIVE',
            quantity: { gt: 0 },
          },
          orderBy: {
            expiryDate: 'asc', // Earliest expiry first (FEFO)
          },
          take: 10, // Limit to prevent excessive queries
        });

        if (batches.length > 0) {
          let remainingQuantity = request.quantity;
          
          for (const batch of batches) {
            if (remainingQuantity <= 0) break;
            
            const quantityToDeduct = Math.min(remainingQuantity, batch.quantity);
            
            // Deduct from batch
            await tx.productBatch.update({
              where: { id: batch.id },
              data: {
                quantity: {
                  decrement: quantityToDeduct,
                },
                updatedAt: new Date(),
              },
            });

            batchAllocations.push({
              batchId: batch.id,
              batchNumber: batch.batchNumber,
              quantity: quantityToDeduct,
              expiryDate: batch.expiryDate,
            });

            remainingQuantity -= quantityToDeduct;
          }

          // Check if we fulfilled the entire request from batches
          if (remainingQuantity > 0) {
            // Fall back to regular stock for remaining quantity
            console.warn(`Insufficient batch stock, using regular stock for ${remainingQuantity} units`);
          }
        }
      }

      // Step 3: Calculate financial amounts with exact precision
      const financials = calculateFinancials(product.sellingPrice, request.quantity);

      // Step 4: Perform atomic stock reduction
      const updatedProduct = await tx.product.update({
        where: { id: request.productId },
        data: {
          stock: {
            decrement: request.quantity,
          },
          updatedAt: new Date(),
        },
      });

      // Step 5: Create transaction record with PENDING_CLEARANCE status
      const transaction = await tx.transaction.create({
        data: {
          productId: request.productId,
          quantity: request.quantity,
          type: 'OUT',
          notes: request.notes,
          userId: request.userId,
          unitPrice: financials.unitPrice.toNumber(),
          subtotal: financials.subtotal.toNumber(),
          vatAmount: financials.vatAmount.toNumber(),
          totalAmount: financials.totalAmount.toNumber(),
          clearanceStatus: 'PENDING_CLEARANCE',
        },
      });

      // Step 6: Create audit log entry
      await tx.activityLog.create({
        data: {
          userId: request.userId,
          action: 'STOCK_OUT',
          entityType: 'PRODUCT',
          entityId: request.productId,
          details: `Stock out: ${request.quantity} units of ${product.name} (SKU: ${product.sku})`,
          oldValue: JSON.stringify({ stock: product.stock }),
          newValue: JSON.stringify({ stock: updatedProduct.stock }),
          changes: JSON.stringify({
            quantity: request.quantity,
            subtotal: financials.subtotal.toString(),
            vatAmount: financials.vatAmount.toString(),
            totalAmount: financials.totalAmount.toString(),
            branchId: request.branchId,
          }),
          sessionId: request.sessionId,
          requestId: request.requestId,
        },
      });

      return {
        success: true,
        transactionId: transaction.id,
        remainingStock: updatedProduct.stock,
        batchAllocations: batchAllocations.length > 0 ? batchAllocations : undefined,
        subtotal: financials.subtotal.toString(),
        vatAmount: financials.vatAmount.toString(),
        totalAmount: financials.totalAmount.toString(),
        unitPrice: financials.unitPrice.toString(),
      };
    });
  } catch (error) {
    console.error('Stock out atomic operation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      errorCode: 'STOCK_OUT_FAILED',
    };
  }
}

/**
 * Batch Stock Out Operation for Cart-Based Checkout
 * 
 * Processes multiple stock out operations in a single transaction
 * for POS cart scenarios. If any item fails, entire transaction is rolled back.
 * 
 * @param prisma - Prisma client instance
 * @param requests - Array of stock out requests
 * @returns Array of StockOutResult
 */
export async function processBatchStockOutAtomic(
  prisma: PrismaClient,
  requests: StockOutRequest[]
): Promise<StockOutResult[]> {
  try {
    return await prisma.$transaction(async (tx) => {
      const results: StockOutResult[] = [];

      for (const request of requests) {
        const result = await processStockOutAtomic(tx, request);
        results.push(result);

        if (!result.success) {
          throw new Error(`Batch processing failed: ${result.error}`);
        }
      }

      return results;
    });
  } catch (error) {
    console.error('Batch stock out atomic operation failed:', error);
    return requests.map(() => ({
      success: false,
      error: error instanceof Error ? error.message : 'Batch processing failed',
      errorCode: 'BATCH_STOCK_OUT_FAILED',
    }));
  }
}

/**
 * Stock In Operation (opposite of stock out)
 * 
 * Increases stock level and creates appropriate transaction record.
 * Typically used for receiving goods from suppliers or inter-branch transfers.
 * 
 * @param prisma - Prisma client instance
 * @param productId - Product ID
 * @param quantity - Quantity to add
 * @param userId - User performing the operation
 * @param notes - Optional notes
 * @param context - Additional context (branch, session, etc.)
 * @returns StockOutResult with transaction details
 */
export async function processStockIn(
  prisma: PrismaClient,
  productId: string,
  quantity: number,
  userId: string,
  notes?: string,
  context?: {
    branchId?: string;
    sessionId?: string;
    requestId?: string;
    source?: string; // 'SUPPLIER', 'TRANSFER', 'RETURN', 'ADJUSTMENT'
  }
): Promise<StockOutResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          sku: true,
          stock: true,
          costPrice: true,
          status: true,
        },
      });

      if (!product) {
        throw new Error(`Product with ID ${productId} not found`);
      }

      if (quantity <= 0) {
        throw new Error('Quantity must be positive for stock in');
      }

      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          stock: {
            increment: quantity,
          },
          updatedAt: new Date(),
        },
      });

      const financials = calculateFinancials(product.costPrice, quantity);

      const transaction = await tx.transaction.create({
        data: {
          productId,
          quantity,
          type: 'IN',
          notes: notes || `Stock in from ${context?.source || 'Unknown'}`,
          userId,
          unitPrice: financials.unitPrice.toNumber(),
          subtotal: financials.subtotal.toNumber(),
          vatAmount: 0, // Stock in typically doesn't include VAT
          totalAmount: financials.subtotal.toNumber(),
          clearanceStatus: 'CLEARED', // Stock in doesn't require clearance
        },
      });

      await tx.activityLog.create({
        data: {
          userId,
          action: 'STOCK_IN',
          entityType: 'PRODUCT',
          entityId: productId,
          details: `Stock in: ${quantity} units of ${product.name} (SKU: ${product.sku}) from ${context?.source || 'Unknown'}`,
          oldValue: JSON.stringify({ stock: product.stock }),
          newValue: JSON.stringify({ stock: updatedProduct.stock }),
          changes: JSON.stringify({
            quantity,
            subtotal: financials.subtotal.toString(),
            source: context?.source,
            branchId: context?.branchId,
          }),
          sessionId: context?.sessionId,
          requestId: context?.requestId,
        },
      });

      return {
        success: true,
        transactionId: transaction.id,
        remainingStock: updatedProduct.stock,
        subtotal: financials.subtotal.toString(),
        vatAmount: '0',
        totalAmount: financials.subtotal.toString(),
      };
    });
  } catch (error) {
    console.error('Stock in operation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      errorCode: 'STOCK_IN_FAILED',
    };
  }
}

/**
 * Get Current Stock with Lock for Validation
 * 
 * Returns current stock level with a lock to prevent concurrent modifications.
 * Useful for real-time stock validation in POS interfaces.
 * 
 * @param prisma - Prisma client instance
 * @param productId - Product ID
 * @returns Current stock level
 */
export async function getStockWithLock(
  prisma: PrismaClient,
  productId: string
): Promise<number> {
  const isPostgreSQL = process.env.DATABASE_URL?.includes('postgresql');
  
  if (isPostgreSQL) {
    const rawQuery = `SELECT stock FROM "Product" WHERE id = $1 FOR UPDATE`;
    const result = await prisma.$queryRawUnsafe(rawQuery, productId);
    return result[0]?.stock || 0;
  } else {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { stock: true },
    });
    return product?.stock || 0;
  }
}
