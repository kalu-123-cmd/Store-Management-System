import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { grossProfit, netProfit, netRevenue, saleRefundTotal } from '../services/financials';

const sale = {
  totalAmount: 115,
  items: [{ price: 100, quantity: 1, costPrice: 40 }],
  returns: [] as { refundAmount: number }[],
};

describe('financials', () => {
  it('computes gross profit from cost snapshots', () => {
    assert.equal(grossProfit(sale), 60);
  });

  it('nets refunds out of revenue', () => {
    const returned = { ...sale, returns: [{ refundAmount: 115 }] };
    assert.equal(saleRefundTotal(returned), 115);
    assert.equal(netRevenue(returned), 0);
    assert.equal(netProfit(returned), 0);
  });

  it('scales profit for partial refunds', () => {
    const partial = { ...sale, returns: [{ refundAmount: 57.5 }] };
    assert.equal(netRevenue(partial), 57.5);
    assert.equal(netProfit(partial), 30);
  });
});
