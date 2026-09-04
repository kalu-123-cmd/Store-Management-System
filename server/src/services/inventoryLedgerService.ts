/**
 * SmartStore OS — Inventory Ledger Service
 *
 * Append-only ledger that records EVERY stock change.
 * No stock can change without a corresponding movement record.
 *
 * Movement types:
 *   STOCK_IN         — Manual stock received (purchase order, supplier return)
 *   STOCK_OUT        — Manual stock removed (damaged, expired, correction)
 *   PURCHASE         — Goods received from a purchase order
 *   SALE             — Stock deducted by a POS sale
 *   CUSTOMER_RETURN  — Stock restored by a customer return/refund
 *   SUPPLIER_RETURN  — Stock returned to supplier
 *   DAMAGED          — Stock written off as damaged
 *   EXPIRED          — Stock written off as expired
 *   ADJUSTMENT       — Manual quantity set (stocktake correction)
 *   TRANSFER_OUT     — Stock sent to another branch/warehouse
 *   TRANSFER_IN      — Stock received from another branch/warehouse
 *
 * Rules:
 * - All writes go through a Prisma transaction
 * - previousStock and newStock are always recorded
 * - userId is always required — no anonymous mutations
 */

import { PrismaClient } from '@prisma/client';

export type MovementType =
  | 'STOCK_IN'
  | 'STOCK_OUT'
  | 'PURCHASE'
  | 'SALE'
  | 'CUSTOMER_RETURN'
  | 'SUPPLIER_RETURN'
  | 'DAMAGED'
  | 'EXPIRED'
  | 'ADJUSTMENT'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN';

export interface RecordMovementInput {
  productId:     string;
  movementType:  MovementType;
  /** Positive = stock increases, Negative = stock decreases */
  quantity:      number;
  previousStock: number;
  newStock:      number;
  referenceType?: string; // 'SALE' | 'PURCHASE_ORDER' | 'ADJUSTMENT' | 'RETURN' | 'TRANSFER'
  referenceId?:   string;
  batchId?:       string;
  unitCost?:      number;
  userId:        string;
  notes?:        string;
}

/**
 * Record a single inventory movement.
 * Must be called inside an existing Prisma transaction (tx).
 */
export async function recordMovement(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  input: RecordMovementInput
): Promise<void> {
  await (tx as any).inventoryMovement.create({
    data: {
      productId:     input.productId,
      movementType:  input.movementType,
      quantity:      input.quantity,
      previousStock: input.previousStock,
      newStock:      input.newStock,
      referenceType: input.referenceType ?? null,
      referenceId:   input.referenceId   ?? null,
      batchId:       input.batchId       ?? null,
      unitCost:      input.unitCost       ?? 0,
      userId:        input.userId,
      notes:         input.notes          ?? null,
    },
  });
}

/**
 * Perform a stock adjustment and record the movement — all in one transaction.
 * Handles: STOCK_IN, STOCK_OUT, ADJUSTMENT.
 */
export async function adjustStockWithLedger(
  prisma: PrismaClient,
  input: {
    productId:    string;
    quantity:     number;
    type:         'IN' | 'OUT' | 'ADJUSTMENT';
    userId:       string;
    notes?:       string;
    referenceType?: string;
    referenceId?:   string;
  }
): Promise<{ previousStock: number; newStock: number }> {
  return prisma.$transaction(async (tx) => {
    const product = await (tx as any).product.findUnique({
      where: { id: input.productId },
      select: { id: true, stock: true, costPrice: true, name: true },
    });

    if (!product) throw new Error(`Product ${input.productId} not found`);

    const previousStock = product.stock;
    let newStock: number;

    if (input.type === 'IN') {
      newStock = previousStock + input.quantity;

      // Update the product stock
      await (tx as any).product.update({
        where: { id: input.productId },
        data:  { stock: newStock, updatedAt: new Date() },
      });

    } else if (input.type === 'OUT') {
      if (previousStock < input.quantity) {
        throw new Error(`Insufficient stock. Available: ${previousStock}, Requested: ${input.quantity}`);
      }

      // Atomic conditional decrement — race-safe on both SQLite and PostgreSQL
      const updated = await (tx as any).product.update({
        where: { id: input.productId },
        data:  { stock: { decrement: input.quantity }, updatedAt: new Date() },
        select: { stock: true },
      });

      newStock = updated.stock;
      if (newStock < 0) {
        throw new Error(
          `Race condition: stock went negative for product ${input.productId}. ` +
          `Please retry the operation.`
        );
      }

    } else {
      // ADJUSTMENT — set absolute value
      newStock = input.quantity;
      if (newStock < 0) throw new Error('Stock quantity cannot be negative');

      await (tx as any).product.update({
        where: { id: input.productId },
        data:  { stock: newStock, updatedAt: new Date() },
      });
    }

    // Map type → movementType
    const movementType: MovementType =
      input.type === 'IN'  ? 'STOCK_IN'   :
      input.type === 'OUT' ? 'STOCK_OUT'  :
      'ADJUSTMENT';

    // Record ledger entry
    await recordMovement(tx as any, {
      productId:     input.productId,
      movementType,
      quantity:      input.type === 'OUT' ? -input.quantity : input.quantity,
      previousStock,
      newStock,
      referenceType: input.referenceType,
      referenceId:   input.referenceId,
      unitCost:      product.costPrice,
      userId:        input.userId,
      notes:         input.notes,
    });

    return { previousStock, newStock };
  });
}

/**
 * Query movement history for a product.
 */
export async function getProductMovements(
  prisma: PrismaClient,
  productId: string,
  options: { limit?: number; offset?: number } = {}
) {
  return (prisma as any).inventoryMovement.findMany({
    where:   { productId },
    orderBy: { createdAt: 'desc' },
    take:    options.limit  ?? 100,
    skip:    options.offset ?? 0,
  });
}

/**
 * Get recent movements across all products (for audit/dashboard).
 */
export async function getRecentMovements(
  prisma: PrismaClient,
  options: {
    limit?:        number;
    movementType?: string;
    userId?:       string;
    productId?:    string;
    startDate?:    Date;
    endDate?:      Date;
  } = {}
) {
  const where: any = {};
  if (options.movementType) where.movementType = options.movementType;
  if (options.userId)       where.userId       = options.userId;
  if (options.productId)    where.productId    = options.productId;
  if (options.startDate || options.endDate) {
    where.createdAt = {};
    if (options.startDate) where.createdAt.gte = options.startDate;
    if (options.endDate)   where.createdAt.lte = options.endDate;
  }

  return (prisma as any).inventoryMovement.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take:    options.limit ?? 200,
    include: {
      product: { select: { id: true, name: true, sku: true } },
    },
  });
}
