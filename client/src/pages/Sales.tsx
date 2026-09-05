import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, ShoppingCart, X, Receipt, ChevronLeft, ChevronRight,
  Printer, Package, User, Calendar, Hash, Barcode, RotateCcw, AlertTriangle, WifiOff,
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { useRole } from '../hooks/useRole';
import { fmt } from '../lib/currency';
import { useLangContext } from '../lib/LangContext';
import { enqueueSale, isBrowserOnline, listPendingSales, markPendingFailed, removePendingSale } from '../lib/offlineQueue';

// ── GraphQL ───────────────────────────────────────────────────────────────────

const GET_SALES_DATA = gql`
  query GetSalesData {
    sales(limit: 100) {
      id invoiceNo totalAmount subtotal vatAmount paymentMethod paymentStatus status notes createdAt
      customer { id name email phone }
      user { name }
      items { id quantity price costPrice product { name sku } }
      returns { id refundAmount reason createdAt }
    }
    products { id name sku barcode sellingPrice stock imageUrl costPrice }
    customers { id name phone currentDebt creditLimit }
  }
`;

const CREATE_SALE = gql`
  mutation CreateSale(
    $customerId: String
    $items: [CreateSaleItemInput!]!
    $paymentMethod: String
    $paymentAmount: Float
    $notes: String
    $idempotencyKey: String
  ) {
    createSale(
      customerId: $customerId
      items: $items
      paymentMethod: $paymentMethod
      paymentAmount: $paymentAmount
      notes: $notes
      idempotencyKey: $idempotencyKey
    ) {
      id invoiceNo totalAmount subtotal vatAmount paymentStatus
      customer { id name }
      items { id quantity price costPrice product { name sku } }
    }
  }
`;

const RETURN_SALE = gql`
  mutation ReturnSale($saleId: ID!, $reason: String, $items: [ReturnItemInput!]) {
    returnSale(saleId: $saleId, reason: $reason, items: $items) { id refundAmount createdAt }
  }
`;

const PAGE_SIZE = 10;
type CartItem = { productId: string; name: string; quantity: number; price: number; stock: number };

const PAYMENT_METHODS = [
  { id: 'CASH', label: 'Cash' },
  { id: 'CARD', label: 'Card' },
  { id: 'TELEBIRR', label: 'Telebirr' },
  { id: 'CBE_BIRR', label: 'CBE Birr' },
  { id: 'BANK_TRANSFER', label: 'Bank transfer' },
  { id: 'CREDIT', label: 'Credit (utang)' },
];

// ── Receipt + Return Modal ────────────────────────────────────────────────────

function ReceiptModal({ sale, onClose, refetch }: { sale: any; onClose: () => void; refetch: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);
  const [returnReason, setReturnReason] = useState('');
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [returnSale, { loading: returning }] = useMutation(RETURN_SALE);
  const { success, error: toastError } = useToast();
  const { canMutate } = useRole();
  const isReturned = sale.returns?.length > 0;

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const w = window.open('', '_blank', 'width=420,height=600');
    if (!w) return;
    w.document.write(`<html><head><title>Receipt ${sale.invoiceNo}</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Courier New',monospace;font-size:12px;padding:16px;width:320px}
      .center{text-align:center}.bold{font-weight:bold}.row{display:flex;justify-content:space-between;margin:3px 0}
      table{width:100%}td,th{padding:4px 2px}th{border-bottom:1px solid #ccc;font-size:10px;text-transform:uppercase}</style>
      </head><body onload="window.print();window.close()">${content}</body></html>`);
    w.document.close();
  };

  const handleReturn = async () => {
    try {
      const items = (sale.items || [])
        .map((i: any) => ({ saleItemId: i.id, quantity: Number(returnQty[i.id] ?? i.quantity) }))
        .filter((i: { quantity: number }) => i.quantity > 0);
      await returnSale({
        variables: {
          saleId: sale.id,
          reason: returnReason || null,
          items: items.length ? items : undefined,
        },
      });
      success('Refund processed', 'Stock restored for returned items.');
      refetch(); onClose();
    } catch (e: any) { toastError('Return failed', e.message); }
  };

  if (!sale) return null;
  const subtotal = sale.items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[92vh]">

          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                <Receipt size={16} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Sale Receipt</h2>
                <p className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
                  {sale.invoiceNo}
                  {isReturned && (
                    <span className="bg-destructive/10 text-destructive text-[10px] font-semibold px-1.5 py-0.5 rounded">REFUNDED</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
                <Printer size={13} /> Print
              </button>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X size={18} /></button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div ref={printRef}>
              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1"><Hash size={10} /> Invoice</p>
                  <p className="text-sm font-mono font-semibold text-foreground">{sale.invoiceNo}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1"><Calendar size={10} /> Date</p>
                  <p className="text-sm font-semibold text-foreground">{new Date(sale.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1"><User size={10} /> Customer</p>
                  <p className="text-sm font-semibold text-foreground">{sale.customer?.name || 'Walk-in'}</p>
                  {sale.customer?.phone && <p className="text-xs text-muted-foreground">{sale.customer.phone}</p>}
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1"><Package size={10} /> Cashier</p>
                  <p className="text-sm font-semibold text-foreground">{sale.user?.name || '—'}</p>
                  <p className="text-xs text-muted-foreground">{new Date(sale.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>

              {/* Line items */}
              <div className="border border-border rounded-lg overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-muted-foreground text-[11px] uppercase border-b border-border">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Item</th>
                      <th className="px-4 py-2.5 text-center">Qty</th>
                      <th className="px-4 py-2.5 text-right">Unit</th>
                      <th className="px-4 py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.items.map((item: any, i: number) => (
                      <tr key={item.id} className={i < sale.items.length - 1 ? 'border-b border-border' : ''}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground leading-tight">{item.product?.name}</p>
                          {item.product?.sku && <p className="text-[10px] text-muted-foreground font-mono">{item.product.sku}</p>}
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{fmt(item.price)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">{fmt(item.price * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="bg-muted/20 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{sale.items.length} item{sale.items.length !== 1 ? 's' : ''}</span>
                  <span>Subtotal: {fmt(sale.subtotal ?? subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>VAT 15%</span>
                  <span>{fmt(sale.vatAmount ?? subtotal * 0.15)}</span>
                </div>
                {sale.paymentMethod && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Payment</span>
                    <span>{sale.paymentMethod.replace('_', ' ')}</span>
                  </div>
                )}
                {sale.notes?.includes('DISCOUNT') && (
                  <p className="text-xs text-amber-700">{sale.notes}</p>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="font-semibold text-foreground">Total Paid</span>
                  <span className={`text-xl font-bold ${isReturned ? 'line-through text-muted-foreground' : 'text-primary'}`}>{fmt(sale.totalAmount)}</span>
                </div>
                {isReturned && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-destructive font-medium flex items-center gap-1.5"><RotateCcw size={13} /> Refunded</span>
                    <span className="font-bold text-destructive">−{fmt(sale.returns[0].refundAmount)}</span>
                  </div>
                )}
              </div>
              <p className="text-center text-xs text-muted-foreground mt-4">Thank you for your purchase!</p>
            </div>

            {/* Return section */}
            {canMutate && !isReturned && (
              <div className="border border-border rounded-lg overflow-hidden">
                {!showReturnForm ? (
                  <button onClick={() => setShowReturnForm(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm text-destructive hover:bg-destructive/5 transition-colors">
                    <RotateCcw size={14} /> Process Return / Refund
                  </button>
                ) : (
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                      <AlertTriangle size={15} /> Confirm return
                    </div>
                    <p className="text-xs text-muted-foreground">Leave quantities at max for a full refund, or lower them for a partial return.</p>
                    <div className="space-y-2">
                      {sale.items.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate flex-1">{item.product?.name}</span>
                          <input type="number" min={0} max={item.quantity}
                            value={returnQty[item.id] ?? item.quantity}
                            onChange={e => setReturnQty(q => ({ ...q, [item.id]: Math.max(0, Math.min(item.quantity, Number(e.target.value))) }))}
                            className="w-16 px-2 py-1 bg-background border border-border rounded text-right"
                            aria-label={`Return qty for ${item.product?.name}`} />
                          <span className="text-muted-foreground">/ {item.quantity}</span>
                        </div>
                      ))}
                    </div>
                    <textarea value={returnReason} onChange={e => setReturnReason(e.target.value)}
                      placeholder="Reason for return (optional)..." rows={2}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-destructive outline-none resize-none" />
                    <div className="flex gap-2">
                      <button onClick={() => setShowReturnForm(false)}
                        className="flex-1 px-3 py-2 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors">
                        Cancel
                      </button>
                      <button onClick={handleReturn} disabled={returning}
                        className="flex-1 px-3 py-2 bg-destructive text-destructive-foreground rounded-lg text-xs font-medium hover:bg-destructive/90 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5">
                        {returning ? <span className="w-3.5 h-3.5 border-2 border-destructive-foreground/30 border-t-destructive-foreground rounded-full animate-spin" /> : <RotateCcw size={13} />}
                        {returning ? 'Processing…' : 'Confirm Refund'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── POS Modal with Barcode Scanner ───────────────────────────────────────────

function POSModal({ open, onClose, products, customers, refetch, onCompleted }: any) {
  const [cart, setCart]             = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [search, setSearch]         = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [discountPct, setDiscountPct] = useState(0);
  const [tendered, setTendered]     = useState('');
  const [createSale, { loading }]   = useMutation(CREATE_SALE);
  const { success, error: toastError } = useToast();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let buf = '';
    let timer: ReturnType<typeof setTimeout>;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && buf.length >= 4) {
        const match = (products || []).find((p: any) => p.barcode === buf || p.sku === buf);
        if (match && match.stock > 0) addToCart(match);
        buf = '';
        clearTimeout(timer);
        return;
      }
      if (e.key.length === 1) {
        buf += e.key;
        clearTimeout(timer);
        timer = setTimeout(() => { buf = ''; }, 80);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(timer); };
  }, [open, products]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { productId: product.id, name: product.name, quantity: 1, price: product.sellingPrice, stock: product.stock }];
    });
  };

  const filteredProducts = (products || [])
    .filter((p: any) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
    )
    .filter((p: any) => p.stock > 0);

  const filteredCustomers = (customers || []).filter((c: any) =>
    !customerQuery || c.name.toLowerCase().includes(customerQuery.toLowerCase()) || c.phone?.includes(customerQuery)
  );

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(i => i.productId !== productId));
  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) { removeFromCart(productId); return; }
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: Math.min(qty, i.stock) } : i));
  };

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discountAmt = Math.round(subtotal * (Math.min(100, Math.max(0, discountPct)) / 100) * 100) / 100;
  const afterDiscount = Math.max(0, subtotal - discountAmt);
  const vat = Math.round(afterDiscount * 0.15 * 100) / 100;
  const grandTotal = Math.round((afterDiscount + vat) * 100) / 100;
  const tenderedNum = Number(tendered);
  const changeDue = paymentMethod === 'CASH' && tenderedNum >= grandTotal
    ? Math.round((tenderedNum - grandTotal) * 100) / 100
    : 0;

  const resetCart = () => {
    setCart([]); setCustomerId(''); setCustomerQuery(''); setDiscountPct(0); setTendered(''); setPaymentMethod('CASH');
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === 'CREDIT' && !customerId) {
      toastError('Customer required', 'Select a customer for credit (utang) sales.');
      return;
    }
    const factor = subtotal > 0 ? afterDiscount / subtotal : 1;
    const items = cart.map(i => ({
      productId: i.productId,
      quantity: i.quantity,
      price: Math.round(i.price * factor * 100) / 100,
    }));
    const paymentAmount = paymentMethod === 'CREDIT' ? 0 : grandTotal;
    const notes = discountPct > 0 ? `DISCOUNT:${discountPct}% [discount:${discountAmt}]` : null;
    const idempotencyKey = crypto.randomUUID();
    const variables = {
      customerId: customerId || null,
      items,
      paymentMethod,
      paymentAmount,
      notes,
      idempotencyKey,
    };

    if (!isBrowserOnline()) {
      await enqueueSale(variables);
      success('Queued offline', 'Sale will sync when the connection returns.');
      resetCart(); onClose();
      return;
    }

    try {
      const result = await createSale({ variables });
      const sale = result.data.createSale;
      success('Sale completed!', `Invoice: ${sale.invoiceNo} — ${fmt(sale.totalAmount)}`);
      resetCart(); refetch(); onClose();
      onCompleted?.(sale);
    } catch (e: any) { toastError('Sale failed', e.message); }
  };

  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-lg font-semibold flex items-center gap-2"><ShoppingCart size={20} className="text-primary" /> Checkout</h2>
            <div className="flex items-center gap-3">
              {!isBrowserOnline() && (
                <span className="text-xs text-amber-700 flex items-center gap-1"><WifiOff size={13} /> Offline — sales queue locally</span>
              )}
              <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
                <Barcode size={13} /> Scanner ready
              </span>
              <button onClick={onClose} aria-label="Close checkout"><X size={20} className="text-muted-foreground" /></button>
            </div>
          </div>
          <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
            <div className="flex-1 flex flex-col border-r border-border min-h-0">
              <div className="p-3 border-b border-border">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search or scan barcode…"
                    className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2 content-start">
                {filteredProducts.length === 0 ? (
                  <p className="col-span-2 text-sm text-muted-foreground text-center py-10">No in-stock products match.</p>
                ) : filteredProducts.map((p: any) => (
                  <button key={p.id} onClick={() => addToCart(p)}
                    className="text-left p-3 bg-background border border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all flex gap-2.5">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0 border border-border" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center text-primary shrink-0"><Package size={16} /></div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm line-clamp-1">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.sku} · {p.stock} left</p>
                      <p className="text-sm font-bold text-primary">{fmt(p.sellingPrice)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="w-full md:w-80 flex flex-col min-h-0">
              <div className="p-3 border-b border-border space-y-2">
                <input value={customerQuery} onChange={e => setCustomerQuery(e.target.value)}
                  placeholder="Search customer…"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
                <select value={customerId} onChange={e => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Walk-in customer</option>
                  {filteredCustomers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.currentDebt > 0 ? ` · debt ${fmt(c.currentDebt)}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {cart.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">Add products or scan a barcode</div>
                ) : cart.map(item => (
                  <div key={item.productId} className="bg-background border border-border rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-medium text-foreground line-clamp-1 flex-1">{item.name}</p>
                      <button onClick={() => removeFromCart(item.productId)} className="text-muted-foreground hover:text-destructive ml-2" aria-label="Remove"><X size={14} /></button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(item.productId, item.quantity - 1)} className="w-6 h-6 border border-border rounded text-sm hover:bg-muted">−</button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button onClick={() => updateQty(item.productId, item.quantity + 1)} className="w-6 h-6 border border-border rounded text-sm hover:bg-muted">+</button>
                      </div>
                      <span className="text-sm font-semibold">{fmt(item.price * item.quantity)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-border space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs text-muted-foreground">Discount %</label>
                  <input type="number" min={0} max={100} value={discountPct}
                    onChange={e => setDiscountPct(Number(e.target.value) || 0)}
                    className="w-20 px-2 py-1 bg-background border border-border rounded text-sm text-right" />
                </div>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                {paymentMethod === 'CASH' && (
                  <input type="number" min={0} value={tendered} onChange={e => setTendered(e.target.value)}
                    placeholder="Cash tendered"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                )}
                <div className="text-xs space-y-1 text-muted-foreground">
                  <div className="flex justify-between"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                  {discountAmt > 0 && <div className="flex justify-between text-amber-700"><span>Discount</span><span>−{fmt(discountAmt)}</span></div>}
                  <div className="flex justify-between"><span>VAT 15%</span><span>{fmt(vat)}</span></div>
                  {changeDue > 0 && <div className="flex justify-between"><span>Change</span><span>{fmt(changeDue)}</span></div>}
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total</span>
                  <span className="text-xl font-bold text-primary">{fmt(grandTotal)}</span>
                </div>
                <button onClick={handleCheckout} disabled={loading || cart.length === 0}
                  className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
                  <Receipt size={16} />{loading ? 'Processing…' : 'Complete sale'}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Sales() {
  const [posOpen, setPosOpen]         = useState(false);
  const [receiptSale, setReceiptSale] = useState<any>(null);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'refunded'>('all');
  const [payFilter, setPayFilter]     = useState('');
  const [fromDate, setFromDate]       = useState('');
  const [toDate, setToDate]           = useState('');
  const [page, setPage]               = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const { data, loading, refetch }    = useQuery(GET_SALES_DATA, { fetchPolicy: 'cache-and-network' });
  const [createSale]                  = useMutation(CREATE_SALE);
  const { t }                         = useLangContext();
  const sales = data?.sales || [];

  useEffect(() => {
    const flush = async () => {
      if (!isBrowserOnline()) {
        setPendingCount((await listPendingSales()).length);
        return;
      }
      const pending = await listPendingSales();
      setPendingCount(pending.length);
      for (const row of pending) {
        try {
          await createSale({ variables: row.variables });
          await removePendingSale(row.id);
        } catch (e: any) {
          await markPendingFailed(row.id, e.message);
        }
      }
      setPendingCount((await listPendingSales()).length);
      refetch();
    };
    void flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [createSale, refetch]);

  const filtered = sales.filter((s: any) => {
    const q = search.toLowerCase();
    const matchQ = s.invoiceNo.toLowerCase().includes(q) || s.customer?.name?.toLowerCase().includes(q);
    const isReturned = s.returns?.length > 0;
    const matchStatus = statusFilter === 'all' || (statusFilter === 'refunded' ? isReturned : !isReturned);
    const matchPay = !payFilter || s.paymentMethod === payFilter;
    const created = new Date(s.createdAt).getTime();
    const matchFrom = !fromDate || created >= new Date(fromDate).getTime();
    const matchTo = !toDate || created <= new Date(toDate + 'T23:59:59').getTime();
    return matchQ && matchStatus && matchPay && matchFrom && matchTo;
  });
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const handleSearch = (v: string) => { setSearch(v); setPage(0); };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('sales')}</h2>
          <p className="text-sm text-muted-foreground">{sales.length} total transactions</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="text-xs bg-amber-500/10 text-amber-700 px-2 py-1 rounded-full">{pendingCount} offline queued</span>
          )}
          <button onClick={() => setPosOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium">
            <Plus size={16} /> {t('newSale')}
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20 flex items-center gap-3 flex-wrap">
          <div className="relative max-w-sm flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => handleSearch(e.target.value)}
              placeholder="Search invoice or customer..."
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as any); setPage(0); }}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm">
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="refunded">Refunded</option>
          </select>
          <select value={payFilter} onChange={e => { setPayFilter(e.target.value); setPage(0); }}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm">
            <option value="">All payments</option>
            {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(0); }}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm" aria-label="From date" />
          <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(0); }}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm" aria-label="To date" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>{[t('invoice'), t('customer'), 'Items', t('total'), 'Pay', 'Date', t('cashier'), t('status'), ''].map(h =>
                <th key={h} className="px-5 py-3 whitespace-nowrap">{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12">
                  <div className="flex justify-center"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
                </td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-16 text-muted-foreground text-sm">
                  <p className="font-medium text-foreground">No sales found</p>
                  <p className="text-sm mt-1">Start a checkout to record the first transaction.</p>
                </td></tr>
              ) : paginated.map((s: any, i: number) => {
                const isReturned = s.returns?.length > 0;
                return (
                  <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                    onClick={() => setReceiptSale(s)}
                    className="border-b border-border hover:bg-muted/20 transition-colors cursor-pointer group">
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">{s.invoiceNo}</span>
                    </td>
                    <td className="px-5 py-4 font-medium text-foreground">{s.customer?.name || 'Walk-in'}</td>
                    <td className="px-5 py-4 text-muted-foreground">{s.items?.length} item{s.items?.length !== 1 ? 's' : ''}</td>
                    <td className="px-5 py-4">
                      <span className={`font-bold ${isReturned ? 'line-through text-muted-foreground' : 'text-emerald-500'}`}>
                        {fmt(s.totalAmount)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">{s.paymentMethod || 'CASH'}</td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">{s.user?.name}</td>
                    <td className="px-5 py-4">
                      {isReturned ? (
                        <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded-full font-medium flex items-center gap-1 w-fit">
                          <RotateCcw size={11} /> Refunded
                        </span>
                      ) : (
                    <span className="text-xs bg-emerald-500/10 text-emerald-600 px-2 py-1 rounded-full font-medium w-fit">Completed</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                        <Receipt size={13} /> View
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-medium text-foreground">
              {filtered.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)}
            </span> of <span className="font-medium text-foreground">{filtered.length}</span> sales
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted disabled:opacity-40">
              <ChevronLeft size={14} /> Prev
            </button>
            <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}
              className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted disabled:opacity-40">
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <POSModal open={posOpen} onClose={() => setPosOpen(false)}
        products={data?.products} customers={data?.customers} refetch={refetch}
        onCompleted={(sale: any) => setReceiptSale({ ...sale, createdAt: new Date().toISOString(), user: { name: 'You' }, returns: [] })} />

      {receiptSale && (
        <ReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} refetch={refetch} />
      )}
    </div>
  );
}
