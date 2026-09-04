/**
 * Shared financial helpers — net revenue and profit after returns.
 * Uses SaleItem.costPrice snapshots so historical COGS stays accurate
 * even if product cost changes later.
 */

export type SaleLike = {
  totalAmount: number;
  items: Array<{
    price: number;
    quantity: number;
    costPrice?: number | null;
    product?: { costPrice?: number | null } | null;
  }>;
  returns?: Array<{ refundAmount: number }> | null;
};

export function saleRefundTotal(sale: SaleLike): number {
  return (sale.returns ?? []).reduce((sum, r) => sum + (Number(r.refundAmount) || 0), 0);
}

export function netRevenue(sale: SaleLike): number {
  return Math.max(0, Number(sale.totalAmount) - saleRefundTotal(sale));
}

export function grossProfit(sale: SaleLike): number {
  return sale.items.reduce((sum, item) => {
    const cost = Number(item.costPrice ?? item.product?.costPrice ?? 0);
    return sum + (Number(item.price) - cost) * Number(item.quantity);
  }, 0);
}

/** Scale gross profit by the unrefunded portion of the sale. */
export function netProfit(sale: SaleLike): number {
  const refund = saleRefundTotal(sale);
  const gross = grossProfit(sale);
  const total = Number(sale.totalAmount) || 0;
  if (refund <= 0) return gross;
  if (total <= 0) return 0;
  const remaining = Math.max(0, 1 - refund / total);
  return Math.round(gross * remaining * 100) / 100;
}
