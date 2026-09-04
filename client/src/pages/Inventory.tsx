import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpCircle, ArrowDownCircle, SlidersHorizontal, X, Search,
  Filter, Package, TrendingDown, AlertTriangle, FileDown,
  RefreshCw, History, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '../components/Toast';
import { useRole } from '../hooks/useRole';
import { fmt, fmtInt } from '../lib/currency';

// ── GraphQL ───────────────────────────────────────────────────────────────────

const GET_INVENTORY = gql`
  query GetInventory($search: String, $categoryId: String) {
    products(search: $search, categoryId: $categoryId) {
      id name sku barcode stock minStockLevel costPrice sellingPrice status
      category { id name }
      supplier  { id name }
    }
    categories { id name }
  }
`;

const GET_MOVEMENTS = gql`
  query GetMovements(
    $productId:    String
    $movementType: String
    $limit:        Int
    $offset:       Int
    $startDate:    String
    $endDate:      String
  ) {
    inventoryMovements(
      productId:    $productId
      movementType: $movementType
      limit:        $limit
      offset:       $offset
      startDate:    $startDate
      endDate:      $endDate
    ) {
      total
      hasMore
      movements {
        id movementType quantity previousStock newStock
        referenceType referenceId unitCost userId notes createdAt
        product { id name sku }
      }
    }
  }
`;

const ADJUST_STOCK = gql`
  mutation AdjustStock($productId: ID!, $quantity: Int!, $type: String!, $notes: String) {
    adjustStock(productId: $productId, quantity: $quantity, type: $type, notes: $notes) {
      id type quantity createdAt
    }
  }
`;

// ── Zod schema for adjustment form ───────────────────────────────────────────

const adjustSchema = z.object({
  productId: z.string().min(1, 'Select a product'),
  type:      z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  quantity:  z.number().int().positive('Must be greater than zero'),
  notes:     z.string().max(500).optional(),
}).refine(
  d => !(d.type === 'OUT' && d.quantity <= 0),
  { message: 'Quantity must be positive', path: ['quantity'] }
);
type AdjustForm = z.infer<typeof adjustSchema>;

// ── Movement type config ──────────────────────────────────────────────────────

const MOVEMENT_CONFIG: Record<string, { label: string; color: string; bg: string; sign: string }> = {
  STOCK_IN:        { label: 'Stock In',        color: 'text-emerald-600', bg: 'bg-emerald-500/10', sign: '+' },
  STOCK_OUT:       { label: 'Stock Out',        color: 'text-destructive', bg: 'bg-destructive/10', sign: '-' },
  PURCHASE:        { label: 'Purchase',         color: 'text-blue-600',   bg: 'bg-blue-500/10',    sign: '+' },
  SALE:            { label: 'Sale',             color: 'text-violet-600', bg: 'bg-violet-500/10',  sign: '-' },
  CUSTOMER_RETURN: { label: 'Customer Return',  color: 'text-emerald-600', bg: 'bg-emerald-500/10', sign: '+' },
  SUPPLIER_RETURN: { label: 'Supplier Return',  color: 'text-amber-600',  bg: 'bg-amber-500/10',   sign: '-' },
  DAMAGED:         { label: 'Damaged',          color: 'text-destructive', bg: 'bg-destructive/10', sign: '-' },
  EXPIRED:         { label: 'Expired',          color: 'text-destructive', bg: 'bg-destructive/10', sign: '-' },
  ADJUSTMENT:      { label: 'Adjustment',       color: 'text-amber-600',  bg: 'bg-amber-500/10',   sign: '±' },
  TRANSFER_OUT:    { label: 'Transfer Out',     color: 'text-orange-600', bg: 'bg-orange-500/10',  sign: '-' },
  TRANSFER_IN:     { label: 'Transfer In',      color: 'text-teal-600',   bg: 'bg-teal-500/10',    sign: '+' },
};

// ── Stock Adjust Modal ────────────────────────────────────────────────────────

function AdjustModal({ open, onClose, products, refetch }: {
  open: boolean; onClose: () => void; products: any[]; refetch: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [adjustStock, { loading }] = useMutation(ADJUST_STOCK, {
    onCompleted: () => refetch(),
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<AdjustForm>({
    resolver: zodResolver(adjustSchema),
    defaultValues: { type: 'IN', quantity: 1 },
  });

  const type            = watch('type');
  const selectedProduct = products.find((p: any) => p.id === watch('productId'));

  // Reset on close
  useEffect(() => { if (!open) reset({ type: 'IN', quantity: 1 }); }, [open, reset]);

  const onSubmit = async (values: AdjustForm) => {
    try {
      await adjustStock({ variables: { ...values, quantity: Number(values.quantity) } });
      success('Stock adjusted', `${values.type} ${values.quantity} unit(s) of ${selectedProduct?.name ?? ''}`);
      reset({ type: 'IN', quantity: 1 }); onClose();
    } catch (e: any) { toastError('Adjustment failed', e.message); }
  };

  if (!open) return null;

  const ic = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none transition-colors';

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">

          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <SlidersHorizontal size={18} className="text-primary" /> Manual Stock Adjustment
            </h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
            {/* Product */}
            <div>
              <label className="text-sm font-medium block mb-1">Product *</label>
              <select {...register('productId')} className={ic}>
                <option value="">Select product…</option>
                {products.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — Current stock: {p.stock}
                  </option>
                ))}
              </select>
              {errors.productId && <p className="text-xs text-destructive mt-1">{errors.productId.message}</p>}

              {/* Current stock badge */}
              {selectedProduct && (
                <div className={`mt-2 text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-2 w-fit ${
                  selectedProduct.stock === 0         ? 'bg-destructive/10 text-destructive' :
                  selectedProduct.stock <= selectedProduct.minStockLevel ? 'bg-amber-500/10 text-amber-600' :
                  'bg-emerald-500/10 text-emerald-600'
                }`}>
                  Current stock: <strong>{selectedProduct.stock}</strong> units
                  {selectedProduct.stock <= selectedProduct.minStockLevel && (
                    <AlertTriangle size={12} />
                  )}
                </div>
              )}
            </div>

            {/* Adjustment type */}
            <div>
              <label className="text-sm font-medium block mb-2">Adjustment Type *</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'IN',         label: 'Stock In',  icon: <ArrowUpCircle size={16} />,    color: 'text-emerald-500' },
                  { value: 'OUT',        label: 'Stock Out', icon: <ArrowDownCircle size={16} />,  color: 'text-destructive' },
                  { value: 'ADJUSTMENT', label: 'Set Exact', icon: <SlidersHorizontal size={16} />, color: 'text-amber-500' },
                ].map(opt => (
                  <label key={opt.value}
                    className={`flex flex-col items-center gap-1.5 p-3 border rounded-lg cursor-pointer transition-all ${
                      type === opt.value ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                    }`}>
                    <input type="radio" {...register('type')}
                      value={opt.value} className="hidden"
                      onChange={() => setValue('type', opt.value as AdjustForm['type'])} />
                    <span className={opt.color}>{opt.icon}</span>
                    <span className="text-xs font-medium">{opt.label}</span>
                  </label>
                ))}
              </div>
              {type === 'ADJUSTMENT' && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Sets stock to exactly this quantity (e.g. after a stocktake).
                </p>
              )}
            </div>

            {/* Quantity */}
            <div>
              <label className="text-sm font-medium block mb-1">
                {type === 'ADJUSTMENT' ? 'New Quantity *' : 'Quantity *'}
              </label>
              <input {...register('quantity', { valueAsNumber: true })}
                type="number" min={type === 'ADJUSTMENT' ? '0' : '1'} className={ic} />
              {errors.quantity && <p className="text-xs text-destructive mt-1">{errors.quantity.message}</p>}

              {/* Projected stock */}
              {selectedProduct && !isNaN(watch('quantity')) && (
                <p className="text-xs text-muted-foreground mt-1">
                  {type === 'ADJUSTMENT'
                    ? `Stock will be set to: ${watch('quantity')}`
                    : type === 'IN'
                      ? `New stock: ${selectedProduct.stock + (watch('quantity') || 0)}`
                      : `New stock: ${selectedProduct.stock - (watch('quantity') || 0)}${
                          selectedProduct.stock - (watch('quantity') || 0) < 0 ? ' ⚠ below zero' : ''
                        }`
                  }
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium block mb-1">Reason / Notes</label>
              <textarea {...register('notes')} rows={2}
                placeholder="e.g. Stocktake correction, damaged goods, returned from customer…"
                className={`${ic} resize-none`} />
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
                {loading && <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />}
                {loading ? 'Adjusting…' : 'Save Adjustment'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── CSV Export ────────────────────────────────────────────────────────────────

function exportInventoryCSV(products: any[]) {
  const headers = ['Name', 'SKU', 'Barcode', 'Category', 'Stock', 'Min Stock', 'Unit Cost', 'Stock Value', 'Status'];
  const rows = products.map(p => [
    p.name, p.sku, p.barcode ?? '',
    p.category?.name ?? '',
    p.stock, p.minStockLevel,
    p.costPrice.toFixed(2),
    (p.costPrice * p.stock).toFixed(2),
    p.stock === 0 ? 'Out of Stock' : p.stock <= p.minStockLevel ? 'Low Stock' : 'In Stock',
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Page ──────────────────────────────────────────────────────────────────────

const MOVEMENT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'STOCK_IN',        label: 'Stock In' },
  { value: 'STOCK_OUT',       label: 'Stock Out' },
  { value: 'PURCHASE',        label: 'Purchase' },
  { value: 'SALE',            label: 'Sale' },
  { value: 'CUSTOMER_RETURN', label: 'Customer Return' },
  { value: 'ADJUSTMENT',      label: 'Adjustment' },
];

const PAGE_SIZE = 50;

export default function Inventory() {
  const [adjustOpen, setAdjustOpen]           = useState(false);
  const [tab, setTab]                         = useState<'stock' | 'ledger'>('stock');
  const [search, setSearch]                   = useState('');
  const [debouncedSearch, setDebounced]       = useState('');
  const [categoryFilter, setCategoryFilter]   = useState('');
  const [stockFilter, setStockFilter]         = useState('');
  const [movementType, setMovementType]       = useState('');
  const [ledgerOffset, setLedgerOffset]       = useState(0);
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate]     = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { canMutate } = useRole();

  // Stock tab query
  const { data: invData, loading: invLoading, refetch: refetchInv } = useQuery(GET_INVENTORY, {
    variables: {
      search:     debouncedSearch || undefined,
      categoryId: categoryFilter  || undefined,
    },
    fetchPolicy: 'cache-and-network',
  });

  // Ledger tab query
  const { data: ledgerData, loading: ledgerLoading, refetch: refetchLedger } = useQuery(GET_MOVEMENTS, {
    variables: {
      movementType: movementType || undefined,
      limit:        PAGE_SIZE,
      offset:       ledgerOffset,
      startDate:    ledgerStartDate || undefined,
      endDate:      ledgerEndDate ? ledgerEndDate + 'T23:59:59' : undefined,
    },
    fetchPolicy: 'cache-and-network',
    skip: tab !== 'ledger',
  });

  const allProducts: any[] = invData?.products    ?? [];
  const categories:  any[] = invData?.categories  ?? [];
  const page                = ledgerData?.inventoryMovements;
  const movements: any[]   = page?.movements ?? [];
  const ledgerTotal: number = page?.total    ?? 0;

  // Debounced search
  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebounced(v), 300);
  }, []);
  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current); }, []);

  // Filter products for stock tab
  const filteredProducts = allProducts.filter(p => {
    if (stockFilter === 'low')  return p.stock > 0 && p.stock <= p.minStockLevel;
    if (stockFilter === 'out')  return p.stock === 0;
    if (stockFilter === 'ok')   return p.stock > p.minStockLevel;
    return true;
  });

  // Stats
  const totalValue    = allProducts.reduce((s, p) => s + p.costPrice * p.stock, 0);
  const lowStockCount = allProducts.filter(p => p.stock > 0 && p.stock <= p.minStockLevel).length;
  const outOfStock    = allProducts.filter(p => p.stock === 0 && p.status === 'ACTIVE').length;
  const totalUnits    = allProducts.reduce((s, p) => s + p.stock, 0);

  const refetchAll = () => { refetchInv(); if (tab === 'ledger') refetchLedger(); };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Inventory</h2>
          <p className="text-sm text-muted-foreground">Stock levels and movement ledger</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refetchAll}
            className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Refresh">
            <RefreshCw size={15} />
          </button>
          {allProducts.length > 0 && (
            <button onClick={() => exportInventoryCSV(filteredProducts)}
              className="px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2 text-muted-foreground">
              <FileDown size={14} /> Export CSV
            </button>
          )}
          {canMutate && (
            <button onClick={() => setAdjustOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
              <SlidersHorizontal size={16} /> Adjust Stock
            </button>
          )}
        </div>
      </div>

      {/* KPI stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Inventory Value</p>
          <p className="text-xl font-bold text-foreground">{fmtInt(totalValue)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Units</p>
          <p className="text-xl font-bold text-foreground">{totalUnits.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
            <AlertTriangle size={11} className="text-amber-500" /> Low Stock
          </p>
          <p className={`text-xl font-bold ${lowStockCount > 0 ? 'text-amber-500' : 'text-foreground'}`}>{lowStockCount}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
            <TrendingDown size={11} className="text-destructive" /> Out of Stock
          </p>
          <p className={`text-xl font-bold ${outOfStock > 0 ? 'text-destructive' : 'text-foreground'}`}>{outOfStock}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/30 p-1 rounded-lg w-fit">
        {([
          { key: 'stock',  label: 'Stock Levels', icon: <Package size={14} /> },
          { key: 'ledger', label: 'Movement Ledger', icon: <History size={14} /> },
        ] as const).map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ── STOCK LEVELS TAB ──────────────────────────────────────────────── */}
      {tab === 'stock' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => handleSearch(e.target.value)}
                placeholder="Search name, SKU or barcode…"
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={13} className="text-muted-foreground" />
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary">
                <option value="">All Categories</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={stockFilter} onChange={e => setStockFilter(e.target.value)}
                className="px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary">
                <option value="">All Stock Levels</option>
                <option value="ok">In Stock</option>
                <option value="low">Low Stock</option>
                <option value="out">Out of Stock</option>
              </select>
              {(search || categoryFilter || stockFilter) && (
                <button onClick={() => { handleSearch(''); setCategoryFilter(''); setStockFilter(''); }}
                  className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 px-2 py-1 border border-border rounded-lg hover:bg-muted transition-colors">
                  <X size={11} /> Clear
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground ml-auto">
              {filteredProducts.length} of {allProducts.length} products
            </p>
          </div>

          {/* Table */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/30 text-muted-foreground text-xs uppercase border-b border-border">
                  <tr>
                    {['Product', 'SKU', 'Category', 'Stock', 'Min Level', 'Unit Cost', 'Stock Value', 'Status'].map(h => (
                      <th key={h} className="px-5 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invLoading ? (
                    <tr><td colSpan={8} className="py-14 text-center">
                      <div className="flex justify-center">
                        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      </div>
                    </td></tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr><td colSpan={8} className="py-14 text-center">
                      <Package size={40} className="mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-muted-foreground text-sm">No products match your filters.</p>
                    </td></tr>
                  ) : filteredProducts.map((p: any, i: number) => {
                    const isOut  = p.stock === 0;
                    const isLow  = !isOut && p.stock <= p.minStockLevel;
                    const isGood = !isOut && !isLow;
                    return (
                      <motion.tr key={p.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                        className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3.5">
                          <div>
                            <p className="font-medium text-foreground">{p.name}</p>
                            {p.supplier?.name && (
                              <p className="text-xs text-muted-foreground">{p.supplier.name}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono text-muted-foreground">{p.sku}</code>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                            {p.category?.name ?? '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            {(isOut || isLow) && <AlertTriangle size={13} className={isOut ? 'text-destructive' : 'text-amber-500'} />}
                            <span className={`font-bold tabular-nums text-base ${isOut ? 'text-destructive' : isLow ? 'text-amber-500' : 'text-emerald-500'}`}>
                              {p.stock}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">{p.minStockLevel}</td>
                        <td className="px-5 py-3.5 text-muted-foreground">{fmt(p.costPrice)}</td>
                        <td className="px-5 py-3.5 font-medium">{fmt(p.costPrice * p.stock)}</td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            isOut  ? 'bg-destructive/10 text-destructive' :
                            isLow  ? 'bg-amber-500/10 text-amber-600'    :
                            isGood ? 'bg-emerald-500/10 text-emerald-600' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MOVEMENT LEDGER TAB ──────────────────────────────────────────── */}
      {tab === 'ledger' && (
        <div className="space-y-4">
          {/* Ledger filters */}
          <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-3 items-center">
            <select value={movementType} onChange={e => { setMovementType(e.target.value); setLedgerOffset(0); }}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary">
              {MOVEMENT_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">From</label>
              <input type="date" value={ledgerStartDate}
                onChange={e => { setLedgerStartDate(e.target.value); setLedgerOffset(0); }}
                className="px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
              <label className="text-xs text-muted-foreground">To</label>
              <input type="date" value={ledgerEndDate}
                onChange={e => { setLedgerEndDate(e.target.value); setLedgerOffset(0); }}
                className="px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" />
            </div>
            {(movementType || ledgerStartDate || ledgerEndDate) && (
              <button onClick={() => { setMovementType(''); setLedgerStartDate(''); setLedgerEndDate(''); setLedgerOffset(0); }}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 px-2 py-1 border border-border rounded-lg hover:bg-muted transition-colors">
                <X size={11} /> Clear
              </button>
            )}
            <p className="text-xs text-muted-foreground ml-auto">
              {ledgerTotal.toLocaleString()} movement{ledgerTotal !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Ledger table */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/30 text-muted-foreground text-xs uppercase border-b border-border">
                  <tr>
                    {['Date', 'Product', 'Type', 'Qty', 'Before', 'After', 'Reference', 'Notes'].map(h => (
                      <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ledgerLoading ? (
                    <tr><td colSpan={8} className="py-14 text-center">
                      <div className="flex justify-center">
                        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      </div>
                    </td></tr>
                  ) : movements.length === 0 ? (
                    <tr><td colSpan={8} className="py-14 text-center">
                      <History size={40} className="mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-muted-foreground text-sm">No movements found.</p>
                    </td></tr>
                  ) : movements.map((m: any, i: number) => {
                    const cfg = MOVEMENT_CONFIG[m.movementType] ?? MOVEMENT_CONFIG['ADJUSTMENT'];
                    const qtyDisplay = `${cfg.sign}${Math.abs(m.quantity)}`;
                    return (
                      <motion.tr key={m.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}
                        className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(m.createdAt).toLocaleString('en-US', {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground text-xs">{m.product?.name ?? '—'}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{m.product?.sku}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-bold tabular-nums text-sm ${m.quantity > 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                            {qtyDisplay}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums text-xs">{m.previousStock}</td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold tabular-nums text-xs ${
                            m.newStock === 0 ? 'text-destructive' : 'text-foreground'
                          }`}>
                            {m.newStock}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {m.referenceType && (
                            <span className="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px]">
                              {m.referenceType}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate" title={m.notes ?? ''}>
                          {m.notes ?? '—'}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Ledger pagination */}
            {ledgerTotal > PAGE_SIZE && (
              <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {ledgerOffset + 1}–{Math.min(ledgerOffset + PAGE_SIZE, ledgerTotal)} of {ledgerTotal.toLocaleString()} movements
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setLedgerOffset(Math.max(0, ledgerOffset - PAGE_SIZE))}
                    disabled={ledgerOffset === 0}
                    className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <button onClick={() => setLedgerOffset(ledgerOffset + PAGE_SIZE)}
                    disabled={!page?.hasMore}
                    className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Adjust Modal */}
      <AdjustModal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        products={allProducts.filter((p: any) => p.status === 'ACTIVE')}
        refetch={refetchAll}
      />
    </div>
  );
}
