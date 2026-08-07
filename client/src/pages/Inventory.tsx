import React, { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpCircle, ArrowDownCircle, SlidersHorizontal, X, Search, Filter } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useToast } from '../components/Toast';
import { useRole } from '../hooks/useRole';
import { fmt, fmtInt } from '../lib/currency';
import { useLangContext } from '../lib/LangContext';

const GET_INVENTORY = gql`
  query GetInventory {
    products {
      id name sku stock minStockLevel costPrice sellingPrice status
      category { name }
    }
    categories { id name }
    transactions {
      id type quantity notes createdAt
      product { name }
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

// ── Adjust Modal ──────────────────────────────────────────────────────────────

function AdjustModal({ open, onClose, products, refetch }: any) {
  const { success, error: toastError } = useToast();
  const { register, handleSubmit, reset, watch } = useForm<{
    productId: string; type: string; quantity: number; notes: string;
  }>({ defaultValues: { type: 'IN', quantity: 1 } });
  const [adjustStock, { loading }] = useMutation(ADJUST_STOCK);
  const type = watch('type');

  const onSubmit = async (values: any) => {
    try {
      await adjustStock({ variables: { ...values, quantity: Number(values.quantity) } });
      const product = products.find((p: any) => p.id === values.productId);
      success('Stock adjusted', `${values.type} ${values.quantity} units${product ? ` of ${product.name}` : ''}`);
      refetch(); reset(); onClose();
    } catch (e: any) { toastError('Adjustment failed', e.message); }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <SlidersHorizontal size={18} className="text-primary" /> Stock Adjustment
            </h2>
            <button onClick={onClose}><X size={20} className="text-muted-foreground" /></button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">Product *</label>
              <select {...register('productId', { required: true })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none">
                <option value="">Select product...</option>
                {products.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} — Stock: {p.stock}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Adjustment Type *</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'IN',         label: 'Stock In',  icon: <ArrowUpCircle size={16} />,   color: 'text-emerald-500' },
                  { value: 'OUT',        label: 'Stock Out', icon: <ArrowDownCircle size={16} />, color: 'text-destructive' },
                  { value: 'ADJUSTMENT', label: 'Set Qty',   icon: <SlidersHorizontal size={16} />, color: 'text-amber-500' },
                ].map(opt => (
                  <label key={opt.value}
                    className={`flex flex-col items-center gap-1.5 p-3 border rounded-lg cursor-pointer transition-all ${type === opt.value ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>
                    <input type="radio" {...register('type')} value={opt.value} className="hidden" />
                    <span className={opt.color}>{opt.icon}</span>
                    <span className="text-xs font-medium">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Quantity *</label>
              <input {...register('quantity', { required: true, min: 1 })} type="number" min="1"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Notes</label>
              <textarea {...register('notes')} placeholder="Reason for adjustment..." rows={2}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none resize-none" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
                {loading ? 'Adjusting...' : 'Adjust Stock'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Inventory() {
  const [adjustOpen, setAdjustOpen]         = useState(false);
  const [tab, setTab]                       = useState<'products' | 'transactions'>('products');
  const [search, setSearch]                 = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter]     = useState('');
  const { data, loading, refetch } = useQuery(GET_INVENTORY, { fetchPolicy: 'cache-and-network' });
  const { canMutate } = useRole();
  const { t } = useLangContext();

  const allProducts:   any[] = data?.products     || [];
  const categories:    any[] = data?.categories   || [];
  const transactions:  any[] = data?.transactions || [];

  // ── Filtered products ──────────────────────────────────────────────────────
  const products = allProducts.filter(p => {
    const matchSearch   = !search         || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !categoryFilter || p.category?.name === categoryFilter;
    const matchStatus   = !statusFilter
      || (statusFilter === 'low'  && p.stock > 0 && p.stock <= p.minStockLevel)
      || (statusFilter === 'out'  && p.stock === 0)
      || (statusFilter === 'ok'   && p.stock > p.minStockLevel);
    return matchSearch && matchCategory && matchStatus;
  });

  // ── Stats (always from full list) ──────────────────────────────────────────
  const totalValue = allProducts.reduce((s: number, p: any) => s + p.costPrice * p.stock, 0);
  const lowStock   = allProducts.filter((p: any) => p.stock > 0 && p.stock <= p.minStockLevel);
  const outOfStock = allProducts.filter((p: any) => p.stock === 0);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('inventory')}</h2>
          <p className="text-sm text-muted-foreground">Stock management and movement tracking</p>
        </div>
        {canMutate && (
          <button onClick={() => setAdjustOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
            <SlidersHorizontal size={16} /> {t('filter')}
          </button>
        )}
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{t('inventoryValue')}</p>
          <p className="text-xl font-bold text-foreground">{fmtInt(totalValue)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Products</p>
          <p className="text-xl font-bold text-foreground">{allProducts.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{t('lowStock')}</p>
          <p className="text-xl font-bold text-amber-500">{lowStock.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{t('outOfStock')}</p>
          <p className="text-xl font-bold text-destructive">{outOfStock.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/30 p-1 rounded-lg w-fit">
        {(['products', 'transactions'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Filters — only show on products tab */}
      {tab === 'products' && (
        <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name or SKU…"
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-muted-foreground" />
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary">
              <option value="">All Categories</option>
              {categories.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          {/* Status filter */}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary">
            <option value="">All Statuses</option>
            <option value="ok">In Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>

          {/* Active filter chips */}
          {(search || categoryFilter || statusFilter) && (
            <div className="flex items-center gap-2">
              {categoryFilter && (
                <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
                  {categoryFilter}
                  <button onClick={() => setCategoryFilter('')}><X size={10} /></button>
                </span>
              )}
              {statusFilter && (
                <span className="flex items-center gap-1 text-xs bg-amber-500/10 text-amber-700 px-2.5 py-1 rounded-full font-medium capitalize">
                  {statusFilter === 'ok' ? 'In Stock' : statusFilter === 'low' ? 'Low Stock' : 'Out of Stock'}
                  <button onClick={() => setStatusFilter('')}><X size={10} /></button>
                </span>
              )}
              <button onClick={() => { setSearch(''); setCategoryFilter(''); setStatusFilter(''); }}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                Clear all
              </button>
            </div>
          )}

          {/* Results count */}
          <p className="text-xs text-muted-foreground ml-auto">
            Showing <span className="font-semibold text-foreground">{products.length}</span> of {allProducts.length} products
          </p>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {tab === 'products' ? (
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
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12">
                    <div className="flex justify-center">
                      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    </div>
                  </td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                    No products match your filters.
                  </td></tr>
                ) : products.map((p: any, i: number) => (
                  <motion.tr key={p.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-foreground">{p.name}</td>
                    <td className="px-5 py-3.5">
                      <code className="text-xs bg-muted px-2 py-1 rounded font-mono text-muted-foreground">{p.sku}</code>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        {p.category?.name || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`font-bold ${p.stock === 0 ? 'text-destructive' : p.stock <= p.minStockLevel ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{p.minStockLevel}</td>
                    <td className="px-5 py-3.5">{fmt(p.costPrice)}</td>
                    <td className="px-5 py-3.5 font-medium">{fmt(p.costPrice * p.stock)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        p.stock === 0        ? 'bg-destructive/10 text-destructive' :
                        p.stock <= p.minStockLevel ? 'bg-amber-500/10 text-amber-600' :
                        'bg-emerald-500/10 text-emerald-600'
                      }`}>
                        {p.stock === 0 ? t('outOfStock') : p.stock <= p.minStockLevel ? t('lowStock') : t('inStock')}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/30 text-muted-foreground text-xs uppercase border-b border-border">
                <tr>{['Product', 'Type', 'Quantity', 'Notes', 'Date'].map(h =>
                  <th key={h} className="px-5 py-3">{h}</th>
                )}</tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-muted-foreground text-sm">No transactions yet.</td></tr>
                ) : transactions.map((t: any, i: number) => (
                  <motion.tr key={t.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-foreground">{t.product?.name}</td>
                    <td className="px-5 py-3.5">
                      <span className={`flex items-center gap-1.5 text-xs font-medium w-fit px-2.5 py-1 rounded-full ${
                        t.type === 'IN'  ? 'bg-emerald-500/10 text-emerald-600' :
                        t.type === 'OUT' ? 'bg-destructive/10 text-destructive'  :
                        'bg-amber-500/10 text-amber-600'
                      }`}>
                        {t.type === 'IN' ? <ArrowUpCircle size={12} /> : t.type === 'OUT' ? <ArrowDownCircle size={12} /> : <SlidersHorizontal size={12} />}
                        {t.type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold">
                      {t.type === 'IN' ? '+' : t.type === 'OUT' ? '-' : ''}{t.quantity}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground text-xs">{t.notes || '—'}</td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AdjustModal open={adjustOpen} onClose={() => setAdjustOpen(false)} products={allProducts} refetch={refetch} />
    </div>
  );
}
