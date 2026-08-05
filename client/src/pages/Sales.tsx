import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, ShoppingCart, X, Receipt, ChevronLeft, ChevronRight,
  Printer, Package, User, Calendar, Hash, Barcode, RotateCcw, AlertTriangle,
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { useRole } from '../hooks/useRole';
import { fmt } from '../lib/currency';

// ── GraphQL ───────────────────────────────────────────────────────────────────

const GET_SALES_DATA = gql`
  query GetSalesData {
    sales {
      id invoiceNo totalAmount createdAt
      customer { name email phone }
      user { name }
      items { id quantity price product { name sku } }
      returns { id refundAmount reason createdAt }
    }
    products { id name sku barcode sellingPrice stock imageUrl }
    customers { id name }
  }
`;

const CREATE_SALE = gql`
  mutation CreateSale($customerId: String, $items: [CreateSaleItemInput!]!) {
    createSale(customerId: $customerId, items: $items) { id invoiceNo totalAmount }
  }
`;

const RETURN_SALE = gql`
  mutation ReturnSale($saleId: ID!, $reason: String) {
    returnSale(saleId: $saleId, reason: $reason) { id refundAmount createdAt }
  }
`;

const PAGE_SIZE = 10;
type CartItem = { productId: string; name: string; quantity: number; price: number; stock: number };

// ── Receipt + Return Modal ────────────────────────────────────────────────────

function ReceiptModal({ sale, onClose, refetch }: { sale: any; onClose: () => void; refetch: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);
  const [returnReason, setReturnReason] = useState('');
  const [showReturnForm, setShowReturnForm] = useState(false);
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
      await returnSale({ variables: { saleId: sale.id, reason: returnReason || null } });
      success('Refund processed', `${fmt(sale.totalAmount)} refunded — stock restored.`);
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
                  <span>Subtotal: ${subtotal.toFixed(2)}</span>
                </div>
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
                      <AlertTriangle size={15} /> Confirm Full Return
                    </div>
                    <p className="text-xs text-muted-foreground">This will refund {fmt(sale.totalAmount)} and restore all stock levels.</p>
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

function POSModal({ open, onClose, products, customers, refetch }: any) {
  const [cart, setCart]           = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [search, setSearch]       = useState('');
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const [createSale, { loading }] = useMutation(CREATE_SALE);
  const { success, error: toastError } = useToast();
  const searchRef = useRef<HTMLInputElement>(null);

  // Barcode scanner: hardware scanners fire characters rapidly then Enter
  useEffect(() => {
    if (!open) return;
    let buf = '';
    let timer: ReturnType<typeof setTimeout>;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && buf.length >= 4) {
        // Try to match by barcode or SKU
        const match = (products || []).find(
          (p: any) => p.barcode === buf || p.sku === buf
        );
        if (match && match.stock > 0) {
          addToCart(match);
          setBarcodeBuffer('');
        }
        buf = '';
        clearTimeout(timer);
        return;
      }
      if (e.key.length === 1) {
        buf += e.key;
        clearTimeout(timer);
        timer = setTimeout(() => { buf = ''; }, 80); // reset after 80ms gap
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

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(i => i.productId !== productId));
  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) { removeFromCart(productId); return; }
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: Math.min(qty, i.stock) } : i));
  };
  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    try {
      const result = await createSale({
        variables: { customerId: customerId || null, items: cart.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price })) },
      });
      success('Sale completed!', `Invoice: ${result.data.createSale.invoiceNo} — ${fmt(result.data.createSale.totalAmount)}`);
      setCart([]); setCustomerId(''); refetch(); onClose();
    } catch (e: any) { toastError('Sale failed', e.message); }
  };

  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-lg font-semibold flex items-center gap-2"><ShoppingCart size={20} className="text-primary" /> New Sale</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5 hidden sm:flex">
                <Barcode size={13} /> Barcode scanner ready
              </span>
              <button onClick={onClose}><X size={20} className="text-muted-foreground" /></button>
            </div>
          </div>
          <div className="flex flex-1 overflow-hidden">
            {/* Product grid */}
            <div className="flex-1 flex flex-col border-r border-border">
              <div className="p-3 border-b border-border">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search or scan barcode…"
                    className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2 content-start">
                {filteredProducts.map((p: any) => (
                  <button key={p.id} onClick={() => addToCart(p)}
                    className="text-left p-3 bg-background border border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all flex gap-2.5">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-10 h-10 rounded object-cover shrink-0 border border-border" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
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
            {/* Cart */}
            <div className="w-72 flex flex-col">
              <div className="p-3 border-b border-border">
                <select value={customerId} onChange={e => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Walk-in Customer</option>
                  {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {cart.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">Click products or scan barcode</div>
                ) : cart.map(item => (
                  <div key={item.productId} className="bg-background border border-border rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-medium text-foreground line-clamp-1 flex-1">{item.name}</p>
                      <button onClick={() => removeFromCart(item.productId)} className="text-muted-foreground hover:text-destructive ml-2"><X size={14} /></button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(item.productId, item.quantity - 1)} className="w-6 h-6 border border-border rounded text-sm hover:bg-muted flex items-center justify-center">−</button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button onClick={() => updateQty(item.productId, item.quantity + 1)} className="w-6 h-6 border border-border rounded text-sm hover:bg-muted flex items-center justify-center">+</button>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{fmt(item.price * item.quantity)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-border">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="text-xl font-bold text-primary">{fmt(total)}</span>
                </div>
                <button onClick={handleCheckout} disabled={loading || cart.length === 0}
                  className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  <Receipt size={16} />{loading ? 'Processing...' : 'Complete Sale'}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Sales() {
  const [posOpen, setPosOpen]         = useState(false);
  const [receiptSale, setReceiptSale] = useState<any>(null);
  const [search, setSearch]           = useState('');
  const [page, setPage]               = useState(0);
  const { data, loading, refetch }    = useQuery(GET_SALES_DATA, { fetchPolicy: 'cache-and-network' });
  const sales = data?.sales || [];

  const filtered = sales.filter((s: any) =>
    s.invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
    s.customer?.name?.toLowerCase().includes(search.toLowerCase())
  );
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const handleSearch = (v: string) => { setSearch(v); setPage(0); };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-foreground">Sales</h2>
          <p className="text-sm text-muted-foreground">{sales.length} total transactions</p>
        </div>
        <button onClick={() => setPosOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
          <Plus size={16} /> New Sale
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20 flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => handleSearch(e.target.value)}
              placeholder="Search invoice or customer..."
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <p className="text-xs text-muted-foreground hidden sm:block">Click a row to view receipt</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>{['Invoice', 'Customer', 'Items', 'Total', 'Date', 'Cashier', 'Status', ''].map(h =>
                <th key={h} className="px-5 py-3 whitespace-nowrap">{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12">
                  <div className="flex justify-center"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
                </td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">No sales found.</td></tr>
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
              className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft size={14} /> Prev
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: pageCount }, (_, i) => (
                <button key={i} onClick={() => setPage(i)}
                  className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${page === i ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}>
                  {i + 1}
                </button>
              ))}
            </div>
            <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}
              className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <POSModal open={posOpen} onClose={() => setPosOpen(false)}
        products={data?.products} customers={data?.customers} refetch={refetch} />

      {receiptSale && (
        <ReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} refetch={refetch} />
      )}
    </div>
  );
}
